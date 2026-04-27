import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Machine } from '../../models/machine.model';
import { Recommendation } from '../../models/recommendation.model';
import { MachineService } from '../../services/machine.service';
import { RecommendationService } from '../../services/recommendation.service';
import { NotificationService } from '../../services/notification.service';
import { RecommendationCardComponent } from '../../components/recommendation-card/recommendation-card.component';
import { CostComparisonComponent } from '../../components/cost-comparison/cost-comparison.component';

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
  recommendation: Recommendation | null = null;
  isLoading = true;
  selectedMachineId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private machineService: MachineService,
    private recommendationService: RecommendationService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const paramValue = this.route.snapshot.paramMap.get('machineId');
    const machineId = paramValue ? Number(paramValue) : null;

    if (machineId) {
      this.selectedMachineId = machineId;
      this.loadRecommendationData(machineId);
      return;
    }

    this.machineService.getAllMachines().subscribe({
      next: (machines) => {
        const firstMachine = machines[0];
        if (!firstMachine) {
          this.isLoading = false;
          this.notificationService.info('No machines available for recommendations yet.');
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
      machine: this.machineService.getMachineById(machineId),
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
