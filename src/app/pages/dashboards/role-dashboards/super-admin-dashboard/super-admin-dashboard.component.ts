import { CommonModule, CurrencyPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AlertApiService } from '../../../../core/services/alert.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FinanceService } from '../../../../core/services/finance.service';
import { MachineService } from '../../../../core/services/machine.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AlertResponse, AlertSeverity, FinanceDashboardStats, Machine } from '../../../../core/models/sentinel.models';
import { BaseDashboardComponent, DashboardBarRow, DashboardKpiCard } from '../../base-dashboard/base-dashboard.component';
import { DASHBOARD_SHELL_STYLES } from '../../base-dashboard/dashboard-shell.styles';
import { ExecutiveSummaryWidgetComponent } from '../../../../shared/executive-summary-widget/executive-summary-widget.component';
import { DashboardCustomizeBarComponent, DashboardWidgetOption } from '../../../../shared/dashboard-customize-bar/dashboard-customize-bar.component';

// Donut/ring chart + refreshed KPI-card treatment, scoped to this component
// only (appended alongside the shared DASHBOARD_SHELL_STYLES below, so other
// role dashboards reusing that same base file are unaffected).
const SUPER_ADMIN_DASHBOARD_EXTRA_STYLES = `
  .health-donut-row {
    display: flex;
    align-items: center;
    gap: 28px;
    flex-wrap: wrap;
  }

  .health-donut {
    position: relative;
    width: 132px;
    height: 132px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .health-donut::before {
    content: '';
    position: absolute;
    inset: 16px;
    border-radius: 50%;
    background: var(--color-bg-elevated, #fff);
  }

  .health-donut-center {
    position: absolute;
    inset: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .health-donut-value {
    font-size: 22px;
    font-weight: 800;
    line-height: 1;
    color: var(--color-text-primary, #0f172a);
  }

  .health-donut-label {
    margin-top: 3px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-text-muted, #94a3b8);
  }

  .health-legend {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
    min-width: 180px;
  }

  .health-legend-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .health-legend-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .health-legend-label {
    flex: 1;
    color: var(--color-text-secondary, #475569);
  }

  .health-legend-value {
    font-weight: 700;
    color: var(--color-text-primary, #0f172a);
  }

  .kpi-card {
    position: relative;
    overflow: hidden;
  }

  .kpi-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--kpi-accent, var(--color-accent, #6b7280));
  }
`;

const SUPER_ADMIN_DASHBOARD_WIDGETS: DashboardWidgetOption[] = [
  { id: 'kpis', label: 'KPI cards' },
  { id: 'health-budget', label: 'System health & budget' },
  { id: 'risk-security', label: 'High-risk machines & security' },
  { id: 'alerts', label: 'Executive alerts' },
];

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, CurrencyPipe, DecimalPipe, ExecutiveSummaryWidgetComponent, DashboardCustomizeBarComponent],
  template: `
    <section class="dashboard-shell">
      <header class="dashboard-header">
        <div>
          <p class="dashboard-eyebrow">Super Admin dashboard</p>
          <h1 class="dashboard-title">Global control center</h1>
          <p class="dashboard-subtitle">Fleet health, security scope, alerts, and budget posture in one executive view.</p>
        </div>
        <div class="dashboard-actions">
          <app-dashboard-customize-bar [widgets]="widgetOptions" dashboardKey="super-admin" (hiddenChange)="hiddenWidgets = $event"></app-dashboard-customize-bar>
          <button class="dashboard-button secondary" type="button" (click)="refresh()">Refresh</button>
          <span class="tone info">Updated {{ lastRefreshAt() ? (lastRefreshAt() | date:'short') : 'just now' }}</span>
        </div>
      </header>

      <div *ngIf="error()" class="dashboard-error">{{ error() }}</div>
      <div *ngIf="loading()" class="empty-state">Loading executive telemetry...</div>

      <app-executive-summary-widget />

      <ng-container *ngIf="!loading()">
        <section class="kpi-grid" *ngIf="!hiddenWidgets.has('kpis')">
          <article
            class="card kpi-card"
            *ngFor="let card of kpiCards()"
            role="group"
            [attr.aria-label]="card.label + ': ' + card.value + (card.note ? ', ' + card.note : '')"
          >
            <p class="dashboard-eyebrow">{{ card.label }}</p>
            <p class="kpi-value">{{ card.value }}</p>
            <p class="kpi-note">{{ card.note }}</p>
          </article>
        </section>

        <section class="split-grid" *ngIf="!hiddenWidgets.has('health-budget')">
          <article class="chart-card">
            <h3>System health distribution</h3>
            <div class="health-donut-row">
              <div class="health-donut" [style.background]="healthDonutGradient()">
                <div class="health-donut-center">
                  <span class="health-donut-value">{{ operationalPercentage() }}%</span>
                  <span class="health-donut-label">Operational</span>
                </div>
              </div>
              <div class="health-legend">
                <div class="health-legend-row" *ngFor="let row of healthRows()">
                  <span class="health-legend-dot" [style.background]="healthDotColor(row.tone)"></span>
                  <span class="health-legend-label">{{ row.label }}</span>
                  <span class="health-legend-value">{{ row.display }}</span>
                </div>
              </div>
            </div>
          </article>

          <article class="summary-card">
            <h3>Budget summary</h3>
            <p class="kpi-value">{{ (financeStats()?.utilizationPercentage || 0) | number:'1.0-0' }}%</p>
            <p class="card-note">All departments · FY {{ financeStats()?.currentYear || nowYear() }}</p>
            <div class="meta-grid">
              <div role="group" [attr.aria-label]="'Allocated: ' + ((financeStats()?.totalBudget || 0) | currency:'TND':'symbol':'1.0-0')">
                <span class="dashboard-eyebrow">Allocated</span>
                <p>{{ (financeStats()?.totalBudget || 0) | currency:'TND':'symbol':'1.0-0' }}</p>
              </div>
              <div role="group" [attr.aria-label]="'Spent: ' + ((financeStats()?.spentAmount || 0) | currency:'TND':'symbol':'1.0-0')">
                <span class="dashboard-eyebrow">Spent</span>
                <p>{{ (financeStats()?.spentAmount || 0) | currency:'TND':'symbol':'1.0-0' }}</p>
              </div>
              <div role="group" [attr.aria-label]="'Remaining: ' + ((financeStats()?.remainingBudget || 0) | currency:'TND':'symbol':'1.0-0')">
                <span class="dashboard-eyebrow">Remaining</span>
                <p>{{ (financeStats()?.remainingBudget || 0) | currency:'TND':'symbol':'1.0-0' }}</p>
              </div>
            </div>
          </article>
        </section>

        <section class="split-grid" *ngIf="!hiddenWidgets.has('risk-security')">
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
              <div class="surface-panel" role="group" [attr.aria-label]="'Primary role: ' + primaryRole()">
                <span class="dashboard-eyebrow">Primary role</span>
                <p>{{ primaryRole() }}</p>
              </div>
              <div class="surface-panel" role="group" [attr.aria-label]="'Role count: ' + roleCount()">
                <span class="dashboard-eyebrow">Role count</span>
                <p>{{ roleCount() }}</p>
              </div>
              <div class="surface-panel" role="group" [attr.aria-label]="'High alerts: ' + highAlertCount()">
                <span class="dashboard-eyebrow">High alerts</span>
                <p>{{ highAlertCount() }}</p>
              </div>
              <div class="surface-panel" role="group" [attr.aria-label]="'Open alerts: ' + alerts().length">
                <span class="dashboard-eyebrow">Open alerts</span>
                <p>{{ alerts().length }}</p>
              </div>
            </div>
          </article>
        </section>

        <section class="table-card" *ngIf="!hiddenWidgets.has('alerts')">
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
  styles: [DASHBOARD_SHELL_STYLES, SUPER_ADMIN_DASHBOARD_EXTRA_STYLES],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuperAdminDashboardComponent extends BaseDashboardComponent implements OnInit {
  readonly widgetOptions = SUPER_ADMIN_DASHBOARD_WIDGETS;
  hiddenWidgets = new Set<string>();

  readonly machines = signal<Machine[]>([]);
  readonly financeStats = signal<FinanceDashboardStats | null>(null);
  readonly alerts = signal<AlertResponse[]>([]);
  readonly currentUser = signal(this.authService.getCurrentUser());

  readonly roleCount = computed(() => this.currentUser()?.roles?.length ?? 0);
  readonly primaryRole = computed(() => this.currentUser()?.roles?.[0]?.name || 'SUPER_ADMIN');

  readonly kpiCards = computed<DashboardKpiCard[]>(() => {
    const total = this.machines().length;
    const operational = this.machines().filter((machine) => this.isStatus(machine, 'OPERATIONAL')).length;
    const maintenance = this.machines().filter((machine) => this.isStatus(machine, 'MAINTENANCE')).length;
    const critical = this.criticalMachines().filter((item) => item.tone === 'critical').length;

    return [
      { label: 'Total machines', value: total, note: 'Complete fleet scope', tone: 'info' },
      { label: 'Operational', value: operational, note: 'Running inside target thresholds', tone: 'good' },
      { label: 'Under maintenance', value: maintenance, note: 'Currently in service windows', tone: 'warning' },
      { label: 'High-risk machines', value: critical, note: 'Immediate executive review', tone: 'critical' },
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

  readonly highAlertCount = computed(() =>
    this.alerts().filter((alert) => alert.severity === AlertSeverity.WARNING || alert.severity === AlertSeverity.CRITICAL).length
  );

  readonly criticalMachines = computed(() =>
    this.machines()
      .map((machine) => {
        const risk = machine.riskScore ?? 0;
        const tone = risk >= 0.7 ? 'critical' : risk >= 0.4 ? 'warning' : 'good';
        return {
          machine,
          status: machine.status || 'UNKNOWN',
          risk: `${Math.round(risk * 100)}%`,
          recommendation:
            tone === 'critical'
              ? 'Schedule immediate inspection'
              : tone === 'warning'
              ? 'Plan preventive maintenance soon'
              : 'Monitor continuously',
          tone,
        };
      })
      .filter((item) => item.tone !== 'good')
      .sort((a, b) => (b.machine.riskScore ?? 0) - (a.machine.riskScore ?? 0))
      .slice(0, 6)
  );

  private static readonly HEALTH_TONE_COLORS: Record<string, string> = {
    good: '#22c55e',
    warning: '#f59e0b',
    critical: '#ef4444',
  };

  readonly healthDonutGradient = computed(() => {
    const rows = this.healthRows();
    let position = 0;
    const segments = rows.map((row) => {
      const start = position;
      position += row.value;
      return `${this.healthDotColor(row.tone)} ${start}% ${position}%`;
    });
    if (position < 100) {
      segments.push(`#e2e8f0 ${position}% 100%`);
    }
    return `conic-gradient(${segments.join(', ')})`;
  });

  readonly operationalPercentage = computed(() => this.healthRows()[0]?.value ?? 0);

  healthDotColor(tone: string): string {
    return SuperAdminDashboardComponent.HEALTH_TONE_COLORS[tone] || '#94a3b8';
  }

  nowYear(): number {
    return new Date().getFullYear();
  }

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
    private readonly financeService: FinanceService,
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

    forkJoin({
      machines: this.machineService.getAll().pipe(catchError(() => of([] as Machine[]))),
      finance: this.financeService.getDashboard().pipe(catchError(() => of(null))),
      alerts: this.alertService.list({ size: 25 }).pipe(catchError(() => of({ content: [] } as { content: AlertResponse[] }))),
    }).subscribe({
      next: ({ machines, finance, alerts }) => {
        this.machines.set(machines);
        this.financeStats.set(finance);
        this.alerts.set(alerts.content ?? []);
        this.endLoad();
      },
      error: () => {
        this.fail('Executive dashboard data could not be loaded.');
        this.notificationService.error('Executive dashboard data could not be loaded.');
      },
    });
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
