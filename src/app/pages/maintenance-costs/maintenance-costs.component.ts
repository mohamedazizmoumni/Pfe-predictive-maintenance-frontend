import { ChangeDetectionStrategy, Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import type { ChartConfiguration } from 'chart.js';
import { forkJoin } from 'rxjs';
import {
  MaintenanceCostService,
  FinancialDashboardResponse,
  FailureReportResponse,
  MaintenanceReportResponse,
  FailureSummary,
  TopCostMachine,
} from '../../core/services/maintenance-cost.service';
import { ThemeService } from '../../core/services/theme.service';
import { ChartCardComponent, ChartLegendItem } from '../../shared/charts/chart-card.component';
import { CountUpDirective } from '../../shared/charts/count-up.directive';
import { axisTicks, tooltipTheme, xScale, yScale } from './chart-theme';

interface KpiTile {
  id: string;
  icon: string;
  accent: 'info' | 'danger' | 'success' | 'warning';
  label: string;
  rawValue: number;
  caption: string;
  formatter: (value: number) => string;
}

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TND' });

@Component({
  selector: 'app-maintenance-costs',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ChartCardComponent, CountUpDirective],
  templateUrl: './maintenance-costs.component.html',
  styleUrl: './maintenance-costs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceCostsComponent implements OnInit {
  readonly dashboard = signal<FinancialDashboardResponse | null>(null);
  readonly failureReport = signal<FailureReportResponse | null>(null);
  readonly maintenanceReport = signal<MaintenanceReportResponse | null>(null);
  readonly failureSummary = signal<FailureSummary | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<Date | null>(null);

  kpis: KpiTile[] = [];

  budgetChartConfig?: ChartConfiguration<any>;
  budgetLegend: ChartLegendItem[] = [];

  monthlyCostChartConfig?: ChartConfiguration<any>;
  topMachinesChartConfig?: ChartConfiguration<any>;

  failureTypeChartConfig?: ChartConfiguration<any>;
  failureTypeLegend: ChartLegendItem[] = [];

  departmentBudgetChartConfig?: ChartConfiguration<any>;

  private hasLoadedOnce = false;

  constructor(
    private readonly costService: MaintenanceCostService,
    private readonly themeService: ThemeService,
  ) {
    // Chart.js configs are plain JS objects, not CSS — they must be rebuilt
    // (not just recolored via stylesheet) whenever the app theme toggles, so
    // axis/grid/legend text stays legible in both light and dark mode.
    effect(() => {
      this.themeService.theme();
      if (this.hasLoadedOnce) {
        this.buildCharts();
      }
    });
  }

  get isDark(): boolean {
    return this.themeService.theme() === 'dark';
  }

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    if (this.hasLoadedOnce) {
      this.refreshing.set(true);
    } else {
      this.loading.set(true);
    }
    this.error.set(null);

    forkJoin({
      dashboard: this.costService.getDashboard(),
      failureReport: this.costService.getFailureReport(),
      maintenanceReport: this.costService.getMaintenanceReport(),
      failureSummary: this.costService.getFailureSummary(),
    }).subscribe({
      next: ({ dashboard, failureReport, maintenanceReport, failureSummary }) => {
        this.dashboard.set(dashboard);
        this.failureReport.set(failureReport);
        this.maintenanceReport.set(maintenanceReport);
        this.failureSummary.set(failureSummary);

        this.buildKpis(dashboard);
        this.buildCharts();

        this.hasLoadedOnce = true;
        this.loading.set(false);
        this.refreshing.set(false);
        this.lastUpdated.set(new Date());
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load maintenance cost analytics.');
        this.loading.set(false);
        this.refreshing.set(false);
      },
    });
  }

  topMachines(): TopCostMachine[] {
    return this.dashboard()?.topCostMachines ?? [];
  }

  maxMachineCost(): number {
    return Math.max(1, ...this.topMachines().map(m => m.totalCost));
  }

  failureTypeEntries(): { type: string; count: number }[] {
    const byType = this.failureSummary()?.failuresByType ?? {};
    return Object.entries(byType).map(([type, count]) => ({ type, count }));
  }

  formatCurrency(value: number | null | undefined): string {
    return CURRENCY_FORMATTER.format(value ?? 0);
  }

  formatHours(hours: number | null | undefined): string {
    return `${(hours ?? 0).toFixed(1)}h`;
  }

  getUtilizationClass(percentage: number): string {
    if (percentage >= 100) return 'budget-critical';
    if (percentage >= 85) return 'budget-warning';
    return 'budget-ok';
  }

  private buildKpis(d: FinancialDashboardResponse): void {
    const utilizationAccent: KpiTile['accent'] =
      d.overallUtilization >= 100 ? 'danger' : d.overallUtilization >= 85 ? 'warning' : 'success';

    this.kpis = [
      {
        id: 'allocated',
        icon: 'Wallet',
        accent: 'info',
        label: 'Total Allocated',
        rawValue: d.totalAllocated ?? 0,
        caption: 'Approved budget for the period',
        formatter: (v) => CURRENCY_FORMATTER.format(v),
      },
      {
        id: 'spent',
        icon: 'CreditCard',
        accent: 'danger',
        label: 'Total Spent',
        rawValue: d.totalSpent ?? 0,
        caption: 'Maintenance + failure costs',
        formatter: (v) => CURRENCY_FORMATTER.format(v),
      },
      {
        id: 'remaining',
        icon: 'PiggyBank',
        accent: 'success',
        label: 'Remaining',
        rawValue: d.totalRemaining ?? 0,
        caption: 'Still available to spend',
        formatter: (v) => CURRENCY_FORMATTER.format(v),
      },
      {
        id: 'utilization',
        icon: 'Percent',
        accent: utilizationAccent,
        label: 'Overall Utilization',
        rawValue: d.overallUtilization ?? 0,
        caption: `${d.budgetsByDepartment?.length ?? 0} department(s) tracked`,
        formatter: (v) => `${v.toFixed(1)}%`,
      },
      {
        id: 'alerts',
        icon: 'TriangleAlert',
        accent: (d.alerts?.length ?? 0) > 0 ? 'danger' : 'success',
        label: 'Budget Alerts',
        rawValue: d.alerts?.length ?? 0,
        caption: (d.alerts?.length ?? 0) > 0 ? 'Needs attention' : 'All departments within limits',
        formatter: (v) => Math.round(v).toString(),
      },
    ];
  }

  private buildCharts(): void {
    const d = this.dashboard();
    if (!d) return;

    this.buildBudgetChart(d);
    this.buildMonthlyCostChart(d);
    this.buildTopMachinesChart();
    this.buildFailureTypeChart();
    this.buildDepartmentBudgetChart(d);
  }

  private buildBudgetChart(d: FinancialDashboardResponse): void {
    const spent = Math.max(0, d.totalSpent ?? 0);
    const remaining = Math.max(0, d.totalRemaining ?? 0);
    const colors = ['#EF4444', '#22C55E'];

    this.budgetLegend = [
      { label: 'Spent', value: this.formatCurrency(spent), color: colors[0] },
      { label: 'Remaining', value: this.formatCurrency(remaining), color: colors[1] },
    ];

    this.budgetChartConfig = {
      type: 'doughnut',
      data: {
        labels: ['Spent', 'Remaining'],
        datasets: [{
          data: [spent, remaining],
          backgroundColor: colors,
          borderColor: this.isDark ? '#121826' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: tooltipTheme(this.isDark),
        },
      },
    };
  }

  private buildMonthlyCostChart(d: FinancialDashboardResponse): void {
    const points = d.monthlyCosts ?? [];
    this.monthlyCostChartConfig = {
      type: 'line',
      data: {
        labels: points.map(p => p.month),
        datasets: [
          {
            label: 'Maintenance cost',
            data: points.map(p => p.maintenanceCost),
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59,130,246,0.14)',
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
          },
          {
            label: 'Failure cost',
            data: points.map(p => p.failureCost),
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239,68,68,0.12)',
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', align: 'end', labels: { color: this.legendColor, boxWidth: 10, font: { size: 11 } } },
          tooltip: {
            ...tooltipTheme(this.isDark),
            callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${this.formatCurrency(Number(ctx.parsed.y))}` },
          },
        },
        scales: { x: xScale(this.isDark), y: yScale(this.isDark) },
      },
    };
  }

  private buildTopMachinesChart(): void {
    const rows = [...this.topMachines()]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 8)
      .reverse();

    this.topMachinesChartConfig = {
      type: 'bar',
      data: {
        labels: rows.map(r => r.machineName),
        datasets: [
          { label: 'Maintenance cost', data: rows.map(r => r.maintenanceCost), backgroundColor: '#3B82F6', stack: 'cost', borderRadius: 4, borderSkipped: false },
          { label: 'Failure cost', data: rows.map(r => r.failureCost), backgroundColor: '#EF4444', stack: 'cost', borderRadius: 4, borderSkipped: false },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', align: 'end', labels: { color: this.legendColor, boxWidth: 10, font: { size: 11 } } },
          tooltip: {
            ...tooltipTheme(this.isDark),
            callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${this.formatCurrency(Number(ctx.parsed.x))}` },
          },
        },
        scales: {
          x: { ...xScale(this.isDark, true), stacked: true },
          y: { ticks: axisTicks(this.isDark), grid: { display: false }, border: { display: false }, stacked: true },
        },
      },
    };
  }

  private buildFailureTypeChart(): void {
    const entries = this.failureTypeEntries();
    const palette = ['#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#22C55E', '#EC4899'];
    const colors = entries.map((_, i) => palette[i % palette.length]);
    const total = entries.reduce((sum, e) => sum + e.count, 0);

    this.failureTypeLegend = entries.map((e, i) => ({
      label: e.type,
      value: total > 0 ? `${e.count} · ${Math.round((e.count / total) * 100)}%` : `${e.count}`,
      color: colors[i],
    }));

    this.failureTypeChartConfig = {
      type: 'doughnut',
      data: {
        labels: entries.map(e => e.type),
        datasets: [{
          data: entries.map(e => e.count),
          backgroundColor: colors,
          borderColor: this.isDark ? '#121826' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: tooltipTheme(this.isDark),
        },
      },
    };
  }

  private buildDepartmentBudgetChart(d: FinancialDashboardResponse): void {
    const rows = d.budgetsByDepartment ?? [];
    this.departmentBudgetChartConfig = {
      type: 'bar',
      data: {
        labels: rows.map(r => r.department),
        datasets: [
          { label: 'Allocated', data: rows.map(r => r.allocatedAmount), backgroundColor: 'rgba(148,163,184,0.35)', borderRadius: 6, borderSkipped: false },
          { label: 'Spent', data: rows.map(r => r.spentAmount), backgroundColor: '#3B82F6', borderRadius: 6, borderSkipped: false },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', align: 'end', labels: { color: this.legendColor, boxWidth: 10, font: { size: 11 } } },
          tooltip: {
            ...tooltipTheme(this.isDark),
            callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${this.formatCurrency(Number(ctx.parsed.y))}` },
          },
        },
        scales: { x: xScale(this.isDark), y: yScale(this.isDark) },
      },
    };
  }

  private get legendColor(): string {
    return this.isDark ? '#94A3B8' : '#475569';
  }
}
