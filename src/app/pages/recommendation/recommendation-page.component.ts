import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Machine } from '../../core/models/machine.model';
import { RecommendationRequestDTO } from '../../core/models/recommendation.model';
import { SavedRecommendationResponse } from '../../core/models/sentinel.models';
import { MachineService } from '../../core/services/machine.service';
import { RecommendationService } from '../../core/services/recommendation.service';
import { PredictionService } from '../../core/services/prediction.service';
import { NotificationService } from '../../core/services/notification.service';
import { RecommendationCardComponent, RecommendationDecision } from '../../components/recommendation-card/recommendation-card.component';

// Fallback used only when a machine has no persisted prediction record yet
// (e.g. telemetry replay hasn't produced one for it) - matches the same
// moderate-risk default the legacy /machine/{id} preview endpoint used.
const DEFAULT_DAYS_UNTIL_FAILURE = 30;

@Component({
  selector: 'app-recommendation-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    RecommendationCardComponent,
  ],
  templateUrl: './recommendation-page.component.html',
  styleUrl: './recommendation-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationPageComponent implements OnInit {
  machines: Machine[] = [];
  machine: Machine | null = null;
  selectedMachineId: number | null = null;
  recommendation: SavedRecommendationResponse | null = null;

  isLoadingMachines = true;
  isGenerating = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private machineService: MachineService,
    private recommendationService: RecommendationService,
    private predictionService: PredictionService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const paramValue = this.route.snapshot.paramMap.get('machineId');
    const routeMachineId = paramValue ? Number(paramValue) : null;

    this.machineService.getAll().subscribe({
      next: (machines) => {
        this.machines = machines;
        this.isLoadingMachines = false;

        const initialId = routeMachineId ?? machines[0]?.id ?? null;
        if (initialId != null) {
          this.onMachineSelected(initialId);
        } else {
          this.notificationService.warn('No machines available yet.');
        }
        this.cdr.markForCheck();
      },
      error: (error: Error) => {
        this.isLoadingMachines = false;
        this.notificationService.error(error.message || 'Unable to load machine list.');
        this.cdr.markForCheck();
      },
    });
  }

  onMachineSelected(machineId: number): void {
    this.selectedMachineId = machineId;
    this.recommendation = null;
    this.machine = this.machines.find((m) => m.id === machineId) ?? null;
    this.cdr.markForCheck();
  }

  /**
   * "AI analysis" step: derive real failureProbability/daysUntilFailure for
   * the selected machine from its own risk score (Machine.riskScore, 0-100 ->
   * 0.0-1.0, same conversion MLServiceClient already uses server-side) and
   * its most recent persisted prediction record's RUL (hours -> days). Falls
   * back to a moderate-risk default only when the machine truly has no
   * prediction history yet.
   */
  generateRecommendation(): void {
    if (this.selectedMachineId == null || !this.machine) {
      return;
    }

    this.isGenerating = true;
    const machineId = this.selectedMachineId;

    this.predictionService.getLatestPrediction(machineId).subscribe({
      next: (latest) => {
        const failureProbability = this.deriveFailureProbability(this.machine!, latest);
        const daysUntilPredictedFailure = latest?.rulValue != null
          ? Math.max(1, Math.round(latest.rulValue / 24))
          : DEFAULT_DAYS_UNTIL_FAILURE;

        const request: RecommendationRequestDTO = {
          machineId,
          failureProbability,
          daysUntilPredictedFailure,
          requiredPartIds: [],
        };

        this.recommendationService.generateAndSave(request).subscribe({
          next: (saved) => {
            this.recommendation = saved;
            this.isGenerating = false;
            this.notificationService.success('Recommendation generated.');
            this.cdr.markForCheck();
          },
          error: (error: Error) => {
            this.isGenerating = false;
            this.notificationService.error(error.message || 'Unable to generate recommendation.');
            this.cdr.markForCheck();
          },
        });
      },
      error: () => {
        // getLatestPrediction already catches internally and resolves to
        // null - this branch only fires on a truly unexpected error, but
        // don't let it block generation entirely.
        this.isGenerating = false;
        this.notificationService.error('Unable to read prediction history for this machine.');
        this.cdr.markForCheck();
      },
    });
  }

  onApprove(decision: RecommendationDecision): void {
    this.recommendationService.approve(decision.id, { note: decision.note }).subscribe({
      next: (updated) => {
        this.recommendation = updated;
        this.notificationService.success(
          updated.resultingMaintenanceId
            ? `Approved. Maintenance task #${updated.resultingMaintenanceId} created.`
            : 'Approved for monitoring - no maintenance task needed yet.'
        );
        this.cdr.markForCheck();
      },
      error: (error: Error) => this.notificationService.error(error.message || 'Unable to approve recommendation.'),
    });
  }

  onReject(decision: RecommendationDecision): void {
    this.recommendationService.reject(decision.id, { note: decision.note }).subscribe({
      next: (updated) => {
        this.recommendation = updated;
        this.notificationService.success('Recommendation rejected.');
        this.cdr.markForCheck();
      },
      error: (error: Error) => this.notificationService.error(error.message || 'Unable to reject recommendation.'),
    });
  }

  onViewMaintenanceTask(maintenanceId: number): void {
    this.router.navigate(['/maintenance', maintenanceId]);
  }

  private deriveFailureProbability(
    machine: Machine,
    latest: { riskLevel?: string } | null
  ): number {
    if (typeof machine.riskScore === 'number') {
      return Math.min(1, Math.max(0, machine.riskScore / 100));
    }
    switch (latest?.riskLevel) {
      case 'CRITICAL':
        return 0.9;
      case 'HIGH':
        return 0.7;
      case 'MEDIUM':
        return 0.5;
      case 'LOW':
        return 0.2;
      default:
        return 0.5;
    }
  }
}
