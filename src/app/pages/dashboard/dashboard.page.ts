import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { AsyncPipe, CurrencyPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import {
  Machine,
  MaintenanceRecommendationDTO,
} from '../../core/models';
import { MachineService } from '../../core/services/machine.service';
import { RecommendationService } from '../../core/services/recommendation.service';
import { BudgetService } from '../../core/services/budget.service';
import { NotificationService } from '../../core/services/notification.service';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { MachineListComponent } from '../../components/machine-list/machine-list.component';
import { BudgetOverviewComponent } from '../../components/budget-overview/budget-overview.component';
import { RecommendationCardComponent } from '../../components/recommendation-card/recommendation-card.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    StatCardComponent,
    MachineListComponent,
    BudgetOverviewComponent,
    RecommendationCardComponent,
    MatProgressSpinnerModule,
    NgIf,
    NgFor,
    DecimalPipe,
    CurrencyPipe,
    AsyncPipe,
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  readonly machines = signal<Machine[]>([]);
  readonly totalMachines = computed(() => this.machines().length);
  readonly runningCount = computed(
    () => this.machines().filter((m) => this.isOperationalStatus(m.status)).length
  );
  readonly failedCount = computed(
    () => this.machines().filter((m) => this.isFaultyStatus(m.status)).length
  );
  readonly maintenanceCount = computed(
    () => this.machines().filter((m) => this.isMaintenanceStatus(m.status)).length
  );
  readonly loading = signal(false);
  readonly recommendations = signal<MaintenanceRecommendationDTO[]>([]);
  readonly criticalAlerts = computed(
    () =>
      this.recommendations().filter(
        (r) => r.urgencyLevel === 'CRITICAL' || r.urgencyLevel === 'HIGH'
      ).length
  );
  readonly totalSavings = computed(() =>
    this.recommendations().reduce((sum, r) => sum + (r.estimatedSavings ?? 0), 0)
  );

  constructor(
    private readonly machineService: MachineService,
    private readonly recommendationService: RecommendationService,
    private readonly budgetService: BudgetService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loading.set(true);

    this.machineService
      .getAll()
      .pipe(
        switchMap((machines) => {
          this.machines.set(machines);

          const machineIds = machines
            .map((machine) => machine.id)
            .filter((id): id is number => id !== undefined && id !== null);

          if (machineIds.length === 0) {
            return of([] as MaintenanceRecommendationDTO[][]);
          }

          // Each call returns MaintenanceRecommendationDTO[] — one array per machine.
          // catchError per call so a single 500 doesn't cancel all others.
          return forkJoin(
            machineIds.map((id) =>
              this.recommendationService
                .getForMachine(id)
                .pipe(catchError(() => of([] as MaintenanceRecommendationDTO[])))
            )
          );
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        // recs is MaintenanceRecommendationDTO[][] — flatten to a single list
        next: (recs) => {
          const flat = (recs as MaintenanceRecommendationDTO[][]).flat();
          this.recommendations.set(flat);
        },
        error: () => {
          this.notificationService.error('Failed to load dashboard data');
          this.recommendations.set([]);
        },
      });
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
}