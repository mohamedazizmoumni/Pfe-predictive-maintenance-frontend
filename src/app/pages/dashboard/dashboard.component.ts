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
    OPERATIONAL: 0,
    MAINTENANCE: 0,
    FAULTY: 0,
    DECOMMISSIONED: 0,
  };
  activeAlerts = 0;
  monthlyBudgetUsed = 0;
  estimatedSavings = 0;
  maintenanceLoad = 0;
  healthScore = 0;
  lastRefreshAt: Date | null = null;
  budgetSnapshot: Budget | null = null;
  healthTrendPoints = '';
  activityFeed: Array<{ title: string; detail: string; time: string; tone: 'info' | 'warning' | 'critical' }> = [];

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
        this.healthScore = this.totalMachines
          ? Math.round((this.statusBreakdown.OPERATIONAL / this.totalMachines) * 100)
          : 0;
        this.maintenanceLoad = this.totalMachines
          ? Math.round((this.statusBreakdown.MAINTENANCE / this.totalMachines) * 100)
          : 0;
        this.activityFeed = this.buildActivityFeed(machines);
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
        .getBudgetStatus('Workshop A', '2025-Q2')
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
        this.budgetSnapshot = budget;
        this.healthTrendPoints = this.buildSparklinePoints(this.buildHealthTrend());
        this.lastRefreshAt = new Date();
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
        const normalized = (machine.status || '').toUpperCase();
        if (normalized === 'MAINTENANCE') {
          accumulator.MAINTENANCE += 1;
        } else if (normalized === 'OPERATIONAL') {
          accumulator.OPERATIONAL += 1;
        } else if (normalized === 'FAULTY') {
          accumulator.FAULTY += 1;
        } else if (normalized === 'DECOMMISSIONED') {
          accumulator.DECOMMISSIONED += 1;
        }
        return accumulator;
      },
      {
        OPERATIONAL: 0,
        MAINTENANCE: 0,
        FAULTY: 0,
        DECOMMISSIONED: 0,
      }
    );
  }

  private buildActivityFeed(machines: Machine[]) {
    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const failed = machines.filter((m) => this.isFaultyStatus(m.status)).slice(0, 2);
    const maintenance = machines.filter((m) => this.isMaintenanceStatus(m.status)).slice(0, 2);
    const running = machines.filter((m) => this.isOperationalStatus(m.status)).slice(0, 1);
    const items: Array<{ title: string; detail: string; time: string; tone: 'info' | 'warning' | 'critical' }> = [];

    failed.forEach((machine) =>
      items.push({
        title: 'Failure detected',
        detail: `${machine.name} marked FAULTY`,
        time: timeLabel,
        tone: 'critical',
      })
    );

    maintenance.forEach((machine) =>
      items.push({
        title: 'Maintenance underway',
        detail: `${machine.name} currently under maintenance`,
        time: timeLabel,
        tone: 'warning',
      })
    );

    if (running.length && items.length < 4) {
      items.push({
        title: 'Operational update',
        detail: `${running[0].name} running within target thresholds`,
        time: timeLabel,
        tone: 'info',
      });
    }

    if (items.length === 0) {
      items.push({
        title: 'Systems nominal',
        detail: 'No critical incidents reported during this cycle',
        time: timeLabel,
        tone: 'info',
      });
    }

    return items.slice(0, 4);
  }

  private isOperationalStatus(status?: string): boolean {
    const normalized = (status || '').toUpperCase();
    return normalized === 'OPERATIONAL';
  }

  private isMaintenanceStatus(status?: string): boolean {
    const normalized = (status || '').toUpperCase();
    return normalized === 'MAINTENANCE';
  }

  private isFaultyStatus(status?: string): boolean {
    const normalized = (status || '').toUpperCase();
    return normalized === 'FAULTY';
  }

  private buildHealthTrend(): number[] {
    const base = this.healthScore || 72;
    return [
      Math.max(40, base - 18),
      Math.max(42, base - 12),
      Math.max(45, base - 8),
      Math.max(50, base - 4),
      base,
      Math.min(95, base + 6),
      Math.min(98, base + 10),
    ];
  }

  private buildSparklinePoints(values: number[]): string {
    if (!values.length) {
      return '';
    }

    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(1, max - min);
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * 100;
        const y = 40 - ((value - min) / range) * 32;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }
}