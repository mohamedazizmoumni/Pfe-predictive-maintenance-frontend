import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Machine } from '../../core/models/machine.model';
import { MaintenanceRecommendationDTO } from '../../core/models/recommendation.model';
import { MachineService } from '../../core/services/machine.service';
import { RecommendationService } from '../../core/services/recommendation.service';
import { NotificationService } from '../../core/services/notification.service';
import { RecommendationCardComponent } from '../../components/recommendation-card/recommendation-card.component';
import { CostComparisonComponent } from '../../components/cost-comparison/cost-comparison.component';
import { MaintenanceCreatePrefill } from '../maintenance/components/maintenance-create/maintenance-create.component';

@Component({
  selector: 'app-recommendation-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    RecommendationCardComponent,
    CostComparisonComponent,
  ],
  templateUrl: './recommendation-page.component.html',
  styleUrl: './recommendation-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationPageComponent implements OnInit {
  machine: Machine | null = null;
  recommendation: MaintenanceRecommendationDTO | null = null;
  isLoading = true;
  selectedMachineId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private machineService: MachineService,
    private recommendationService: RecommendationService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  onScheduleMaintenance(recommendation: MaintenanceRecommendationDTO): void {
    const priorityByUrgency: Record<MaintenanceRecommendationDTO['urgencyLevel'], MaintenanceCreatePrefill['priority']> = {
      CRITICAL: 'CRITICAL',
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
    };

    const prefill: MaintenanceCreatePrefill = {
      machineId: recommendation.machineId,
      title: `${recommendation.recommendedAction} maintenance — ${recommendation.machineName}`,
      description: recommendation.justification,
      priority: priorityByUrgency[recommendation.urgencyLevel],
    };

    this.router.navigate(['/maintenance'], { state: { prefill } });
  }

  ngOnInit(): void {
    const paramValue = this.route.snapshot.paramMap.get('machineId');
    const machineId = paramValue ? Number(paramValue) : null;

    if (machineId) {
      this.selectedMachineId = machineId;
      this.loadRecommendationData(machineId);
      return;
    }

    this.machineService.getAll().subscribe({
      next: (machines) => {
        const firstMachine = machines[0];
        if (!firstMachine) {
          this.isLoading = false;
          this.notificationService.warn('No machines available for recommendations yet.');
          this.cdr.markForCheck();
          return;
        }

        this.selectedMachineId = firstMachine.id;
        this.loadRecommendationData(firstMachine.id);
      },
      error: (error: Error) => {
        this.isLoading = false;
        this.notificationService.error(error.message || 'Unable to load machine list.');
        this.cdr.markForCheck();
      },
    });
  }

  private loadRecommendationData(machineId: number): void {
    forkJoin({
      machine: this.machineService.getById(machineId),
      recommendation: this.recommendationService
        .getLatestRecommendation(machineId)
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ machine, recommendation }) => {
        this.machine = machine;
        this.recommendation = recommendation ?? null;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error: Error) => {
        this.isLoading = false;
        this.notificationService.error(error.message || 'Unable to load recommendation details.');
        this.cdr.markForCheck();
      },
    });
  }
}
