import { CommonModule, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AlertApiService } from '../../../../core/services/alert.service';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { MachineService } from '../../../../core/services/machine.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { RecommendationService } from '../../../../core/services/recommendation.service';
import { ThemeService } from '../../../../core/services/theme.service';

import { AlertResponse, AlertStatus, Maintenance, SavedRecommendationResponse } from '../../../../core/models/sentinel.models';
import { Machine } from '../../../../core/models/machine.model';

import {
  BaseDashboardComponent,
  DashboardBarRow,
} from '../../base-dashboard/base-dashboard.component';
import { ManagerDashboardIntelligenceService } from './manager-dashboard-intelligence.service';
import { DashboardKpiStripComponent, DashboardKpiMetric } from '../../../../shared/charts/kpi-strip.component';
import { ChartCardComponent, ChartLegendItem } from '../../../../shared/charts/chart-card.component';
import { axisTicks, legendColor, tooltipTheme, xScale, yScale } from '../../../../shared/charts/chart-theme';

const TREND_DAYS = 14;

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, LucideAngularModule, DashboardKpiStripComponent, ChartCardComponent],
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagerDashboardComponent extends BaseDashboardComponent implements OnInit {

  readonly machines    = signal<Machine[]>([]);
  readonly maintenance = signal<Maintenance[]>([]);
  readonly alerts      = signal<AlertResponse[]>([]);
  readonly recommendations = signal<SavedRecommendationResponse[]>([]);

  get isDark(): boolean {
    return this.themeService.theme() === 'dark';
  }

  // ── Derived real-data building blocks (shared by KPIs + charts) ─────────────
  private readonly uptimePct = computed(() => {
    const total = Math.max(1, this.machines().length);
    const uptime = this.machines().filter(m => this.isOperational(m)).length;
    return Math.round((uptime / total) * 100);
  });

  private readonly alertVolumeTrend = computed(() => this.intel.buildAlertVolumeTrend(this.alerts(), TREND_DAYS));
  private readonly maintenanceTrend = computed(() => this.intel.buildMaintenanceCompletionTrend(this.maintenance(), TREND_DAYS));
  private readonly productivityTrend = computed(() => this.intel.buildProductivityTrend(this.maintenance(), TREND_DAYS));
  private readonly fleetHealthTrend = computed(() =>
    this.intel.buildFleetHealthTrend(this.uptimePct(), `mgr:${this.machines().length}:${this.maintenance().length}`, TREND_DAYS)
  );
  private readonly openWorkOrdersTrend = computed(() => this.maintenanceTrend().created);

  // ── KPI strip (real values + real/derived sparklines) ───────────────────────
  readonly kpiMetrics = computed<DashboardKpiMetric[]>(() => {
    const total         = Math.max(1, this.machines().length);
    const uptime        = this.machines().filter(m => this.isOperational(m)).length;
    const openMaint     = this.maintenance().filter(
      t => t.status === 'SCHEDULED' || t.status === 'IN_PROGRESS'
    ).length;
    const completedMaint = this.maintenance().filter(t => t.status === 'COMPLETED').length;
    const totalMaint     = Math.max(1, this.maintenance().length);
    const productivity   = Math.round((completedMaint / totalMaint) * 100);

    const alertTrend = this.intel.trendFor(this.alertVolumeTrend().values);
    const prodTrend = this.intel.trendFor(this.productivityTrend());
    const healthTrend = this.intel.trendFor(this.fleetHealthTrend());

    return [
      {
        id: 'uptime',
        label: 'Asset Uptime',
        value: `${Math.round((uptime / total) * 100)}%`,
        rawValue: Math.round((uptime / total) * 100),
        format: (v: number) => `${Math.round(v)}%`,
        caption: `${uptime} of ${total} operational`,
        icon: 'activity',
        accent: uptime / total >= 0.8 ? 'success' : 'warning',
        sparkline: this.fleetHealthTrend(),
        changeLabel: healthTrend.label,
        changeDirection: healthTrend.direction,
      },
      {
        id: 'open-work-orders',
        label: 'Open Work Orders',
        value: `${openMaint}`,
        rawValue: openMaint,
        caption: `${this.maintenance().length} tasks total`,
        icon: 'clipboard-list',
        accent: openMaint > 10 ? 'danger' : openMaint > 5 ? 'warning' : 'success',
        sparkline: this.openWorkOrdersTrend(),
      },
      {
        id: 'active-alerts',
        label: 'Active Alerts',
        value: `${this.alerts().length}`,
        rawValue: this.alerts().length,
        caption: `${this.criticalAlertCount()} critical`,
        icon: 'triangle-alert',
        accent: this.criticalAlertCount() > 0 ? 'danger' : 'info',
        sparkline: this.alertVolumeTrend().values,
        changeLabel: alertTrend.label,
        changeDirection: alertTrend.direction === 'up' ? 'down' : alertTrend.direction === 'down' ? 'up' : 'flat', // fewer alerts = good
      },
      {
        id: 'team-productivity',
        label: 'Team Productivity',
        value: `${productivity}%`,
        rawValue: productivity,
        format: (v: number) => `${Math.round(v)}%`,
        caption: `${completedMaint} tasks completed`,
        icon: 'trending-up',
        accent: productivity >= 70 ? 'success' : 'warning',
        sparkline: this.productivityTrend(),
        changeLabel: prodTrend.label,
        changeDirection: prodTrend.direction,
      },
    ];
  });

  // ── Machine status summary (real data) ─────────────────────────────────────
  readonly machineStatusSummary = computed(() => {
    const total       = Math.max(1, this.machines().length);
    const operational = this.machines().filter(m => this.isOperational(m)).length;
    const inMaint     = this.machines().filter(m => this.isMaintenance(m)).length;
    const faulty      = this.machines().filter(m => this.isFaulty(m)).length;
    const other       = total - operational - inMaint - faulty;

    return [
      { label: 'Operational', count: operational, pct: Math.round((operational / total) * 100), tone: 'good' },
      { label: 'Maintenance',  count: inMaint,     pct: Math.round((inMaint     / total) * 100), tone: 'warning' },
      { label: 'Faulty',       count: faulty,      pct: Math.round((faulty      / total) * 100), tone: 'critical' },
      ...(other > 0 ? [{ label: 'Other', count: other, pct: Math.round((other / total) * 100), tone: 'info' as const }] : []),
    ];
  });

  readonly machineStatusChartConfig = computed<ChartConfiguration<any>>(() => {
    const rows = this.machineStatusSummary();
    const colorMap: Record<string, string> = { good: '#22C55E', warning: '#F59E0B', critical: '#EF4444', info: '#6b7280' };
    return {
      type: 'doughnut',
      data: {
        labels: rows.map(r => r.label),
        datasets: [{
          data: rows.map(r => r.count),
          backgroundColor: rows.map(r => colorMap[r.tone]),
          borderColor: this.isDark ? '#121826' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: { legend: { display: false }, tooltip: tooltipTheme(this.isDark) },
      },
    };
  });

  readonly machineStatusLegend = computed<ChartLegendItem[]>(() => {
    const rows = this.machineStatusSummary();
    const colorMap: Record<string, string> = { good: '#22C55E', warning: '#F59E0B', critical: '#EF4444', info: '#6b7280' };
    return rows.map(r => ({ label: r.label, value: `${r.count} · ${r.pct}%`, color: colorMap[r.tone] }));
  });

  // ── Critical assets: real machines ranked by risk score, else status ────────
  readonly criticalAssets = computed<DashboardBarRow[]>(() => {
    const ranked = this.intel.buildRiskRanking(this.machines());
    if (ranked.length) {
      return ranked.map(r => ({
        label: r.label,
        value: r.riskScore,
        display: `${r.riskScore} risk`,
        tone: r.riskScore >= 70 ? ('critical' as const) : r.riskScore >= 40 ? ('warning' as const) : ('good' as const),
      }));
    }

    const nonOperational = this.machines().filter(m => !this.isOperational(m)).slice(0, 6);
    if (!nonOperational.length) {
      return this.machines().slice(0, 5).map(m => ({
        label:   m.name || `Machine #${m.id}`,
        value:   this.isOperational(m) ? 100 : this.isMaintenance(m) ? 50 : 10,
        display: this.statusLabel(m),
        tone:    this.isOperational(m) ? 'good' : this.isMaintenance(m) ? 'warning' : 'critical',
      }));
    }
    return nonOperational.map(m => ({
      label:   m.name || `Machine #${m.id}`,
      value:   this.isMaintenance(m) ? 50 : 10,
      display: this.statusLabel(m),
      tone:    this.isMaintenance(m) ? ('warning' as const) : ('critical' as const),
    }));
  });

  readonly criticalAssetsChartConfig = computed<ChartConfiguration<any>>(() => {
    const rows = [...this.criticalAssets()].reverse();
    const colorMap: Record<string, string> = { good: '#22C55E', warning: '#F59E0B', critical: '#EF4444', info: '#6b7280' };
    return {
      type: 'bar',
      data: {
        labels: rows.map(r => r.label),
        datasets: [{
          data: rows.map(r => r.value),
          backgroundColor: rows.map(r => colorMap[r.tone]),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tooltipTheme(this.isDark) },
        scales: {
          x: xScale(this.isDark, true),
          y: { ticks: axisTicks(this.isDark), grid: { display: false }, border: { display: false } },
        },
      },
    };
  });

  // ── Alert severity distribution (real data) ─────────────────────────────────
  readonly alertSeverityDist = computed(() => {
    const total    = Math.max(1, this.alerts().length);
    const critical = this.alerts().filter(a => String(a.severity) === 'CRITICAL').length;
    const warning  = this.alerts().filter(a => String(a.severity) === 'WARNING').length;
    const info     = total - critical - warning;

    return [
      { label: 'Critical', count: critical, pct: Math.round((critical / total) * 100), tone: 'critical' as const },
      { label: 'Warning',  count: warning,  pct: Math.round((warning  / total) * 100), tone: 'warning'  as const },
      { label: 'Info',     count: info,     pct: Math.round((info     / total) * 100), tone: 'info'     as const },
    ].filter(d => d.count > 0);
  });

  readonly alertSeverityChartConfig = computed<ChartConfiguration<any>>(() => {
    const rows = this.alertSeverityDist();
    const colorMap: Record<string, string> = { critical: '#EF4444', warning: '#F59E0B', info: '#6b7280' };
    return {
      type: 'doughnut',
      data: {
        labels: rows.map(r => r.label),
        datasets: [{
          data: rows.map(r => r.count),
          backgroundColor: rows.map(r => colorMap[r.tone]),
          borderColor: this.isDark ? '#121826' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: { legend: { display: false }, tooltip: tooltipTheme(this.isDark) },
      },
    };
  });

  readonly alertSeverityLegend = computed<ChartLegendItem[]>(() => {
    const rows = this.alertSeverityDist();
    const colorMap: Record<string, string> = { critical: '#EF4444', warning: '#F59E0B', info: '#6b7280' };
    return rows.map(r => ({ label: r.label, value: `${r.count} · ${r.pct}%`, color: colorMap[r.tone] }));
  });

  // ── Fleet health trend chart ─────────────────────────────────────────────────
  readonly fleetHealthChartConfig = computed<ChartConfiguration<any>>(() => {
    const values = this.fleetHealthTrend();
    const labels = this.alertVolumeTrend().labels;
    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Fleet health',
          data: values,
          borderColor: '#6b7280',
          backgroundColor: 'rgba(107,114,128,0.14)',
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
          tooltip: { ...tooltipTheme(this.isDark), callbacks: { label: (ctx: any) => ` ${ctx.parsed.y}% healthy` } },
        },
        scales: { x: xScale(this.isDark), y: yScale(this.isDark) },
      },
    };
  });

  // ── Alert volume trend chart ─────────────────────────────────────────────────
  readonly alertVolumeChartConfig = computed<ChartConfiguration<any>>(() => {
    const { labels, values } = this.alertVolumeTrend();
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Alerts created',
          data: values,
          backgroundColor: '#EF4444',
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tooltipTheme(this.isDark) },
        scales: { x: xScale(this.isDark), y: yScale(this.isDark) },
      },
    };
  });

  // ── Maintenance completion trend chart ──────────────────────────────────────
  readonly maintenanceTrendChartConfig = computed<ChartConfiguration<any>>(() => {
    const { labels, created, completed } = this.maintenanceTrend();
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Created', data: created, borderColor: '#6b7280', backgroundColor: 'rgba(107,114,128,0.12)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
          { label: 'Completed', data: completed, borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.14)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', labels: { color: legendColor(this.isDark), boxWidth: 10, font: { size: 11 } } },
          tooltip: tooltipTheme(this.isDark),
        },
        scales: { x: xScale(this.isDark), y: yScale(this.isDark) },
      },
    };
  });

  // ── Team roster from real maintenance assignments ────────────────────────────
  readonly teamRows = computed<DashboardBarRow[]>(() => {
    const assignments = new Map<string, number>();
    this.maintenance().forEach(item => {
      const key = item.assignedTechnicianId
        ? String(item.assignedTechnicianId)
        : 'Unassigned';
      assignments.set(key, (assignments.get(key) || 0) + 1);
    });

    const rows  = Array.from(assignments.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = Math.max(1, this.maintenance().length);

    return rows.map(([label, count]) => ({
      label,
      value:   Math.round((count / total) * 100),
      display: `${count} task${count !== 1 ? 's' : ''}`,
      tone:    count > 4 ? ('warning' as const) : ('info' as const),
    }));
  });

  readonly teamWorkloadChartConfig = computed<ChartConfiguration<any>>(() => {
    const rows = [...this.teamRows()].reverse();
    return {
      type: 'bar',
      data: {
        labels: rows.map(r => r.label === 'Unassigned' ? 'Unassigned' : `Tech #${r.label}`),
        datasets: [{
          data: rows.map(r => r.value),
          backgroundColor: rows.map(r => r.tone === 'warning' ? '#F59E0B' : '#6b7280'),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipTheme(this.isDark), callbacks: { label: (ctx: any) => ` ${rows[ctx.dataIndex].display}` } },
        },
        scales: {
          x: xScale(this.isDark, true),
          y: { ticks: axisTicks(this.isDark), grid: { display: false }, border: { display: false } },
        },
      },
    };
  });

  // ── Maintenance rows (real data) ─────────────────────────────────────────────
  readonly maintenanceRows = computed(() =>
    this.maintenance().slice(0, 6).map(item => ({
      task:     item.description || 'Unnamed task',
      status:   item.status,
      priority: item.priority,
      machine:  `Machine #${item.machineId}`,
      tone:
        item.priority === 'CRITICAL' || item.priority === 'HIGH' ? 'critical' :
        item.priority === 'MEDIUM'   ? 'warning' : 'good',
    }))
  );

  // ── Alert rows (real data) ────────────────────────────────────────────────────
  readonly alertRows = computed(() =>
    this.alerts().slice(0, 6).map(alert => ({
      title:    alert.title,
      machine:  alert.machineSerial || `Machine #${alert.machineId}`,
      severity: String(alert.severity),
      age:      this.getAgeLabel(alert.createdDate),
      tone:
        String(alert.severity) === 'CRITICAL' ? 'critical' :
        String(alert.severity) === 'WARNING'  ? 'warning'  : 'info',
    }))
  );

  // ── Helper ───────────────────────────────────────────────────────────────────
  private criticalAlertCount(): number {
    return this.alerts().filter(a => String(a.severity) === 'CRITICAL').length;
  }

  constructor(
    private readonly machineService: MachineService,
    private readonly maintenanceService: MaintenanceService,
    private readonly alertService: AlertApiService,
    private readonly recommendationService: RecommendationService,
    private readonly notificationService: NotificationService,
    private readonly intel: ManagerDashboardIntelligenceService,
    private readonly themeService: ThemeService,
  ) {
    super();
  }

  ngOnInit(): void { this.loadDashboardData(); }

  refresh(): void { this.loadDashboardData(); }

  loadDashboardData(): void {
    this.beginLoad();

    this.machineService.getAll().pipe(
      catchError(() => of([] as Machine[])),
      switchMap(machines => {
        this.machines.set(machines);

        return forkJoin({
          maintenance: this.maintenanceService
            .getAllMaintenanceTasks(0, 100)
            .pipe(catchError(() => of({ content: [] as Maintenance[] }))),

          alerts: this.alertService
            .list({ size: 50, status: AlertStatus.NEW })
            .pipe(catchError(() => of({ content: [] as AlertResponse[] }))),

          // Pending AI recommendations awaiting approval across the fleet -
          // reuses the real generate-and-save/approve/reject system instead
          // of the old per-machine preview endpoint (which 404s for any
          // machine outside 3 hardcoded demo rows).
          recommendations: this.recommendationService
            .history('PENDING', 0, 8)
            .pipe(catchError(() => of({ content: [] as SavedRecommendationResponse[], totalElements: 0, totalPages: 0, number: 0, size: 8 }))),
        });
      })
    ).subscribe({
      next: ({ maintenance, alerts, recommendations }) => {
        this.maintenance.set(maintenance.content ?? []);
        this.alerts.set(alerts.content ?? []);
        this.recommendations.set(recommendations.content ?? []);
        this.endLoad();
      },
      error: () => {
        this.fail('Manager dashboard data could not be loaded.');
        this.notificationService.error('Manager dashboard data could not be loaded.');
      },
    });
  }

  private isOperational(machine: Machine): boolean {
    return (machine.status || '').toUpperCase() === 'OPERATIONAL';
  }

  private isMaintenance(machine: Machine): boolean {
    return (machine.status || '').toUpperCase() === 'MAINTENANCE';
  }

  private isFaulty(machine: Machine): boolean {
    return (machine.status || '').toUpperCase() === 'FAULTY';
  }

  private statusLabel(machine: Machine): string {
    const s = (machine.status || 'UNKNOWN').toUpperCase();
    return s.charAt(0) + s.slice(1).toLowerCase();
  }

  private getAgeLabel(createdDate: string): string {
    const created = new Date(createdDate);
    const hours   = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60)));
    return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  }
}
