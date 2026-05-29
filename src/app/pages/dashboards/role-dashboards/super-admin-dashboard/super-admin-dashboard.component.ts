import { CommonModule, CurrencyPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AlertApiService } from '../../../../core/services/alert.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BudgetService } from '../../../../core/services/budget.service';
import { MachineService } from '../../../../core/services/machine.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { RecommendationService } from '../../../../core/services/recommendation.service';
import { AlertResponse, Machine } from '../../../../core/models/sentinel.models';
import { MaintenanceBudgetDTO } from '../../../../core/models/budget.model';
import { MaintenanceRecommendationDTO } from '../../../../core/models/recommendation.model';
import { BaseDashboardComponent, DashboardBarRow, DashboardKpiCard } from '../../base-dashboard/base-dashboard.component';
import { DASHBOARD_SHELL_STYLES } from '../../base-dashboard/dashboard-shell.styles';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, CurrencyPipe, DecimalPipe],
  template: `
    <section class="dashboard-shell">
      <header class="dashboard-header">
        <div>
          <p class="dashboard-eyebrow">Super Admin dashboard</p>
          <h1 class="dashboard-title">Global control center</h1>
          <p class="dashboard-subtitle">Fleet health, security scope, alerts, and budget posture in one executive view.</p>
        </div>
        <div class="dashboard-actions">
          <button class="dashboard-button secondary" type="button" (click)="refresh()">Refresh</button>
          <span class="tone info">Updated {{ lastRefreshAt() ? (lastRefreshAt() | date:'short') : 'just now' }}</span>
        </div>
      </header>

      <div *ngIf="error()" class="dashboard-error">{{ error() }}</div>
      <div *ngIf="loading()" class="empty-state">Loading executive telemetry...</div>

      <ng-container *ngIf="!loading()">
        <section class="kpi-grid">
          <article class="card kpi-card" *ngFor="let card of kpiCards()">
            <p class="dashboard-eyebrow">{{ card.label }}</p>
            <p class="kpi-value">{{ card.value }}</p>
            <p class="kpi-note">{{ card.note }}</p>
          </article>
        </section>

        <section class="split-grid">
          <article class="chart-card">
            <h3>System health distribution</h3>
            <div class="chart-bars">
              <div class="chart-row" *ngFor="let row of healthRows()">
                <strong>{{ row.label }}</strong>
                <div class="chart-track"><div class="chart-fill" [style.width.%]="row.value"></div></div>
                <span>{{ row.display }}</span>
              </div>
            </div>
          </article>

          <article class="summary-card">
            <h3>Budget summary</h3>
            <p class="kpi-value">{{ (budget()?.percentageUsed || 0) | number:'1.0-0' }}%</p>
            <p class="card-note">{{ budget()?.department || 'Operations' }} · {{ budget()?.period || currentPeriod() }}</p>
            <div class="meta-grid">
              <div>
                <span class="dashboard-eyebrow">Allocated</span>
                <p>{{ (budget()?.allocatedAmount || 0) | currency:'USD':'symbol':'1.0-0' }}</p>
              </div>
              <div>
                <span class="dashboard-eyebrow">Spent</span>
                <p>{{ (budget()?.spentAmount || 0) | currency:'USD':'symbol':'1.0-0' }}</p>
              </div>
              <div>
                <span class="dashboard-eyebrow">Remaining</span>
                <p>{{ (budget()?.remainingAmount || 0) | currency:'USD':'symbol':'1.0-0' }}</p>
              </div>
            </div>
          </article>
        </section>

        <section class="split-grid">
          <article class="table-card">
            <h3>High-risk machines</h3>
            <table class="list-table" *ngIf="criticalMachines().length; else noMachines">
              <thead>
                <tr><th>Machine</th><th>Status</th><th>Risk</th><th>Recommendation</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of criticalMachines()">
                  <td>{{ item.machine.name }}</td>
                  <td><span class="tone" [class.critical]="item.tone === 'critical'" [class.warning]="item.tone === 'warning'" [class.good]="item.tone === 'good'">{{ item.status }}</span></td>
                  <td>{{ item.risk }}</td>
                  <td>{{ item.recommendation }}</td>
                </tr>
              </tbody>
            </table>
            <ng-template #noMachines>
              <div class="empty-state">No active machine risk is currently flagged.</div>
            </ng-template>
          </article>

          <article class="table-card">
            <h3>Security and access snapshot</h3>
            <div class="meta-grid">
              <div class="surface-panel">
                <span class="dashboard-eyebrow">Primary role</span>
                <p>{{ primaryRole() }}</p>
              </div>
              <div class="surface-panel">
                <span class="dashboard-eyebrow">Role count</span>
                <p>{{ roleCount() }}</p>
              </div>
              <div class="surface-panel">
                <span class="dashboard-eyebrow">High alerts</span>
                <p>{{ highAlertCount() }}</p>
              </div>
              <div class="surface-panel">
                <span class="dashboard-eyebrow">Savings potential</span>
                <p>{{ totalSavings() | currency:'USD':'symbol':'1.0-0' }}</p>
              </div>
            </div>
          </article>
        </section>

        <section class="table-card">
          <h3>Executive alerts</h3>
          <table class="list-table" *ngIf="alertRows().length; else noAlerts">
            <thead>
              <tr><th>Title</th><th>Machine</th><th>Severity</th><th>Age</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let alert of alertRows()">
                <td>{{ alert.title }}</td>
                <td>{{ alert.machine }}</td>
                <td><span class="tone" [class.critical]="alert.tone === 'critical'" [class.warning]="alert.tone === 'warning'" [class.good]="alert.tone === 'good'" [class.info]="alert.tone === 'info'">{{ alert.severity }}</span></td>
                <td>{{ alert.age }}</td>
              </tr>
            </tbody>
          </table>
          <ng-template #noAlerts>
            <div class="empty-state">No alerts were returned for the executive view.</div>
          </ng-template>
        </section>
      </ng-container>
    </section>
  `,
  styles: [DASHBOARD_SHELL_STYLES],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuperAdminDashboardComponent extends BaseDashboardComponent implements OnInit {
  readonly machines = signal<Machine[]>([]);
  readonly budget = signal<MaintenanceBudgetDTO | null>(null);
  readonly recommendations = signal<MaintenanceRecommendationDTO[]>([]);
  readonly alerts = signal<AlertResponse[]>([]);
  readonly currentUser = signal(this.authService.getCurrentUser());

  readonly roleCount = computed(() => this.currentUser()?.roles?.length ?? 0);
  readonly primaryRole = computed(() => this.currentUser()?.roles?.[0]?.name || 'SUPER_ADMIN');

  readonly kpiCards = computed<DashboardKpiCard[]>(() => {
    const total = this.machines().length;
    const operational = this.machines().filter((machine) => this.isStatus(machine, 'OPERATIONAL')).length;
    const maintenance = this.machines().filter((machine) => this.isStatus(machine, 'MAINTENANCE')).length;
    const critical = this.recommendations().filter((item) => item.urgencyLevel === 'CRITICAL').length;

    return [
      { label: 'Total machines', value: total, note: 'Complete fleet scope', tone: 'info' },
      { label: 'Operational', value: operational, note: 'Running inside target thresholds', tone: 'good' },
      { label: 'Under maintenance', value: maintenance, note: 'Currently in service windows', tone: 'warning' },
      { label: 'Critical recommendations', value: critical, note: 'Immediate executive review', tone: 'critical' },
    ];
  });

  readonly healthRows = computed<DashboardBarRow[]>(() => {
    const total = Math.max(1, this.machines().length);
    const operational = this.machines().filter((machine) => this.isStatus(machine, 'OPERATIONAL')).length;
    const maintenance = this.machines().filter((machine) => this.isStatus(machine, 'MAINTENANCE')).length;
    const faulty = this.machines().filter((machine) => this.isStatus(machine, 'FAULTY')).length;

    return [
      { label: 'Operational', value: Math.round((operational / total) * 100), display: `${operational}/${total}`, tone: 'good' },
      { label: 'Maintenance', value: Math.round((maintenance / total) * 100), display: `${maintenance}/${total}`, tone: 'warning' },
      { label: 'Faulty', value: Math.round((faulty / total) * 100), display: `${faulty}/${total}`, tone: 'critical' },
    ];
  });

  readonly totalSavings = computed(() =>
    this.recommendations().reduce((sum, item) => sum + (item.estimatedSavings ?? 0), 0)
  );

  readonly highAlertCount = computed(() =>
    this.recommendations().filter((item) => item.urgencyLevel === 'HIGH' || item.urgencyLevel === 'CRITICAL').length
  );

  readonly criticalMachines = computed(() =>
    this.machines()
      .map((machine) => {
        const recommendation = this.recommendations().find((item) => item.machineId === machine.id);
        const severity = recommendation?.urgencyLevel ?? 'LOW';
        return {
          machine,
          status: machine.status || 'UNKNOWN',
          risk: `${Math.round((machine.riskScore ?? 0) * 100)}%`,
          recommendation: recommendation?.justification || 'Monitor continuously',
          tone: severity === 'CRITICAL' ? 'critical' : severity === 'HIGH' ? 'warning' : 'good',
        };
      })
      .filter((item) => item.tone !== 'good')
      .slice(0, 6)
  );

  readonly alertRows = computed(() =>
    this.alerts().slice(0, 6).map((alert) => ({
      title: alert.title,
      machine: alert.machineSerial || String(alert.machineId),
      severity: alert.severity,
      age: this.getAgeLabel(alert.createdDate),
      tone: alert.severity === 'CRITICAL' ? 'critical' : alert.severity === 'WARNING' ? 'warning' : 'info',
    }))
  );

  constructor(
    private readonly machineService: MachineService,
    private readonly budgetService: BudgetService,
    private readonly recommendationService: RecommendationService,
    private readonly alertService: AlertApiService,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService
  ) {
    super();
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  refresh(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.beginLoad();
    const period = this.currentPeriod();
    const department = this.currentDepartment();

    this.machineService
      .getAll()
      .pipe(
        catchError(() => of([] as Machine[])),
        switchMap((machines) => {
          this.machines.set(machines);
          const recommendationCalls = machines.slice(0, 10).map((machine) =>
            this.recommendationService.getLatestRecommendation(machine.id).pipe(catchError(() => of(null)))
          );

          return forkJoin({
            budget: this.budgetService.getBudgetStatus(department, period).pipe(catchError(() => of(null))),
            alerts: this.alertService.list({ size: 25 }).pipe(catchError(() => of({ content: [] } as { content: AlertResponse[] }))),
            recommendations: recommendationCalls.length ? forkJoin(recommendationCalls) : of([] as Array<MaintenanceRecommendationDTO | null>),
          });
        })
      )
      .subscribe({
        next: ({ budget, alerts, recommendations }) => {
          this.budget.set((budget as MaintenanceBudgetDTO | null) ?? null);
          this.alerts.set(alerts.content ?? []);
          this.recommendations.set((recommendations ?? []).filter((item): item is MaintenanceRecommendationDTO => !!item));
          this.endLoad();
        },
        error: () => {
          this.fail('Executive dashboard data could not be loaded.');
          this.notificationService.error('Executive dashboard data could not be loaded.');
        },
      });
  }

  private currentDepartment(): string {
    return this.authService.getCurrentUser()?.department || 'Operations';
  }

  currentPeriod(): string {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${quarter}`;
  }

  private isStatus(machine: Machine, expected: string): boolean {
    return (machine.status || '').toUpperCase() === expected;
  }

  private getAgeLabel(createdDate: string): string {
    const created = new Date(createdDate);
    const hours = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60)));
    if (hours < 24) {
      return `${hours}h ago`;
    }
    return `${Math.floor(hours / 24)}d ago`;
  }
}
