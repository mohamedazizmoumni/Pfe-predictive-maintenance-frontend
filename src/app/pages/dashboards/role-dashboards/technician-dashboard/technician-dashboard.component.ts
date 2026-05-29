import { CommonModule, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  computed,
  AfterViewInit,
  ElementRef,
  ViewChild,
  OnDestroy
} from '@angular/core';

import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { Chart } from 'chart.js/auto';

import { AlertApiService } from '../../../../core/services/alert.service';
import { AuthService } from '../../../../core/services/auth.service';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { MachineService } from '../../../../core/services/machine.service';
import { NotificationService } from '../../../../core/services/notification.service';

import {
  AlertResponse,
  Maintenance
} from '../../../../core/models/sentinel.models';

import { Machine } from '../../../../core/models/machine.model';

import { BaseDashboardComponent } from '../../base-dashboard/base-dashboard.component';

@Component({
  selector: 'app-technician-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor],

  template: `
<section class="dashboard-shell">

  <!-- HEADER -->
  <header class="header">

    <div>
      <p class="eyebrow">TECHNICIAN PANEL</p>

      <h1 class="main-title">
        Operations Dashboard
      </h1>

      <p class="sub-title">
        Maintenance • Alerts • Analytics
      </p>
    </div>

    <button class="refresh-btn" (click)="refresh()">
      ↻ Refresh
    </button>

  </header>

  <!-- KPI -->
  <div class="kpi-grid">

    <div
      class="kpi-card"
      *ngFor="let kpi of kpiCards()">

      <p class="kpi-label">
        {{ kpi.label }}
      </p>

      <h2 class="kpi-value">
        {{ kpi.value }}
      </h2>

    </div>

  </div>

  <!-- MAIN -->
  <div class="dashboard-grid">

    <!-- LEFT -->
    <div class="left-side">

      <!-- TASKS -->
      <div class="panel large-panel">

        <div class="panel-header">
          <div>
            <h3 class="panel-title">
              Today's Schedule
            </h3>

            <p class="panel-subtitle">
              Active technician tasks
            </p>
          </div>
        </div>

        <div class="task-list">

          <div
            *ngFor="let t of taskList()"
            class="task-card">

            <div class="task-left">

              <div
                class="task-dot"
                [ngClass]="{
                  critical: t.priority === 'CRITICAL',
                  high: t.priority === 'HIGH',
                  medium: t.priority === 'MEDIUM',
                  low: t.priority === 'LOW'
                }">
              </div>

              <div>
                <h4 class="task-title">
                  {{ t.task }}
                </h4>

                <p class="task-time">
                  {{ t.schedule }}
                </p>
              </div>

            </div>

            <span class="priority-badge">
              {{ t.priority }}
            </span>

          </div>

        </div>

      </div>

      <!-- BOTTOM -->
      <div class="bottom-grid">

        <!-- ALERTS -->
        <div class="panel">

          <div class="panel-header">
            <h3 class="panel-title">
              Urgent Alerts
            </h3>
          </div>

          <div class="alerts-list">

            <div
              *ngFor="let a of alertRows()"
              class="alert-card">

              <div class="alert-left">

                <span class="alert-dot"></span>

                <div>
                  <strong class="alert-title">
                    {{ a.title }}
                  </strong>

                  <p class="alert-machine">
                    {{ a.machine }}
                  </p>
                </div>

              </div>

              <span class="alert-time">
                {{ a.time }}
              </span>

            </div>

          </div>

        </div>

        <!-- MACHINES -->
        <div class="panel">

          <div class="panel-header">
            <h3 class="panel-title">
              Machine Fleet
            </h3>
          </div>

          <div class="machine-list">

            <div
              *ngFor="let m of machines()"
              class="machine-card">

              <div>
                <strong class="machine-name">
                  {{ m.name }}
                </strong>

                <p class="machine-location">
                  {{ m.location }}
                </p>
              </div>

              <span
                class="machine-status"
                [ngClass]="m.status">
              </span>

            </div>

          </div>

        </div>

      </div>

    </div>

    <!-- RIGHT -->
    <div class="right-side">

      <!-- CALENDAR -->
      <div class="panel">

        <div class="panel-header">
          <h3 class="panel-title">
            This Week
          </h3>
        </div>

        <div class="calendar-grid">

          <div
            *ngFor="let d of calendarDays"
            class="calendar-day"
            [class.active]="d.active">

            {{ d.label }}

          </div>

        </div>

      </div>

      <!-- CHART 1 -->
      <div class="panel chart-panel">

        <div class="panel-header">
          <h3 class="panel-title">
            Tasks Status
          </h3>
        </div>

        <canvas #taskChart></canvas>

      </div>

      <!-- CHART 2 -->
      <div class="panel chart-panel">

        <div class="panel-header">
          <h3 class="panel-title">
            Alerts Severity
          </h3>
        </div>

        <canvas #alertChart></canvas>

      </div>

      <!-- CHART 3 -->
      <div class="panel chart-panel">

        <div class="panel-header">
          <h3 class="panel-title">
            Machines
          </h3>
        </div>

        <canvas #machineChart></canvas>

      </div>

    </div>

  </div>

</section>
  `,

  styles: [`

:host{
  display:block;
  min-height:100vh;

  --bg-primary: var(--color-bg-page);
  --bg-secondary: var(--color-bg-surface);
  --bg-tertiary: var(--color-bg-elevated);

  --border-color: var(--color-border);

  --text-primary: var(--color-text-primary);
  --text-secondary: var(--color-text-secondary);
  --text-muted: var(--color-text-muted);

  --shadow: var(--shadow-sm);

  background:var(--app-bg);
  color:var(--color-text-primary);
  font-family:var(--font-sans);

  transition:
    background 0.3s ease,
    color 0.3s ease;
}

/* =========================================
   DARK MODE SUPPORT
========================================= */

:host-context([data-theme='dark']),
:host-context(body.dark),
:host-context(html.dark){

  --bg-primary: var(--color-bg-page);
  --bg-secondary: var(--color-bg-surface);
  --bg-tertiary: var(--color-bg-elevated);

  --border-color: var(--color-border);

  --text-primary: var(--color-text-primary);
  --text-secondary: var(--color-text-secondary);
  --text-muted: var(--color-text-muted);

  --shadow: var(--shadow-md);
}

/* ======================
   LAYOUT
====================== */

.dashboard-shell{
  padding:28px;
  background:var(--bg-primary);
  min-height:100vh;
  transition:background 0.3s ease;
}

.header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  margin-bottom:28px;
}

.dashboard-grid{
  display:grid;
  grid-template-columns:1.6fr 0.9fr;
  gap:24px;
}

.left-side{
  display:flex;
  flex-direction:column;
  gap:24px;
}

.right-side{
  display:flex;
  flex-direction:column;
  gap:24px;
}

.bottom-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:24px;
}

/* ======================
   TYPOGRAPHY
====================== */

.eyebrow{
  font-size:12px;
  font-weight:700;
  letter-spacing:0.2em;
  color:var(--color-accent-text);
  margin-bottom:8px;
}

.main-title{
  font-size:40px;
  font-weight:800;
  margin:0;
  color:var(--text-primary);
}

.sub-title{
  margin-top:10px;
  font-size:15px;
  color:var(--text-secondary);
}

/* ======================
   BUTTON
====================== */

.refresh-btn{
  border:none;
  background:linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));

  color:var(--color-text-on-accent);
  padding:14px 22px;
  border-radius:16px;
  font-weight:700;
  cursor:pointer;

  transition:
    transform 0.2s ease,
    opacity 0.2s ease,
    box-shadow 0.2s ease;

  box-shadow:
    var(--shadow-accent);
}

.refresh-btn:hover{
  transform:translateY(-2px);
  opacity:0.95;
}

.refresh-btn:active{
  transform:scale(0.98);
}

/* ======================
   PANELS
====================== */

.panel,
.kpi-card{
  background:var(--bg-secondary);
  border-radius:24px;
  border:1px solid var(--border-color);
  box-shadow:var(--shadow);

  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease;
}

.panel{
  padding:24px;
}

.large-panel{
  min-height:500px;
}

.panel-header{
  margin-bottom:20px;
}

.panel-title{
  margin:0;
  font-size:18px;
  font-weight:700;
  color:var(--text-primary);
}

.panel-subtitle{
  margin-top:4px;
  color:var(--text-muted);
  font-size:13px;
}

/* ======================
   KPI
====================== */

.kpi-grid{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:18px;
  margin-bottom:28px;
}

.kpi-card{
  padding:22px;
}

.kpi-label{
  margin:0;
  color:var(--text-muted);
  font-size:13px;
}

.kpi-value{
  margin-top:10px;
  margin-bottom:0;
  font-size:38px;
  font-weight:800;
  color:var(--text-primary);
}

/* ======================
   TASKS
====================== */

.task-list{
  display:flex;
  flex-direction:column;
  gap:14px;
}

.task-card{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:18px;
  border-radius:18px;
  border:1px solid var(--border-color);
  background:var(--bg-tertiary);

  transition:
    transform 0.2s ease,
    background 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.2s ease;
}

.task-card:hover{
  transform:translateY(-2px);

  box-shadow:
    0 10px 20px rgba(15,23,42,0.12);
}

.task-left{
  display:flex;
  align-items:center;
  gap:14px;
}

.task-dot{
  width:12px;
  height:12px;
  border-radius:999px;
}

.task-dot.critical{
  background:var(--color-critical);
}

.task-dot.high{
  background:var(--color-danger);
}

.task-dot.medium{
  background:var(--color-warning);
}

.task-dot.low{
  background:var(--color-success);
}

.task-title{
  margin:0;
  font-size:15px;
  font-weight:700;
  color:var(--text-primary);
}

.task-time{
  margin-top:4px;
  margin-bottom:0;
  font-size:12px;
  color:var(--text-muted);
}

.priority-badge{
  padding:8px 14px;
  border-radius:999px;

  background:var(--color-accent-dim);
  color:var(--color-accent-text);

  border:1px solid var(--color-border-focus);

  font-size:12px;
  font-weight:700;
}

/* ======================
   ALERTS
====================== */

.alerts-list{
  display:flex;
  flex-direction:column;
  gap:12px;
}

.alert-card{
  display:flex;
  justify-content:space-between;
  align-items:center;

  padding:16px;

  border-radius:18px;
  border:1px solid var(--border-color);

  background:var(--bg-tertiary);

  transition:
    background 0.3s ease,
    border-color 0.3s ease;
}

.alert-left{
  display:flex;
  align-items:center;
  gap:12px;
}

.alert-dot{
  width:10px;
  height:10px;
  border-radius:999px;
  background:var(--color-danger);
}

.alert-title{
  color:var(--text-primary);
}

.alert-machine{
  margin-top:4px;
  margin-bottom:0;
  font-size:12px;
  color:var(--text-muted);
}

.alert-time{
  font-size:12px;
  color:var(--text-muted);
}

/* ======================
   MACHINES
====================== */

.machine-list{
  display:flex;
  flex-direction:column;
  gap:12px;
}

.machine-card{
  display:flex;
  justify-content:space-between;
  align-items:center;

  padding:16px;

  border-radius:18px;
  border:1px solid var(--border-color);

  background:var(--bg-tertiary);

  transition:
    background 0.3s ease,
    border-color 0.3s ease;
}

.machine-name{
  color:var(--text-primary);
}

.machine-location{
  margin-top:4px;
  margin-bottom:0;
  font-size:12px;
  color:var(--text-muted);
}

.machine-status{
  width:14px;
  height:14px;
  border-radius:999px;
}

.machine-status.OPERATIONAL{
  background:var(--color-success);
}

.machine-status.STOPPED{
  background:var(--color-danger);
}

.machine-status.MAINTENANCE{
  background:var(--color-warning);
}

/* ======================
   CALENDAR
====================== */

.calendar-grid{
  display:grid;
  grid-template-columns:repeat(7,1fr);
  gap:10px;
}

.calendar-day{
  height:58px;

  display:flex;
  align-items:center;
  justify-content:center;

  border-radius:16px;

  background:var(--bg-tertiary);

  border:1px solid var(--border-color);

  color:var(--text-secondary);

  font-weight:700;

  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease;
}

.calendar-day.active{
  background:linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));

  color:var(--color-text-on-accent);

  border:none;

  box-shadow:
    var(--shadow-accent);
}

/* ======================
   CHARTS
====================== */

.chart-panel{
  height:320px;
}

canvas{
  width:100% !important;
  max-height:220px !important;
}

/* ======================
   SCROLLBAR
====================== */

::-webkit-scrollbar{
  width:10px;
}

::-webkit-scrollbar-track{
  background:var(--bg-primary);
}

::-webkit-scrollbar-thumb{
  background:var(--color-text-muted);
  border-radius:999px;
}

/* ======================
   RESPONSIVE
====================== */

@media(max-width:1200px){

  .dashboard-grid{
    grid-template-columns:1fr;
  }

  .bottom-grid{
    grid-template-columns:1fr;
  }

}

@media(max-width:768px){

  .dashboard-shell{
    padding:18px;
  }

  .header{
    flex-direction:column;
    gap:16px;
  }

  .main-title{
    font-size:32px;
  }

  .kpi-grid{
    grid-template-columns:1fr 1fr;
  }

}

@media(max-width:500px){

  .kpi-grid{
    grid-template-columns:1fr;
  }

}

  `],

  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class TechnicianDashboardComponent
  extends BaseDashboardComponent
  implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('taskChart')
  taskChartRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('alertChart')
  alertChartRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('machineChart')
  machineChartRef!: ElementRef<HTMLCanvasElement>;

  readonly tasks = signal<Maintenance[]>([]);
  readonly alerts = signal<AlertResponse[]>([]);
  readonly machines = signal<Machine[]>([]);

  private taskChart?: Chart;
  private alertChart?: Chart;
  private machineChart?: Chart;

  private observer?: MutationObserver;

  calendarDays = [
    { label: '1' },
    { label: '2' },
    { label: '3', active: true },
    { label: '4' },
    { label: '5' },
    { label: '6' },
    { label: '7' },
    { label: '8' },
    { label: '9' },
    { label: '10' },
    { label: '11' },
    { label: '12' },
    { label: '13' },
    { label: '14' },
  ];

  constructor(
    private auth: AuthService,
    private machineService: MachineService,
    private maintenance: MaintenanceService,
    private alertService: AlertApiService,
    private notifier: NotificationService
  ) {
    super();
  }

  loadDashboardData(): void {
    this.load();
  }

  ngOnInit(): void {

    this.load();

    this.observeThemeChanges();

  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {

    this.taskChart?.destroy();
    this.alertChart?.destroy();
    this.machineChart?.destroy();

    this.observer?.disconnect();

  }

  refresh(): void {
    this.load();
  }

  private observeThemeChanges(): void {

    this.observer = new MutationObserver(() => {
      setTimeout(() => this.renderCharts());
    });

    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    this.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

  }

  private isDarkMode(): boolean {

    return (
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark')
    );

  }

  private load(): void {

    this.beginLoad();

    const user = this.auth.getCurrentUser();

    if (!user) {
      this.fail('No active session');
      return;
    }

    this.machineService.getAll().pipe(

      catchError(() => of([] as Machine[])),

      switchMap((machines: Machine[]) => {

        this.machines.set(machines);

        return forkJoin({

          tasks: this.maintenance
            .getTechnicianTasks(user.id, 0, 100)
            .pipe(catchError(() => of({ content: [] as Maintenance[] }))),

          alerts: this.alertService
            .list({
              assignedTo: user.username,
              size: 50
            })
            .pipe(
              catchError(() =>
                of({ content: [] as AlertResponse[] })
              )
            )

        });

      })

    ).subscribe({

      next: (res: { tasks: any; alerts: any }) => {

        const tasks = res.tasks.content ?? [];
        const alerts = res.alerts.content ?? [];

        this.tasks.set(tasks);
        this.alerts.set(alerts);

        setTimeout(() => {
          this.renderCharts();
        });

        this.endLoad();
      },

      error: () => this.fail('Dashboard load failed')

    });

  }

  readonly kpiCards = computed(() => {

    const t = this.tasks();
    const a = this.alerts();

    return [
      {
        label: 'Tasks',
        value: t.length
      },
      {
        label: 'In Progress',
        value: t.filter(x => x.status === 'IN_PROGRESS').length
      },
      {
        label: 'Completed',
        value: t.filter(x => x.status === 'COMPLETED').length
      },
      {
        label: 'Alerts',
        value: a.length
      }
    ];

  });

  readonly taskList = computed(() =>
    this.tasks().slice(0, 6).map(t => ({
      task: t.description,
      schedule: new Date(
        t.scheduledDate
      ).toLocaleString(),
      priority: t.priority
    }))
  );

  readonly alertRows = computed(() =>
    this.alerts().slice(0, 5).map(a => ({
      title: a.title,
      machine:
        a.machineSerial ??
        String(a.machineId),
      time: this.getAge(a.createdDate)
    }))
  );

  private renderCharts(): void {

    if (
      !this.taskChartRef?.nativeElement ||
      !this.alertChartRef?.nativeElement ||
      !this.machineChartRef?.nativeElement
    ) {
      return;
    }

    this.taskChart?.destroy();
    this.alertChart?.destroy();
    this.machineChart?.destroy();

    const dark = this.isDarkMode();

    const rootStyles = getComputedStyle(document.documentElement);

    const accent = rootStyles.getPropertyValue('--color-accent').trim() || '#2563eb';
    const accentHover = rootStyles.getPropertyValue('--color-accent-hover').trim() || '#3b82f6';
    const warning = rootStyles.getPropertyValue('--color-warning').trim() || '#f59e0b';
    const success = rootStyles.getPropertyValue('--color-success').trim() || '#22c55e';
    const danger = rootStyles.getPropertyValue('--color-danger').trim() || '#ef4444';
    const textColor = rootStyles.getPropertyValue('--color-text-primary').trim() || (dark ? '#e2e8f0' : '#334155');
    const mutedText = rootStyles.getPropertyValue('--color-text-muted').trim() || (dark ? '#94a3b8' : '#475569');

    const gridColor = dark
      ? 'rgba(148,163,184,0.15)'
      : rootStyles.getPropertyValue('--color-border-soft').trim() || '#e2e8f0';

    const tasks = this.tasks();
    const alerts = this.alerts();
    const machines = this.machines();

    const commonOptions: any = {

      responsive: true,

      maintainAspectRatio: false,

      plugins: {

        legend: {
          labels: {
            color: textColor,
            font: {
              size: 12,
              weight: '600'
            }
          }
        }

      },

      scales: {

        x: {

          ticks: {
            color: mutedText
          },

          grid: {
            color: gridColor
          }

        },

        y: {

          ticks: {
            color: mutedText
          },

          grid: {
            color: gridColor
          }

        }

      }

    };

    this.taskChart = new Chart(
      this.taskChartRef.nativeElement,
      {
        type: 'bar',

        data: {

          labels: [
            'Scheduled',
            'In Progress',
            'Completed'
          ],

          datasets: [
            {
              label: 'Tasks',

              data: [
                tasks.filter(
                  t => t.status === 'SCHEDULED'
                ).length,

                tasks.filter(
                  t => t.status === 'IN_PROGRESS'
                ).length,

                tasks.filter(
                  t => t.status === 'COMPLETED'
                ).length
              ],

              backgroundColor: [
                accent,
                accentHover,
                accent
              ],

              borderRadius: 10
            }
          ]
        },

        options: commonOptions
      }
    );

    this.alertChart = new Chart(
      this.alertChartRef.nativeElement,
      {
        type: 'doughnut',

        data: {

          labels: [
            'Critical',
            'High',
            'Medium',
            'Low'
          ],

          datasets: [
            {
              data: [
                this.count(alerts, 'CRITICAL'),
                this.count(alerts, 'HIGH'),
                this.count(alerts, 'MEDIUM'),
                this.count(alerts, 'LOW')
              ],

              backgroundColor: [
                danger,
                rootStyles.getPropertyValue('--color-danger-text').trim() || '#f97316',
                warning,
                success
              ],

              borderWidth: 0
            }
          ]
        },

        options: {

          responsive: true,

          maintainAspectRatio: false,

          plugins: {

            legend: {
              labels: {
                color: textColor
              }
            }

          }

        }
      }
    );

    this.machineChart = new Chart(
      this.machineChartRef.nativeElement,
      {
        type: 'pie',

        data: {

          labels: [
            'Operational',
            'Stopped',
            'Maintenance'
          ],

          datasets: [
            {
              data: [
                machines.filter(
                  m => m.status === 'OPERATIONAL'
                ).length,

                machines.filter(
                  m => m.status === 'STOPPED'
                ).length,

                machines.filter(
                  m => m.status === 'MAINTENANCE'
                ).length
              ],

              backgroundColor: [
                success,
                danger,
                warning
              ],

              borderWidth: 0
            }
          ]
        },

        options: {

          responsive: true,

          maintainAspectRatio: false,

          plugins: {

            legend: {
              labels: {
                color: textColor
              }
            }

          }

        }
      }
    );

  }

  private count(
    alerts: AlertResponse[],
    level: string
  ): number {

    return alerts.filter(
      a =>
        String(a.severity)
          .toUpperCase() === level
    ).length;

  }

  private getAge(date: string): string {

    const h = Math.floor(
      (
        Date.now() -
        new Date(date).getTime()
      ) / 3600000
    );

    if (h < 24) {
      return h + 'h ago';
    }

    return Math.floor(h / 24) + 'd ago';

  }

}