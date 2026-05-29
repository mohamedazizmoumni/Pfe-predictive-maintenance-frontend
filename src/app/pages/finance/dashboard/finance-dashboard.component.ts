import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';

import { FinanceService } from '../../../core/services/finance.service';
import {
  ExpenseCategory,
  ExpenseReportResponse,
  ExpenseStatus,
  ExpenseSummaryResponse,
  FinanceDashboardStats,
} from '../../../core/models/sentinel.models';

interface CategoryRow {
  key: string;
  label: string;
  icon: string;
  amount: number;
  pct: number;
  color: string;
}

interface TrendPoint {
  label: string;
  approvedAmount: number;
  pendingAmount: number;
  rejectedAmount: number;
  totalAmount: number;
}

interface VendorRow {
  name: string;
  amount: number;
  count: number;
  latestDate: string;
}

interface ApprovalRow {
  vendor: string;
  amount: number;
  status: string;
  time: string;
}

interface SummarySlice {
  label: string;
  amount: number;
  pct: number;
  color: string;
}

@Component({
  selector: 'app-finance-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finance-dashboard.component.html',
  styleUrl: './finance-dashboard.component.scss',
})
export class FinanceDashboardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  isLoading = false;
  error: string | null = null;
  dashboard: FinanceDashboardStats | null = null;
  categoryRows: CategoryRow[] = [];
  pendingExpenses: ExpenseReportResponse[] = [];
  vendorRows: VendorRow[] = [];
  trendSeries: TrendPoint[] = [];

  summary: ExpenseSummaryResponse | null = null;
  summaryLoading = false;
  summaryError: string | null = null;
  trendLoading = false;
  trendError: string | null = null;

  selectedYear: number = new Date().getFullYear();
  selectedMonth: number = new Date().getMonth() + 1;
  dismissedAlertLevel: string | null = null;

  private readonly categoryPalette: Record<string, string> = {
    [ExpenseCategory.MAINTENANCE]: '#38bdf8',
    [ExpenseCategory.PARTS]: '#22c55e',
    [ExpenseCategory.LABOR]: '#fbbf24',
    [ExpenseCategory.EQUIPMENT]: '#a855f7',
    [ExpenseCategory.OTHER]: '#fb7185',
  };

  constructor(
    private readonly financeService: FinanceService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.financeService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        this.error = value;
      });

    this.load();
    this.loadSummary();
    this.loadTrendSeries();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.isLoading = true;

    forkJoin({
      dashboard: this.financeService.getDashboard().pipe(catchError(() => of(null))),
      pendingExpenses: this.financeService.getPendingExpenses().pipe(catchError(() => of([] as ExpenseReportResponse[]))),
      allExpenses: this.financeService.getAllExpenses().pipe(catchError(() => of([] as ExpenseReportResponse[]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ dashboard, pendingExpenses, allExpenses }) => {
          this.dashboard = dashboard;
          this.pendingExpenses = pendingExpenses;
          this.categoryRows = dashboard ? this.buildCategoryRows(dashboard) : [];
          this.vendorRows = this.buildVendorRows(allExpenses.length ? allExpenses : pendingExpenses);
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        },
      });
  }

  refresh(): void {
    this.load();
    this.loadSummary();
    this.loadTrendSeries();
  }

  // ==================== DATA BUILDERS ====================
  private buildCategoryRows(dashboard: FinanceDashboardStats): CategoryRow[] {
    const entries = Object.entries(dashboard.expensesByCategory ?? {});
    const total = entries.reduce((sum, [, amount]) => sum + amount, 0) || 1;

    const labelMap: Record<string, string> = {
      [ExpenseCategory.MAINTENANCE]: 'Maintenance',
      [ExpenseCategory.PARTS]: 'Parts',
      [ExpenseCategory.LABOR]: 'Labor',
      [ExpenseCategory.EQUIPMENT]: 'Equipment',
      [ExpenseCategory.OTHER]: 'Other',
    };

    const iconMap: Record<string, string> = {
      [ExpenseCategory.MAINTENANCE]: '🔧',
      [ExpenseCategory.PARTS]: '⚙️',
      [ExpenseCategory.LABOR]: '👷',
      [ExpenseCategory.EQUIPMENT]: '🏭',
      [ExpenseCategory.OTHER]: '📦',
    };

    return entries
      .map(([key, amount]) => ({
        key,
        label: labelMap[key] ?? key,
        icon: iconMap[key] ?? '📄',
        amount,
        pct: Math.round((amount / total) * 100),
        color: this.categoryPalette[key] ?? '#38bdf8',
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private buildVendorRows(expenses: ExpenseReportResponse[]): VendorRow[] {
    const groups = new Map<string, VendorRow>();

    expenses.forEach((expense) => {
      const name = expense.title || expense.machineName || expense.submittedByName || `Expense #${expense.id}`;
      const current = groups.get(name);

      if (current) {
        current.amount += expense.amount;
        current.count += 1;
        if (new Date(expense.createdDate).getTime() > new Date(current.latestDate).getTime()) {
          current.latestDate = expense.createdDate;
        }
        return;
      }

      groups.set(name, {
        name,
        amount: expense.amount,
        count: 1,
        latestDate: expense.createdDate,
      });
    });

    return [...groups.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  private buildTrendSeries(items: (ExpenseSummaryResponse | null)[], periods: { label: string }[]): TrendPoint[] {
    return items
      .map((item, index) => ({
        label: periods[index]?.label ?? '',
        approvedAmount: item?.totalApprovedAmount ?? 0,
        pendingAmount: item?.totalPendingAmount ?? 0,
        rejectedAmount: item?.totalRejectedAmount ?? 0,
        totalAmount: (item?.totalApprovedAmount ?? 0) + (item?.totalPendingAmount ?? 0) + (item?.totalRejectedAmount ?? 0),
      }))
      .filter((point) => point.label);
  }

  // ==================== SUMMARY REPORT ====================
  get monthOptions(): { value: number; label: string }[] {
    return Array.from({ length: 12 }).map((_, index) => ({
      value: index + 1,
      label: new Date(2000, index, 1).toLocaleString('en', { month: 'long' }),
    }));
  }

  get yearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 4 }).map((_, index) => currentYear - index);
  }

  get categoryEntries(): { name: string; amount: number }[] {
    if (!this.summary) return [];

    return Object.entries(this.summary.amountByCategory || {})
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  get summarySlices(): SummarySlice[] {
    const entries = this.categoryEntries;
    const total = entries.reduce((sum, entry) => sum + entry.amount, 0) || 1;
    const colors = ['#38bdf8', '#22c55e', '#fbbf24', '#a855f7', '#fb7185'];

    return entries.map((entry, index) => ({
      label: entry.name,
      amount: entry.amount,
      pct: (entry.amount / total) * 100,
      color: colors[index % colors.length],
    }));
  }

  get donutBackground(): string {
    const slices = this.summarySlices;
    if (!slices.length) {
      return 'conic-gradient(#1f2937 0% 100%)';
    }

    let current = 0;
    const parts = slices.map((slice) => {
      const start = current;
      current += slice.pct;
      return `${slice.color} ${start.toFixed(2)}% ${current.toFixed(2)}%`;
    });

    return `conic-gradient(${parts.join(', ')})`;
  }

  get trendPoints(): { x: number; y: number; label: string; amount: number }[] {
    const values = this.trendSeries.map((item) => item.approvedAmount);
    const max = Math.max(...values, 1);
    const width = 720;
    const height = 220;
    const count = Math.max(values.length - 1, 1);

    return values.map((value, index) => ({
      x: (index / count) * width,
      y: height - (value / max) * height,
      label: this.trendSeries[index]?.label ?? '',
      amount: value,
    }));
  }

  get trendPath(): string {
    const points = this.trendPoints;
    if (!points.length) return '';
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  }

  get trendAreaPath(): string {
    const points = this.trendPoints;
    if (!points.length) return '';
    const width = 720;
    const height = 220;
    const line = this.trendPath;
    return `${line} L ${width} ${height} L 0 ${height} Z`;
  }

  get pendingApprovalsRows(): ApprovalRow[] {
    return this.pendingExpenses.slice(0, 4).map((expense) => ({
      vendor: expense.title || expense.machineName || expense.submittedByName,
      amount: expense.amount,
      status: expense.status,
      time: this.relativeTime(expense.createdDate),
    }));
  }

  get totalBudget(): number {
    return this.dashboard?.totalBudget ?? 0;
  }

  get spentAmount(): number {
    return this.dashboard?.spentAmount ?? 0;
  }

  get remainingBudget(): number {
    return this.dashboard?.remainingBudget ?? 0;
  }

  get utilizationPercentage(): number {
    return this.dashboard?.utilizationPercentage ?? 0;
  }

  get pendingApprovalsTotal(): number {
    return this.dashboard?.pendingCount ?? this.pendingExpenses.length;
  }

  get pendingApprovalsAmount(): number {
    return this.dashboard?.pendingAmount ?? this.pendingExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  }

  get forecastVariance(): number {
    const budget = this.totalBudget || 0;
    if (!budget) return 0;
    return ((budget - (this.spentAmount + this.pendingApprovalsAmount)) / budget) * 100;
  }

  get budgetStatusLabel(): string {
    if (!this.dashboard?.budgetExists) return 'No Budget';
    if (this.utilizationPercentage >= 100) return 'Budget Exhausted';
    if (this.utilizationPercentage >= 90) return 'Budget Critical';
    if (this.utilizationPercentage >= 70) return 'Budget Watch';
    return 'Budget Healthy';
  }

  get forecastStatusLabel(): string {
    const variance = this.forecastVariance;
    if (variance <= -10) return 'High Risk Forecast';
    if (variance <= 0) return 'Medium Risk Forecast';
    return 'Low Risk Forecast';
  }

  get liveDataLabel(): string {
    return this.isLoading ? 'Syncing Data' : 'Live Data Active';
  }

  get trendTitle(): string {
    return this.summary ? `${this.summary.monthName} ${this.summary.year}` : 'Expense Summary';
  }

  get topVendorSubtitle(): string {
    return `${this.vendorRows.length} vendors from current expense feed`;
  }

  get riskInsights(): { tone: 'warning' | 'blue' | 'green'; text: string }[] {
    const insights = [] as { tone: 'warning' | 'blue' | 'green'; text: string }[];

    if (this.utilizationPercentage >= 100) {
      insights.push({ tone: 'warning', text: 'Budget exhausted. New expense approvals need urgent review.' });
    }
    else if (this.utilizationPercentage >= 85) {
      insights.push({ tone: 'warning', text: 'Budget is critically low and needs immediate monitoring.' });
    }
    else if (this.utilizationPercentage >= 70) {
      insights.push({ tone: 'blue', text: 'Budget utilization is elevated but still within control.' });
    }
    else {
      insights.push({ tone: 'green', text: 'Budget position is healthy.' });
    }

    if (this.pendingApprovalsTotal > 0) {
      insights.push({
        tone: 'blue',
        text: `${this.pendingApprovalsTotal} pending expense${this.pendingApprovalsTotal === 1 ? '' : 's'} worth TND${this.pendingApprovalsAmount.toFixed(3)} awaiting review.`,
      });
    }

    insights.push({
      tone: 'green',
      text: `${this.summary?.approvedCount ?? 0} expense${(this.summary?.approvedCount ?? 0) === 1 ? '' : 's'} approved in ${this.summary?.monthName ?? 'this period'}.`,
    });

    return insights;
  }

  // ==================== LOADING ====================
  loadSummary(): void {
    this.summaryLoading = true;
    this.summaryError = null;

    this.financeService.getExpenseSummary(this.selectedYear, this.selectedMonth)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary) => {
          this.summary = summary;
          this.summaryLoading = false;
        },
        error: (err: { error?: { message?: string } }) => {
          this.summaryError = err?.error?.message ?? 'Failed to load summary';
          this.summaryLoading = false;
        },
      });
  }

  loadTrendSeries(): void {
    this.trendLoading = true;
    this.trendError = null;

    const periods = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(this.selectedYear, this.selectedMonth - 1 - (11 - index), 1);
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        label: date.toLocaleString('en', { month: 'short' }),
      };
    });

    forkJoin(
      periods.map((period) =>
        this.financeService.getExpenseSummary(period.year, period.month).pipe(
          catchError(() => of(null)),
        )
      )
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.trendSeries = this.buildTrendSeries(items, periods);
          this.trendLoading = false;
        },
        error: () => {
          this.trendError = 'Failed to load monthly trend';
          this.trendLoading = false;
        },
      });
  }

  onPeriodChange(): void {
    this.summary = null;
    this.trendSeries = [];
    this.loadSummary();
    this.loadTrendSeries();
  }

  exportSummaryCSV(): void {
    if (!this.summary) return;

    const rows: string[] = [];
    rows.push('Category,Amount (TND)');
    this.categoryEntries.forEach((entry) => rows.push(`${entry.name},${entry.amount.toFixed(3)}`));
    rows.push('');
    rows.push(`Total Approved,${this.summary.totalApprovedAmount.toFixed(3)}`);
    rows.push(`Total Pending,${this.summary.totalPendingAmount.toFixed(3)}`);
    rows.push(`Total Rejected,${this.summary.totalRejectedAmount.toFixed(3)}`);
    rows.push(`Period,${this.summary.monthName}`);

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `expense-summary-${this.selectedYear}-${this.selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(href);
  }

  // ==================== ALERT BANNERS ====================
  get budgetAlertLevel(): 'none' | 'warning' | 'critical' | 'exhausted' | 'no-budget' {
    if (!this.dashboard) return 'none';
    if (!this.dashboard.budgetExists) return 'no-budget';
    const pct = this.dashboard.utilizationPercentage;
    if (pct >= 100) return 'exhausted';
    if (pct >= 85) return 'critical';
    if (pct >= 60) return 'warning';
    return 'none';
  }

  get budgetAlertMessage(): string {
    if (!this.dashboard) return '';
    const pct = (this.dashboard.utilizationPercentage ?? 0).toFixed(1);
    const rem = (this.dashboard.remainingBudget ?? 0).toFixed(3);

    switch (this.budgetAlertLevel) {
      case 'exhausted':
        return `Budget exhausted - ${pct}% utilized. Remaining: ${rem} TND. All new expenses require urgent review.`;
      case 'critical':
        return `Budget is critically low - ${pct}% utilized. Only ${rem} TND remaining.`;
      case 'warning':
        return `Budget has reached ${pct}% utilization. Monitor new expense submissions closely.`;
      default:
        return '';
    }
  }

  get showAlert(): boolean {
    return this.budgetAlertLevel !== 'none' && this.budgetAlertLevel !== 'no-budget' && this.budgetAlertLevel !== this.dismissedAlertLevel;
  }

  dismissAlert(): void {
    this.dismissedAlertLevel = this.budgetAlertLevel;
  }

  goToBudget(): void {
    this.router.navigate(['/finance/budget']);
  }

  dismissError(): void {
    this.financeService.clearError();
  }

  private relativeTime(isoDate: string): string {
    const timestamp = Date.parse(isoDate);
    if (Number.isNaN(timestamp)) return 'recently';

    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;

    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
}
