import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Machine } from '../../models/machine.model';
import { Recommendation } from '../../models/recommendation.model';
import { Budget } from '../../models/budget.model';
import { MachineService } from '../../services/machine.service';
import { RecommendationService } from '../../services/recommendation.service';
import { BudgetService } from '../../services/budget.service';
import { NotificationService } from '../../services/notification.service';
import { MachineListComponent } from '../../components/machine-list/machine-list.component';
import { BudgetOverviewComponent } from '../../components/budget-overview/budget-overview.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    MatCardModule,
    MatProgressSpinnerModule,
    MachineListComponent,
    BudgetOverviewComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  isLoading = true;
  totalMachines = 0;
  statusBreakdown = {
    RUNNING: 0,
    UNDER_MAINTENANCE: 0,
    FAILED: 0,
  };
  activeAlerts = 0;
  monthlyBudgetUsed = 0;
  estimatedSavings = 0;

  constructor(
    private machineService: MachineService,
    private recommendationService: RecommendationService,
    private budgetService: BudgetService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  budgetUsageClass(percentage: number): string {
    if (percentage > 80) {
      return 'budget-red';
    }

    if (percentage >= 60) {
      return 'budget-orange';
    }

    return 'budget-green';
  }

  private loadDashboardData(): void {
    this.isLoading = true;

    this.machineService.getAllMachines().subscribe({
      next: (machines) => {
        this.totalMachines = machines.length;
        this.statusBreakdown = this.getStatusBreakdown(machines);
        this.loadRecommendationsAndBudget(machines);
      },
      error: (error: Error) => {
        this.isLoading = false;
        this.notificationService.error(error.message || 'Failed to load dashboard data.');
        this.cdr.markForCheck();
      },
    });
  }

  private loadRecommendationsAndBudget(machines: Machine[]): void {
    const recommendationCalls = machines.map((machine) =>
      this.recommendationService
        .getLatestRecommendation(machine.id)
        .pipe(catchError(() => of(null as Recommendation | null)))
    );

    forkJoin({
      recommendations: recommendationCalls.length
        ? forkJoin(recommendationCalls)
        : of([] as Array<Recommendation | null>),
      budget: this.budgetService
        .getBudgetStatus('Operations', '2026-MONTHLY')
        .pipe(catchError(() => of(null as Budget | null))),
    }).subscribe({
      next: ({ recommendations, budget }) => {
        this.activeAlerts = recommendations.filter(
          (item) => item?.urgencyLevel === 'HIGH' || item?.urgencyLevel === 'CRITICAL'
        ).length;

        this.estimatedSavings = recommendations.reduce((sum, item) => {
          return sum + (item?.estimatedSavings ?? 0);
        }, 0);

        this.monthlyBudgetUsed = budget?.percentageUsed ?? 0;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.notificationService.error('Some dashboard metrics could not be loaded.');
        this.cdr.markForCheck();
      },
    });
  }

  private getStatusBreakdown(machines: Machine[]) {
    return machines.reduce(
      (accumulator, machine) => {
        accumulator[machine.status] += 1;
        return accumulator;
      },
      {
        RUNNING: 0,
        UNDER_MAINTENANCE: 0,
        FAILED: 0,
      }
    );
  }
}