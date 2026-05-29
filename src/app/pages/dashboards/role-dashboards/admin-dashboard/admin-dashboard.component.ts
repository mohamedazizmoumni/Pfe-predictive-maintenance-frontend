import { CommonModule, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AlertApiService } from '../../../../core/services/alert.service';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { MachineService } from '../../../../core/services/machine.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { RecommendationService } from '../../../../core/services/recommendation.service';
import { AlertResponse, Maintenance } from '../../../../core/models/sentinel.models';
import { Machine } from '../../../../core/models/machine.model';
import { MaintenanceRecommendationDTO } from '../../../../core/models/recommendation.model';
import { BaseDashboardComponent, DashboardBarRow, DashboardKpiCard } from '../../base-dashboard/base-dashboard.component';
import { DASHBOARD_SHELL_STYLES } from '../../base-dashboard/dashboard-shell.styles';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, DecimalPipe],
  template: `
    <section class="dashboard-shell">
      <header class="dashboard-header">
        <div>
          <p class="dashboard-eyebrow">Admin dashboard</p>
          <h1 class="dashboard-title">Operations overview</h1>
          <p class="dashboard-subtitle">Machines, alerts, and maintenance activity for daily operational governance.</p>
        </div>
        <div class="dashboard-actions">
          <button class="dashboard-button secondary" type="button" (click)="refresh()">Refresh</button>
        </div>
      </header>

      <div *ngIf="error()" class="dashboard-error">{{ error() }}</div>
      <div *ngIf="loading()" class="empty-state">Loading operational view...</div>

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
            <h3>Machine status summary</h3>
            <div class="chart-bars">
              <div class="chart-row" *ngFor="let row of machineRows()">
                <strong>{{ row.label }}</strong>
                <div class="chart-track"><div class="chart-fill" [style.width.%]="row.value"></div></div>
                <span>{{ row.display }}</span>
              </div>
            </div>
          </article>

          <article class="chart-card">
            <h3>Maintenance pipeline</h3>
            <div class="chart-bars">
              <div class="chart-row" *ngFor="let row of maintenanceRows()">
                <strong>{{ row.label }}</strong>
                <div class="chart-track"><div class="chart-fill" [style.width.%]="row.value"></div></div>
                <span>{{ row.display }}</span>
              </div>
            </div>
          </article>
        </section>

        <section class="split-grid">
          <article class="table-card">
            <h3>Priority maintenance queue</h3>
            <table class="list-table" *ngIf="queueRows().length; else emptyQueue">
              <thead>
                <tr><th>Task</th><th>Priority</th><th>Status</th><th>Machine</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of queueRows()">
                  <td>{{ row.task }}</td>
                  <td><span class="tone" [class.critical]="row.tone === 'critical'" [class.warning]="row.tone === 'warning'">{{ row.priority }}</span></td>
                  <td>{{ row.status }}</td>
                  <td>{{ row.machine }}</td>
                </tr>
              </tbody>
            </table>
            <ng-template #emptyQueue>
              <div class="empty-state">No maintenance queue items were returned.</div>
            </ng-template>
          </article>

          <article class="table-card">
            <h3>Alert overview</h3>
            <table class="list-table" *ngIf="alertRows().length; else emptyAlerts">
              <thead>
                <tr><th>Alert</th><th>Machine</th><th>Severity</th><th>Age</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of alertRows()">
                  <td>{{ row.title }}</td>
                  <td>{{ row.machine }}</td>
                  <td><span class="tone" [class.critical]="row.tone === 'critical'" [class.warning]="row.tone === 'warning'" [class.info]="row.tone === 'info'">{{ row.severity }}</span></td>
                  <td>{{ row.age }}</td>
                </tr>
              </tbody>
            </table>
            <ng-template #emptyAlerts>
              <div class="empty-state">No alerts available for the admin view.</div>
            </ng-template>
          </article>
        </section>
      </ng-container>
    </section>
  `,
  styles: [DASHBOARD_SHELL_STYLES],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardComponent extends BaseDashboardComponent implements OnInit {
  readonly machines = signal<Machine[]>([]);
  readonly maintenance = signal<Maintenance[]>([]);
  readonly alerts = signal<AlertResponse[]>([]);
  readonly recommendations = signal<MaintenanceRecommendationDTO[]>([]);

  readonly kpiCards = computed<DashboardKpiCard[]>(() => {
    const total = this.machines().length;
    const operational = this.machines().filter((machine) => this.isStatus(machine, 'OPERATIONAL')).length;
    const activeMaintenance = this.maintenance().filter((item) => item.status === 'SCHEDULED' || item.status === 'IN_PROGRESS').length;
    const criticalAlerts = this.alerts().filter((item) => String(item.severity) === 'CRITICAL').length;

    return [
      { label: 'Machines', value: total, note: 'Registered asset base', tone: 'info' },
      { label: 'Operational', value: operational, note: 'Available for production', tone: 'good' },
      { label: 'Maintenance', value: activeMaintenance, note: 'Open and in-flight work', tone: 'warning' },
      { label: 'Critical alerts', value: criticalAlerts, note: 'Needs immediate action', tone: 'critical' },
    ];
  });

  readonly machineRows = computed<DashboardBarRow[]>(() => {
    const total = Math.max(1, this.machines().length);
    const operational = this.machines().filter((machine) => this.isStatus(machine, 'OPERATIONAL')).length;
    const maintenance = this.machines().filter((machine) => this.isStatus(machine, 'MAINTENANCE')).length;
    const faulty = this.machines().filter((machine) => this.isStatus(machine, 'FAULTY')).length;

    return [
      { label: 'Operational', value: Math.round((operational / total) * 100), display: `${operational}`, tone: 'good' },
      { label: 'Maintenance', value: Math.round((maintenance / total) * 100), display: `${maintenance}`, tone: 'warning' },
      { label: 'Faulty', value: Math.round((faulty / total) * 100), display: `${faulty}`, tone: 'critical' },
    ];
  });

  readonly maintenanceRows = computed<DashboardBarRow[]>(() => {
    const total = Math.max(1, this.maintenance().length);
    const scheduled = this.maintenance().filter((item) => item.status === 'SCHEDULED').length;
    const inProgress = this.maintenance().filter((item) => item.status === 'IN_PROGRESS').length;
    const completed = this.maintenance().filter((item) => item.status === 'COMPLETED').length;

    return [
      { label: 'Scheduled', value: Math.round((scheduled / total) * 100), display: `${scheduled}`, tone: 'info' },
      { label: 'In progress', value: Math.round((inProgress / total) * 100), display: `${inProgress}`, tone: 'warning' },
      { label: 'Completed', value: Math.round((completed / total) * 100), display: `${completed}`, tone: 'good' },
    ];
  });

  readonly queueRows = computed(() =>
    this.maintenance()
      .filter((item) => item.status === 'SCHEDULED' || item.status === 'IN_PROGRESS')
      .slice(0, 6)
      .map((item) => ({
        task: item.description,
        priority: item.priority,
        status: item.status,
        machine: `#${item.machineId}`,
        tone: item.priority === 'CRITICAL' || item.priority === 'HIGH' ? 'critical' : 'warning',
      }))
  );

  readonly alertRows = computed(() =>
    this.alerts().slice(0, 6).map((alert) => ({
      title: alert.title,
      machine: alert.machineSerial || String(alert.machineId),
      severity: String(alert.severity),
      age: this.getAgeLabel(alert.createdDate),
      tone: String(alert.severity) === 'CRITICAL' ? 'critical' : String(alert.severity) === 'WARNING' ? 'warning' : 'info',
    }))
  );

  constructor(
    private readonly machineService: MachineService,
    private readonly maintenanceService: MaintenanceService,
    private readonly alertService: AlertApiService,
    private readonly recommendationService: RecommendationService,
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

    this.machineService
      .getAll()
      .pipe(
        catchError(() => of([] as Machine[])),
        switchMap((machines) => {
          this.machines.set(machines);
          const recommendationCalls = machines.slice(0, 8).map((machine) =>
            this.recommendationService.getLatestRecommendation(machine.id).pipe(catchError(() => of(null)))
          );

          return forkJoin({
            maintenance: this.maintenanceService.getAllMaintenanceTasks(0, 100).pipe(
              catchError(() => of({ content: [] as Maintenance[] } as { content: Maintenance[] }))
            ),
            alerts: this.alertService.list({ size: 25 }).pipe(
              catchError(() => of({ content: [] as AlertResponse[] } as { content: AlertResponse[] }))
            ),
            recommendations: recommendationCalls.length ? forkJoin(recommendationCalls) : of([] as Array<MaintenanceRecommendationDTO | null>),
          });
        })
      )
      .subscribe({
        next: ({ maintenance, alerts, recommendations }) => {
          this.maintenance.set(maintenance.content ?? []);
          this.alerts.set(alerts.content ?? []);
          this.recommendations.set((recommendations ?? []).filter((item): item is MaintenanceRecommendationDTO => !!item));
          this.endLoad();
        },
        error: () => {
          this.fail('Admin dashboard data could not be loaded.');
          this.notificationService.error('Admin dashboard data could not be loaded.');
        },
      });
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
