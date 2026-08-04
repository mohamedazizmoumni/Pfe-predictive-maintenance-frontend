import { CommonModule } from '@angular/common';
import { Component, effect, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter, forkJoin, of, timer } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';
import type { ChartConfiguration } from 'chart.js';

import { InventoryService } from '../../../core/services/inventory.service';
import { MachineService } from '../../../core/services/machine.service';
import { NotificationsRestService } from '../../../core/services/notifications-rest.service';
import { ThemeService } from '../../../core/services/theme.service';
import { Machine, Part, ReorderRequest, StockOrder, InventoryUsage } from '../../../core/models/sentinel.models';
import { Notification } from '../../../core/models/notification.model';

import { InventoryIntelligenceService } from './inventory-intelligence.service';
import { axisTicks, tooltipTheme, xScale, yScale } from './chart-theme';
import {
  AiInsight,
  BottomStat,
  CategoryValueSlice,
  ConsumedPartRow,
  CriticalPartRow,
  DistributionSlice,
  ForecastPoint,
  HeatmapCell,
  KpiMetric,
  MachineDependencyRow,
  MovementGranularity,
  ReorderRecommendation,
  SupplierPerformanceRow,
  TimelineEvent,
  TrendRange,
} from './inventory-analytics.types';

import { KpiStripComponent } from './components/kpi-strip.component';
import { ChartCardComponent, ChartLegendItem, ChartToggleOption } from './components/chart-card.component';
import { AiInsightsPanelComponent } from './components/ai-insights-panel.component';
import { CriticalPartsTableComponent } from './components/critical-parts-table.component';
import { ReorderRecommendationsComponent } from './components/reorder-recommendations.component';
import { SupplierPerformanceComponent } from './components/supplier-performance.component';
import { MachineDependencyComponent } from './components/machine-dependency.component';
import { AlertsTimelineComponent } from './components/alerts-timeline.component';
import { CategoryHeatmapComponent } from './components/category-heatmap.component';
import { BottomStatsComponent } from './components/bottom-stats.component';

const AUTO_REFRESH_INTERVAL_MS = 60000;
const CURRENCY_FORMATTER = new Intl.NumberFormat('en', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 });

@Component({
  selector: 'app-inventory-analytics',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    KpiStripComponent,
    ChartCardComponent,
    AiInsightsPanelComponent,
    CriticalPartsTableComponent,
    ReorderRecommendationsComponent,
    SupplierPerformanceComponent,
    MachineDependencyComponent,
    AlertsTimelineComponent,
    CategoryHeatmapComponent,
    BottomStatsComponent,
  ],
  templateUrl: './inventory-analytics.component.html',
  styleUrls: ['./inventory-analytics.component.scss'],
})
export class InventoryAnalyticsComponent implements OnInit, OnDestroy {
  loading = false;
  refreshing = false;
  error: string | null = null;
  lastUpdated: Date | null = null;

  parts: Part[] = [];
  reorders: ReorderRequest[] = [];
  stockOrders: StockOrder[] = [];
  machines: Machine[] = [];
  notifications: Notification[] = [];

  kpis: KpiMetric[] = [];
  criticalRows: CriticalPartRow[] = [];
  machineRows: MachineDependencyRow[] = [];
  recommendations: ReorderRecommendation[] = [];
  supplierRows: SupplierPerformanceRow[] = [];
  aiInsights: AiInsight[] = [];
  distribution: DistributionSlice[] = [];
  topConsumed: ConsumedPartRow[] = [];
  valueByCategory: CategoryValueSlice[] = [];
  heatmapCells: HeatmapCell[] = [];
  bottomStats: BottomStat[] = [];
  timelineEvents: TimelineEvent[] = [];
  forecastPoints: ForecastPoint[] = [];

  trendRange: TrendRange = '30d';
  movementGranularity: MovementGranularity = 'daily';

  readonly trendRangeOptions: ChartToggleOption[] = [
    { label: '30D', value: '30d' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
  ];

  readonly movementOptions: ChartToggleOption[] = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
  ];

  trendChartConfig?: ChartConfiguration<any>;
  distributionChartConfig?: ChartConfiguration<any>;
  topConsumedChartConfig?: ChartConfiguration<any>;
  valueByCategoryChartConfig?: ChartConfiguration<any>;
  movementChartConfig?: ChartConfiguration<any>;
  forecastChartConfig?: ChartConfiguration<any>;

  distributionLegend: ChartLegendItem[] = [];
  valueByCategoryLegend: ChartLegendItem[] = [];

  private hasLoadedOnce = false;
  private subscriptions = new Subscription();

  constructor(
    private inventoryService: InventoryService,
    private machineService: MachineService,
    private notificationsService: NotificationsRestService,
    private intelligence: InventoryIntelligenceService,
    private router: Router,
    private themeService: ThemeService,
  ) {
    // Chart.js configs are plain JS objects, not CSS — they need to be
    // rebuilt (not just recolored via stylesheet) whenever the app theme
    // toggles, so axis/grid/legend text stay legible in both modes.
    effect(() => {
      this.themeService.theme();
      if (this.hasLoadedOnce) {
        this.refreshAllCharts();
      }
    });
  }

  get isDark(): boolean {
    return this.themeService.theme() === 'dark';
  }

  private get legendColor(): string {
    return this.isDark ? '#94A3B8' : '#475569';
  }

  ngOnInit(): void {
    this.loadAll();

    this.subscriptions.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe((event) => {
          if ((event as NavigationEnd).urlAfterRedirects.includes('/inventory/analytics')) {
            this.loadAll();
          }
        })
    );

    this.subscriptions.add(
      timer(AUTO_REFRESH_INTERVAL_MS, AUTO_REFRESH_INTERVAL_MS).subscribe(() => this.loadAll())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  refresh(): void {
    this.loadAll();
  }

  onTrendRangeChange(value: string): void {
    this.trendRange = value as TrendRange;
    this.refreshTrendChart();
  }

  onMovementGranularityChange(value: string): void {
    this.movementGranularity = value as MovementGranularity;
    this.refreshMovementChart();
  }

  onRecommendationCreated(): void {
    this.inventoryService.getReorders(0, 10000)
      .pipe(map((response) => this.asArray<ReorderRequest>(response)))
      .subscribe((reorders) => {
        this.reorders = reorders;
        this.recomputeAll();
      });
  }

  private loadAll(): void {
    if (this.hasLoadedOnce) {
      this.refreshing = true;
    } else {
      this.loading = true;
    }
    this.error = null;

    const usageWindowDays = 90;

    forkJoin({
      parts: this.inventoryService.getParts(0, 10000).pipe(map((r) => this.asArray<Part>(r)), catchError(() => of([] as Part[]))),
      reorders: this.inventoryService.getReorders(0, 10000).pipe(map((r) => this.asArray<ReorderRequest>(r)), catchError(() => of([] as ReorderRequest[]))),
      stockOrders: this.inventoryService.getStockOrders(0, 10000).pipe(map((r) => this.asArray<StockOrder>(r)), catchError(() => of([] as StockOrder[]))),
      machines: this.machineService.getAll().pipe(catchError(() => of([] as Machine[]))),
      notifications: this.notificationsService.loadNotifications().pipe(catchError(() => of([] as Notification[]))),
      usage: this.inventoryService.getAllUsage(usageWindowDays).pipe(catchError(() => of([] as InventoryUsage[]))),
    }).subscribe({
      next: ({ parts, reorders, stockOrders, machines, notifications, usage }) => {
        this.parts = parts;
        this.reorders = reorders;
        this.stockOrders = stockOrders;
        this.machines = machines;
        this.notifications = notifications;

        this.intelligence.setUsageData(usage, usageWindowDays);
        this.recomputeAll();

        this.hasLoadedOnce = true;
        this.loading = false;
        this.refreshing = false;
        this.lastUpdated = new Date();
      },
      error: () => {
        this.error = 'Failed to load inventory analytics.';
        this.loading = false;
        this.refreshing = false;
      },
    });
  }

  private recomputeAll(): void {
    const svc = this.intelligence;

    this.criticalRows = svc.buildCriticalPartsRows(this.parts);
    this.machineRows = svc.buildMachineDependency(this.parts, this.machines);
    this.recommendations = svc.buildReorderRecommendations(this.parts);
    this.supplierRows = svc.buildSupplierPerformance(this.parts, this.stockOrders, this.reorders);
    this.kpis = svc.buildKpis(this.parts, this.stockOrders, this.criticalRows, this.machineRows);
    this.aiInsights = svc.buildAiInsights(this.parts, this.criticalRows, this.supplierRows, this.recommendations);
    this.distribution = svc.buildDistribution(this.parts, this.reorders, this.stockOrders);
    this.topConsumed = svc.buildTopConsumed(this.parts);
    this.valueByCategory = svc.buildValueByCategory(this.parts);
    this.heatmapCells = svc.buildHeatmap(this.parts);
    this.bottomStats = svc.buildBottomStats(this.parts, this.supplierRows, this.stockOrders);
    this.timelineEvents = svc.buildTimelineEvents(this.notifications);
    this.forecastPoints = svc.buildForecast(this.parts);

    this.refreshAllCharts();
  }

  private refreshAllCharts(): void {
    this.refreshTrendChart();
    this.refreshDistributionChart();
    this.refreshTopConsumedChart();
    this.refreshValueByCategoryChart();
    this.refreshMovementChart();
    this.refreshForecastChart();
  }

  private refreshTrendChart(): void {
    const points = this.intelligence.buildTrendSeries(this.parts, this.trendRange);
    this.trendChartConfig = {
      type: 'line',
      data: {
        labels: points.map((p) => p.label),
        datasets: [{
          label: 'Inventory value',
          data: points.map((p) => p.value),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.14)',
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipTheme(this.isDark),
            callbacks: { label: (ctx: any) => ` ${CURRENCY_FORMATTER.format(Number(ctx.parsed.y))}` },
          },
        },
        scales: { x: xScale(this.isDark), y: yScale(this.isDark) },
      },
    };
  }

  private refreshDistributionChart(): void {
    const total = this.distribution.reduce((sum, s) => sum + s.value, 0);
    this.distributionLegend = this.distribution.map((s) => ({
      label: s.label,
      value: total > 0 ? `${s.value} · ${Math.round((s.value / total) * 100)}%` : `${s.value}`,
      color: s.color,
    }));

    this.distributionChartConfig = {
      type: 'doughnut',
      data: {
        labels: this.distribution.map((s) => s.label),
        datasets: [{
          data: this.distribution.map((s) => s.value),
          backgroundColor: this.distribution.map((s) => s.color),
          borderColor: this.isDark ? '#121826' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: tooltipTheme(this.isDark),
        },
      },
    };
  }

  get topConsumedSubtitle(): string {
    if (this.topConsumed.length === 0) return 'Current stock vs. consumption this month';
    const anyReal = this.topConsumed.some((r) => r.isReal);
    return anyReal
      ? 'Current stock vs. consumption this month (real where logged, estimated otherwise)'
      : 'Current stock vs. consumption this month (estimated — no logged usage yet)';
  }

  private refreshTopConsumedChart(): void {
    const rows = [...this.topConsumed].reverse();
    this.topConsumedChartConfig = {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.partName),
        datasets: [
          { label: 'Current stock', data: rows.map((r) => r.currentStock), backgroundColor: 'rgba(148,163,184,0.35)', borderRadius: 6, borderSkipped: false },
          { label: 'Consumed this month', data: rows.map((r) => r.consumedThisMonth), backgroundColor: '#3B82F6', borderRadius: 6, borderSkipped: false },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', align: 'end', labels: { color: this.legendColor, boxWidth: 10, font: { size: 11 } } },
          tooltip: tooltipTheme(this.isDark),
        },
        scales: {
          x: xScale(this.isDark, true),
          y: { ticks: axisTicks(this.isDark), grid: { display: false }, border: { display: false } },
        },
      },
    };
  }

  private refreshValueByCategoryChart(): void {
    const rows = this.valueByCategory;
    this.valueByCategoryLegend = rows.map((r) => ({
      label: r.category,
      value: CURRENCY_FORMATTER.format(r.value),
      color: r.color,
    }));

    this.valueByCategoryChartConfig = {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.category),
        datasets: [
          { label: 'Healthy value', data: rows.map((r) => r.healthyValue), backgroundColor: '#22C55E', stack: 'value', borderRadius: 4, borderSkipped: false },
          { label: 'At-risk value', data: rows.map((r) => r.atRiskValue), backgroundColor: '#F59E0B', stack: 'value', borderRadius: 4, borderSkipped: false },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { color: this.legendColor, boxWidth: 10, font: { size: 11 } } },
          tooltip: {
            ...tooltipTheme(this.isDark),
            callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${CURRENCY_FORMATTER.format(Number(ctx.parsed.y))}` },
          },
        },
        scales: {
          x: { ticks: axisTicks(this.isDark), grid: { display: false }, border: { display: false }, stacked: true },
          y: { ...yScale(this.isDark), stacked: true },
        },
      },
    };
  }

  private refreshMovementChart(): void {
    const points = this.intelligence.buildStockMovement(this.parts, this.stockOrders, this.movementGranularity);
    this.movementChartConfig = {
      type: 'line',
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          { label: 'Incoming', data: points.map((p) => p.incoming), borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.14)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
          { label: 'Outgoing', data: points.map((p) => p.outgoing), borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.12)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', labels: { color: this.legendColor, boxWidth: 10, font: { size: 11 } } },
          tooltip: tooltipTheme(this.isDark),
        },
        scales: { x: xScale(this.isDark), y: yScale(this.isDark) },
      },
    };
  }

  private refreshForecastChart(): void {
    const points = this.forecastPoints;
    this.forecastChartConfig = {
      type: 'line',
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            label: 'Historical',
            data: points.map((p) => p.historical),
            borderColor: '#3B82F6',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.3,
            spanGaps: false,
          },
          {
            label: 'Predicted',
            data: points.map((p) => p.predicted),
            borderColor: '#8B5CF6',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            borderDash: [6, 4],
            pointRadius: 0,
            tension: 0.3,
            spanGaps: false,
          },
          {
            label: 'Confidence band (high)',
            data: points.map((p) => p.confidenceHigh),
            borderColor: 'transparent',
            backgroundColor: 'rgba(139,92,246,0.14)',
            pointRadius: 0,
            fill: '+1',
            tension: 0.3,
          },
          {
            label: 'Confidence band (low)',
            data: points.map((p) => p.confidenceLow),
            borderColor: 'transparent',
            backgroundColor: 'rgba(139,92,246,0.14)',
            pointRadius: 0,
            fill: false,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: this.legendColor,
              boxWidth: 10,
              font: { size: 11 },
              filter: (item: any) => item.text === 'Historical' || item.text === 'Predicted',
            },
          },
          tooltip: tooltipTheme(this.isDark),
        },
        scales: { x: xScale(this.isDark), y: yScale(this.isDark) },
      },
    };
  }

  private asArray<T>(response: { content?: T[] } | T[] | null | undefined): T[] {
    if (Array.isArray(response)) {
      return response;
    }
    return response?.content ?? [];
  }
}
