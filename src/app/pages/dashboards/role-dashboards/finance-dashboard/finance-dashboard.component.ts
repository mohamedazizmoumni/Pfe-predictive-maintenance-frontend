import {
  CommonModule,
  CurrencyPipe,
  DecimalPipe,
  NgClass,
  NgFor,
  NgIf,
} from '@angular/common';

import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';

import { Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';

import { FinanceService } from '../../../../core/services/finance.service';
import { NotificationService } from '../../../../core/services/notification.service';

import {
  ExpenseCategory,
  ExpenseReportResponse,
  ExpenseStatus,
  FinanceDashboardStats,
} from '../../../../core/models/sentinel.models';

import { BaseDashboardComponent } from '../../base-dashboard/base-dashboard.component';

interface CategoryRow {
  key: string;
  label: string;
  icon: string;
  amount: number;
  pct: number;
}

interface ApprovalRow {
  vendor: string;
  amount: number;
  status: string;
  time: string;
}

interface InsightRow {
  tone: 'warning' | 'blue' | 'green';
  text: string;
}

@Component({
  selector: 'app-finance-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, NgClass, CurrencyPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="finance-dashboard">
      <header class="dashboard-header">
        <div>
          <p class="eyebrow">Financial Operations Center</p>
          <h1>Finance Command Dashboard</h1>
          <p class="subtitle">
            Real-time budget intelligence, cost forecasting,
            and operational financial control.
          </p>
        </div>

        <div class="header-actions">
          <div class="status-pill green">{{ budgetStatusLabel() }}</div>
          <div class="status-pill yellow">{{ forecastStatusLabel() }}</div>
          <div class="status-pill blue">{{ liveDataLabel() }}</div>

          <button
            class="refresh-btn"
            (click)="refresh()"
            [disabled]="loading()"
          >
            {{ loading() ? 'Refreshing…' : '↻ Refresh Data' }}
          </button>
        </div>
      </header>

      <div *ngIf="error()" class="error-box">
        {{ error() }}
      </div>

      <div *ngIf="loading()" class="loading-box">
        Loading finance telemetry...
      </div>

      <ng-container *ngIf="dashboard() as d">
        <section class="hero-grid">
          <article class="hero-card primary">
            <span class="hero-label">Total Budget</span>
            <h2>TND{{ totalBudget() | number:'1.3-3' }}</h2>
            <p class="positive">{{ budgetTrendLabel() }}</p>
          </article>

          <article class="hero-card">
            <span class="hero-label">Spent</span>
            <h2>TND{{ spentAmount() | number:'1.3-3' }}</h2>
            <p class="neutral">{{ utilizationPercentage() | number:'1.0-0' }}% used</p>
          </article>

          <article class="hero-card">
            <span class="hero-label">Remaining</span>
            <h2>TND{{ remainingBudget() | number:'1.3-3' }}</h2>
            <p class="positive">{{ remainingBudgetLabel() }}</p>
          </article>

          <article class="hero-card">
            <span class="hero-label">Pending Expenses</span>
            <h2>{{ pendingApprovalsTotal() }}</h2>
            <p class="negative">TND{{ pendingApprovalsAmount() | number:'1.3-3' }}</p>
          </article>
        </section>

        <section class="dashboard-grid">
          <article class="glass-card budget-card">
            <div class="section-header">
              <h3>Budget Health Overview</h3>
            </div>

            <div class="budget-circle">
              <svg viewBox="0 0 120 120">
                <circle class="bg" cx="60" cy="60" r="52"></circle>
                <circle
                  class="progress"
                  cx="60"
                  cy="60"
                  r="52"
                  [style.stroke]="budgetStrokeColor()"
                  [style.strokeDashoffset]="327 - (327 * utilizationPercentage()) / 100"
                ></circle>
              </svg>

              <div class="budget-center">
                <strong>{{ utilizationPercentage() | number:'1.0-0' }}%</strong>
              </div>
            </div>

            <div class="budget-stats">
              <div>
                <span>Spent</span>
                <strong>TND{{ spentAmount() | number:'1.3-3' }}</strong>
              </div>

              <div>
                <span>Remaining</span>
                <strong>TND{{ remainingBudget() | number:'1.3-3' }}</strong>
              </div>
            </div>
          </article>

          <article class="glass-card">
            <div class="section-header">
              <h3>Financial Risk Insights</h3>
            </div>

            <div class="insight-list">
              <div
                class="insight"
                *ngFor="let insight of insightRows()"
                [ngClass]="insight.tone"
              >
                {{ insight.text }}
              </div>
            </div>
          </article>

          <article class="glass-card">
            <div class="section-header">
              <h3>Spending Breakdown</h3>
            </div>

            <div class="category-list">
              <div class="category-row" *ngFor="let row of categoryRows()">
                <div class="category-left">
                  <span class="icon">{{ row.icon }}</span>
                  <div>
                    <strong>{{ row.label }}</strong>
                    <div class="bar-track">
                      <div class="bar-fill" [style.width.%]="row.pct"></div>
                    </div>
                  </div>
                </div>

                <span class="amount">TND{{ row.amount | number:'1.3-3' }}</span>
              </div>
            </div>
          </article>

          <article class="glass-card">
            <div class="section-header">
              <h3>Pending Approvals</h3>
            </div>

            <div class="approval-list">
              <div class="approval-row" *ngFor="let row of approvalRows()">
                <div>
                  <strong>{{ row.vendor }}</strong>
                  <p>{{ row.status }}</p>
                </div>

                <div class="approval-right">
                  <strong>TND{{ row.amount | number:'1.3-3' }}</strong>
                  <span>{{ row.time }}</span>
                </div>
              </div>
            </div>
          </article>
        </section>
      </ng-container>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      padding: 24px;
      background:
        radial-gradient(circle at top right, rgba(0,224,255,.10), transparent 25%),
        radial-gradient(circle at top left, rgba(139,92,246,.10), transparent 25%),
        #020617;
      color: white;
      font-family: Inter, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }

    .eyebrow {
      color: #38bdf8;
      font-size: 13px;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    h1 {
      margin: 0;
      font-size: 38px;
      font-weight: 800;
    }

    .subtitle {
      color: #94a3b8;
      margin-top: 12px;
      max-width: 700px;
      line-height: 1.6;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .status-pill,
    .refresh-btn {
      height: 42px;
      padding: 0 18px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      font-size: 13px;
      font-weight: 600;
    }

    .green {
      color: #22c55e;
    }

    .yellow {
      color: #fbbf24;
    }

    .blue {
      color: #38bdf8;
    }

    .refresh-btn {
      color: white;
      cursor: pointer;
    }

    .refresh-btn:disabled {
      cursor: progress;
      opacity: .7;
    }

    .hero-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 24px;
    }

    .hero-card {
      padding: 24px;
      border-radius: 24px;
      background:
        linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.98));
      border: 1px solid rgba(255,255,255,.06);
      box-shadow: 0 10px 40px rgba(0,0,0,.35);
    }

    .hero-card.primary {
      background:
        linear-gradient(135deg, rgba(6,182,212,.25), rgba(139,92,246,.15));
    }

    .hero-label {
      display: block;
      margin-bottom: 12px;
      color: #94a3b8;
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .hero-card h2 {
      margin: 0;
      font-size: 34px;
      font-weight: 800;
    }

    .positive {
      color: #22c55e;
      margin-top: 12px;
    }

    .negative {
      color: #ef4444;
      margin-top: 12px;
    }

    .neutral {
      color: #38bdf8;
      margin-top: 12px;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }

    .glass-card {
      padding: 24px;
      border-radius: 24px;
      background:
        linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.98));
      border: 1px solid rgba(255,255,255,.06);
      min-height: 320px;
    }

    .section-header {
      margin-bottom: 24px;
    }

    .section-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
    }

    .budget-circle {
      position: relative;
      width: 220px;
      height: 220px;
      margin: auto;
    }

    .budget-circle svg {
      width: 220px;
      height: 220px;
      transform: rotate(-90deg);
    }

    .budget-circle circle {
      fill: none;
      stroke-width: 10;
    }

    .budget-circle .bg {
      stroke: rgba(255,255,255,.08);
    }

    .budget-circle .progress {
      stroke-linecap: round;
      stroke-dasharray: 327;
      transition: .4s ease;
    }

    .budget-center {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .budget-center strong {
      font-size: 42px;
      font-weight: 800;
    }

    .budget-stats {
      display: flex;
      justify-content: space-between;
      margin-top: 26px;
    }

    .budget-stats span {
      display: block;
      color: #94a3b8;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .insight-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .insight {
      padding: 18px;
      border-radius: 18px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.05);
      font-weight: 500;
    }

    .insight.warning {
      border-left: 3px solid #f59e0b;
    }

    .insight.blue {
      border-left: 3px solid #38bdf8;
    }

    .insight.green {
      border-left: 3px solid #22c55e;
    }

    .category-list {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .category-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .category-left {
      display: flex;
      gap: 14px;
      align-items: center;
      flex: 1;
    }

    .icon {
      font-size: 22px;
    }

    .bar-track {
      width: 260px;
      height: 8px;
      border-radius: 999px;
      background: rgba(255,255,255,.08);
      overflow: hidden;
      margin-top: 8px;
    }

    .bar-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #06b6d4, #8b5cf6);
    }

    .amount {
      font-weight: 700;
    }

    .approval-list {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .approval-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 18px;
      border-bottom: 1px solid rgba(255,255,255,.05);
    }

    .approval-row p {
      color: #94a3b8;
      margin-top: 6px;
      font-size: 13px;
    }

    .approval-right {
      text-align: right;
    }

    .approval-right span {
      display: block;
      margin-top: 6px;
      color: #64748b;
      font-size: 12px;
    }

    .loading-box,
    .error-box {
      padding: 20px;
      border-radius: 18px;
      background: rgba(255,255,255,.04);
      margin-bottom: 20px;
    }

    .error-box {
      color: #ef4444;
    }

    @media (max-width: 1200px) {
      .hero-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .hero-grid {
        grid-template-columns: 1fr;
      }

      .dashboard-header {
        flex-direction: column;
      }

      h1 {
        font-size: 30px;
      }
    }
  `],
})
export class FinanceDashboardComponent
  extends BaseDashboardComponent
  implements OnInit, OnDestroy {

  private readonly destroy$ = new Subject<void>();

  readonly dashboard = signal<FinanceDashboardStats | null>(null);
  readonly pendingExpenses = signal<ExpenseReportResponse[]>([]);

  readonly totalBudget = computed(() => this.dashboard()?.totalBudget ?? 0);
  readonly spentAmount = computed(() => this.dashboard()?.spentAmount ?? 0);
  readonly remainingBudget = computed(() => this.dashboard()?.remainingBudget ?? 0);
  readonly utilizationPercentage = computed(() => this.dashboard()?.utilizationPercentage ?? 0);
  readonly pendingApprovalsTotal = computed(() => this.dashboard()?.pendingCount ?? this.pendingExpenses().length);
  readonly pendingApprovalsAmount = computed(() => this.dashboard()?.pendingAmount ?? this.pendingExpenses().reduce((sum, item) => sum + (item.amount || 0), 0));

  readonly categoryRows = computed(() => {
    const entries = Object.entries(this.dashboard()?.expensesByCategory ?? {});
    const iconMap: Record<string, string> = {
      [ExpenseCategory.MAINTENANCE]: '🔧',
      [ExpenseCategory.PARTS]: '⚙️',
      [ExpenseCategory.LABOR]: '👷',
      [ExpenseCategory.EQUIPMENT]: '🏭',
      [ExpenseCategory.OTHER]: '📦',
    };
    const labelMap: Record<string, string> = {
      [ExpenseCategory.MAINTENANCE]: 'Maintenance',
      [ExpenseCategory.PARTS]: 'Parts',
      [ExpenseCategory.LABOR]: 'Labor',
      [ExpenseCategory.EQUIPMENT]: 'Equipment',
      [ExpenseCategory.OTHER]: 'Other',
    };
    const total = entries.reduce((sum, [, amount]) => sum + amount, 0) || 1;

    return entries
      .map(([key, amount]) => ({
        key,
        label: labelMap[key] ?? key,
        icon: iconMap[key] ?? '📄',
        amount,
        pct: Math.round((amount / total) * 100),
      }))
      .sort((a, b) => b.amount - a.amount);
  });

  readonly approvalRows = computed<ApprovalRow[]>(() =>
    this.pendingExpenses()
      .slice(0, 4)
      .map((expense) => ({
        vendor: expense.title || expense.machineName || expense.submittedByName,
        amount: expense.amount,
        status: `${this.formatExpenseStatus(expense.status)} • ${expense.category}`,
        time: this.formatRelativeTime(expense.createdDate),
      }))
  );

  readonly insightRows = computed<InsightRow[]>(() => {
    const utilization = this.utilizationPercentage();
    const pendingCount = this.pendingApprovalsTotal();
    const approvedCount = this.dashboard()?.approvedCount ?? 0;

    const rows: InsightRow[] = [];

    if (utilization >= 100) {
      rows.push({ tone: 'warning', text: `Budget exhausted at ${utilization.toFixed(0)}% utilization.` });
    }
    else if (utilization >= 85) {
      rows.push({ tone: 'warning', text: `Budget is critically low at ${utilization.toFixed(0)}% utilization.` });
    }
    else if (utilization >= 60) {
      rows.push({ tone: 'blue', text: `Budget is under watch at ${utilization.toFixed(0)}% utilization.` });
    }
    else {
      rows.push({ tone: 'green', text: `Budget remains healthy at ${utilization.toFixed(0)}% utilization.` });
    }

    rows.push({
      tone: 'blue',
      text: `${pendingCount} pending expense${pendingCount === 1 ? '' : 's'} worth TND${this.pendingApprovalsAmount().toFixed(3)} waiting for review.`,
    });

    rows.push({
      tone: 'green',
      text: `${approvedCount} expense${approvedCount === 1 ? '' : 's'} already approved this period.`,
    });

    return rows;
  });

  readonly budgetStatusLabel = computed(() => {
    const utilization = this.utilizationPercentage();
    if (!this.dashboard()) return 'Budget Syncing';
    if (utilization >= 100) return 'Budget Exhausted';
    if (utilization >= 85) return 'Budget Critical';
    if (utilization >= 60) return 'Budget Watch';
    return 'Budget Healthy';
  });

  readonly forecastStatusLabel = computed(() => {
    const utilization = this.utilizationPercentage();
    const pending = this.pendingApprovalsTotal();

    if (!this.dashboard()) return 'Forecast Syncing';
    if (utilization >= 85 || pending >= 10) return 'High Risk Forecast';
    if (utilization >= 60 || pending >= 5) return 'Medium Risk Forecast';
    return 'Low Risk Forecast';
  });

  readonly liveDataLabel = computed(() => this.lastRefreshAt() ? '📊 Live Data Active' : '📊 AI Tracking Active');

  readonly budgetTrendLabel = computed(() => {
    const utilization = this.utilizationPercentage();
    if (utilization >= 100) return 'Over budget pressure';
    if (utilization >= 85) return 'Capital reserve tightening';
    if (utilization >= 60) return 'Spending under control';
    return 'Healthy reserve';
  });

  readonly remainingBudgetLabel = computed(() => this.remainingBudget() > 0 ? 'Healthy Reserve' : 'Over Budget');

  constructor(
    private readonly financeService: FinanceService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.beginLoad();

    forkJoin({
      dashboard: this.financeService.getDashboard().pipe(catchError(() => of(null))),
      pendingExpenses: this.financeService.getPendingExpenses().pipe(catchError(() => of([] as ExpenseReportResponse[]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ dashboard, pendingExpenses }) => {
          if (!dashboard) {
            this.dashboard.set(null);
            this.pendingExpenses.set([]);
            this.fail('Finance dashboard data could not be loaded.');
            this.notificationService.error('Finance dashboard data could not be loaded.');
            return;
          }

          this.dashboard.set(dashboard);
          this.pendingExpenses.set(pendingExpenses);
          this.endLoad();
        },
        error: () => {
          this.dashboard.set(null);
          this.pendingExpenses.set([]);
          this.fail('Finance dashboard data could not be loaded.');
          this.notificationService.error('Finance dashboard data could not be loaded.');
        },
      });
  }

  budgetStrokeColor(): string {
    const utilization = this.utilizationPercentage();
    if (utilization >= 100) return '#f43f5e';
    if (utilization >= 85) return '#f59e0b';
    if (utilization >= 60) return '#38bdf8';
    return '#00e0ff';
  }

  formatExpenseStatus(status: ExpenseStatus): string {
    switch (status) {
      case ExpenseStatus.APPROVED:
        return 'Approved';
      case ExpenseStatus.REJECTED:
        return 'Rejected';
      case ExpenseStatus.PENDING:
      default:
        return 'Pending';
    }
  }

  private formatRelativeTime(isoDate: string): string {
    const timestamp = Date.parse(isoDate);

    if (Number.isNaN(timestamp)) {
      return 'recently';
    }

    const minutes = Math.floor((Date.now() - timestamp) / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;

    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
}
