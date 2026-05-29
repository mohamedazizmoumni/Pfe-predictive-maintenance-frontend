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

import {
  BaseDashboardComponent,
  DashboardBarRow,
  DashboardKpiCard
} from '../../base-dashboard/base-dashboard.component';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, DecimalPipe],

  template: `
    <section class="manager-dashboard">

      <!-- TOP HEADER -->
      <header class="topbar">
        <div class="search-box">
          <span>🔍</span>
          <input type="text" placeholder="Search assets, tasks, alerts..." />
        </div>

        <div class="topbar-actions">
          <button class="notification-btn">🔔</button>
          <button class="manager-btn">Manager</button>
        </div>
      </header>

      <!-- KPI BANNER (4 wide cards like screenshot) -->
      <section class="kpi-banner">
        <article class="kpi-banner-card" *ngFor="let card of kpiCards()">
          <p class="kpi-banner-label">{{ card.label }}</p>
          <h2 class="kpi-banner-value">{{ card.value }}</h2>
          <p class="kpi-banner-note">{{ card.note }}</p>
        </article>
      </section>

      <!-- LOADING -->
      <div class="loading-card" *ngIf="loading()">
        Loading dashboard data...
      </div>

      <!-- ERROR -->
      <div class="error-card" *ngIf="error()">
        {{ error() }}
      </div>

      <ng-container *ngIf="!loading()">

        <!-- ROW 1: Line chart + Critical Assets -->
        <section class="row-grid">

          <!-- MAINTENANCE WORKLOAD LINE CHART -->
          <article class="panel chart-panel">
            <div class="panel-header">
              <div>
                <h3>Maintenance Workload</h3>
                <p class="panel-sub">This week</p>
              </div>
              <button class="refresh-btn" (click)="refresh()">Refresh Dashboard</button>
            </div>

            <div class="line-chart-area">
              <svg viewBox="0 0 860 200" preserveAspectRatio="none" class="line-svg">
                <!-- Grid lines -->
                <line x1="0" y1="160" x2="860" y2="160" stroke="#e2e8f0" stroke-width="1"/>
                <line x1="0" y1="120" x2="860" y2="120" stroke="#e2e8f0" stroke-width="1"/>
                <line x1="0" y1="80"  x2="860" y2="80"  stroke="#e2e8f0" stroke-width="1"/>
                <line x1="0" y1="40"  x2="860" y2="40"  stroke="#e2e8f0" stroke-width="1"/>

                <!-- Y labels -->
                <text x="0" y="164" fill="#94a3b8" font-size="11">0</text>
                <text x="0" y="124" fill="#94a3b8" font-size="11">5</text>
                <text x="0" y="84"  fill="#94a3b8" font-size="11">10</text>
                <text x="0" y="44"  fill="#94a3b8" font-size="11">15</text>

                <!-- Operational line (blue) -->
                <polyline
                  points="20,120 160,100 310,88 450,72 600,60 750,58 840,56"
                  fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round"/>

                <!-- Maintenance line (green) -->
                <polyline
                  points="20,108 160,112 310,108 450,100 600,96 750,92 840,90"
                  fill="none" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round"/>

                <!-- Faulty line (red) -->
                <polyline
                  points="20,155 160,152 310,148 450,150 600,152 750,150 840,152"
                  fill="none" stroke="#f43f5e" stroke-width="2" stroke-linejoin="round"/>

                <!-- X axis labels -->
                <text x="20"  y="185" fill="#94a3b8" font-size="11" text-anchor="middle">Mon</text>
                <text x="160" y="185" fill="#94a3b8" font-size="11" text-anchor="middle">Tue</text>
                <text x="310" y="185" fill="#94a3b8" font-size="11" text-anchor="middle">Wed</text>
                <text x="450" y="185" fill="#94a3b8" font-size="11" text-anchor="middle">Thu</text>
                <text x="600" y="185" fill="#94a3b8" font-size="11" text-anchor="middle">Fri</text>
                <text x="750" y="185" fill="#94a3b8" font-size="11" text-anchor="middle">Sat</text>
                <text x="840" y="185" fill="#94a3b8" font-size="11" text-anchor="middle">Sun</text>
              </svg>

              <!-- Legend -->
              <div class="chart-legend">
                <span class="legend-dot blue"></span><span>Operational</span>
                <span class="legend-dot green"></span><span>Maintenance</span>
                <span class="legend-dot red"></span><span>Faulty</span>
              </div>
            </div>
          </article>

          <!-- CRITICAL ASSETS (right sidebar) -->
          <article class="panel">
            <div class="panel-header">
              <h3>Critical Assets</h3>
            </div>

            <div class="assets-list">
              <div class="asset-row" *ngFor="let row of uptimeRows()">
                <div class="asset-top">
                  <div class="asset-dot" [ngClass]="row.tone"></div>
                  <span class="asset-name">{{ row.label }}</span>
                  <span class="asset-pct">{{ row.display }}</span>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    [ngClass]="row.tone"
                    [style.width.%]="row.value"
                  ></div>
                </div>
              </div>
            </div>
          </article>

        </section>

        <!-- ROW 2: Alert Trend bar chart + Team Roster + Today's Priorities -->
        <section class="row-grid-3">

          <!-- ALERT TREND BAR CHART -->
          <article class="panel">
            <div class="panel-header">
              <h3>Alert Trend</h3>
            </div>

            <div class="bar-chart-area">
              <svg viewBox="0 0 340 160" class="bar-svg">
                <!-- Grid -->
                <line x1="30" y1="20"  x2="330" y2="20"  stroke="#e2e8f0" stroke-width="1"/>
                <line x1="30" y1="55"  x2="330" y2="55"  stroke="#e2e8f0" stroke-width="1"/>
                <line x1="30" y1="90"  x2="330" y2="90"  stroke="#e2e8f0" stroke-width="1"/>
                <line x1="30" y1="125" x2="330" y2="125" stroke="#e2e8f0" stroke-width="1"/>

                <!-- Y labels -->
                <text x="24" y="24"  fill="#94a3b8" font-size="10" text-anchor="end">4</text>
                <text x="24" y="59"  fill="#94a3b8" font-size="10" text-anchor="end">3</text>
                <text x="24" y="94"  fill="#94a3b8" font-size="10" text-anchor="end">2</text>
                <text x="24" y="129" fill="#94a3b8" font-size="10" text-anchor="end">1</text>
                <text x="24" y="145" fill="#94a3b8" font-size="10" text-anchor="end">0</text>

                <!-- Bars (Mon–Sun) -->
                <rect x="42"  y="90"  width="26" height="35" rx="5" fill="#f43f5e" opacity=".85"/>
                <rect x="88"  y="55"  width="26" height="70" rx="5" fill="#f43f5e" opacity=".85"/>
                <rect x="134" y="20"  width="26" height="105" rx="5" fill="#f43f5e" opacity=".85"/>
                <rect x="180" y="55"  width="26" height="70" rx="5" fill="#f43f5e" opacity=".85"/>
                <rect x="226" y="90"  width="26" height="35" rx="5" fill="#f43f5e" opacity=".6"/>
                <rect x="272" y="108" width="26" height="17" rx="5" fill="#f43f5e" opacity=".6"/>
                <rect x="296" y="108" width="26" height="17" rx="5" fill="#f43f5e" opacity=".5"/>

                <!-- X labels -->
                <text x="55"  y="150" fill="#94a3b8" font-size="10" text-anchor="middle">Mon</text>
                <text x="101" y="150" fill="#94a3b8" font-size="10" text-anchor="middle">Tue</text>
                <text x="147" y="150" fill="#94a3b8" font-size="10" text-anchor="middle">Wed</text>
                <text x="193" y="150" fill="#94a3b8" font-size="10" text-anchor="middle">Thu</text>
                <text x="239" y="150" fill="#94a3b8" font-size="10" text-anchor="middle">Fri</text>
                <text x="285" y="150" fill="#94a3b8" font-size="10" text-anchor="middle">Sat</text>
                <text x="309" y="150" fill="#94a3b8" font-size="10" text-anchor="middle">Sun</text>
              </svg>
            </div>
          </article>

          <!-- TEAM ROSTER -->
          <article class="panel">
            <div class="panel-header">
              <h3>Team Roster</h3>
            </div>

            <div class="team-list">
              <div class="team-item" *ngFor="let row of teamRows()">
                <div class="team-info">
                  <h4>{{ row.label }}</h4>
                  <p>{{ row.display }}</p>
                </div>
                <span class="team-badge" [ngClass]="row.tone">{{ row.display }}</span>
              </div>
            </div>
          </article>

          <!-- TODAY'S PRIORITIES -->
          <article class="panel">
            <div class="panel-header">
              <h3>Today's Priorities</h3>
            </div>

            <div
              class="priority-item"
              *ngFor="let item of recommendations().slice(0,5)"
            >
              <div class="priority-index">
                {{ recommendations().indexOf(item) + 1 }}
              </div>
              <div class="priority-content">
                <h4>{{ item.machineName || ('Machine #' + item.machineId) }}</h4>
                <p>{{ item.recommendedAction }}</p>
              </div>
              <span class="priority-arrow">↗</span>
            </div>

            <div class="empty-small" *ngIf="!recommendations().length">
              No recommendations available.
            </div>
          </article>

        </section>

        <!-- ROW 3: Maintenance + Alerts -->
        <section class="row-grid-2">

          <!-- MAINTENANCE -->
          <article class="panel">
            <div class="panel-header">
              <h3>Maintenance Overview</h3>
            </div>
            <div class="table-wrapper">
              <div class="table-item" *ngFor="let row of maintenanceRows()">
                <div>
                  <h4>{{ row.task }}</h4>
                  <p>{{ row.machine }}</p>
                </div>
                <div class="table-badges">
                  <span class="badge status">{{ row.status }}</span>
                  <span
                    class="badge"
                    [class.critical]="row.tone === 'critical'"
                    [class.warning]="row.tone === 'warning'"
                    [class.good]="row.tone === 'good'"
                  >{{ row.priority }}</span>
                </div>
              </div>
            </div>
          </article>

          <!-- ALERTS -->
          <article class="panel">
            <div class="panel-header">
              <h3>Operational Alerts</h3>
            </div>
            <div class="table-wrapper">
              <div class="table-item" *ngFor="let row of alertRows()">
                <div>
                  <h4>{{ row.title }}</h4>
                  <p>{{ row.machine }} • {{ row.age }}</p>
                </div>
                <span
                  class="badge"
                  [class.critical]="row.tone === 'critical'"
                  [class.warning]="row.tone === 'warning'"
                  [class.info]="row.tone === 'info'"
                >{{ row.severity }}</span>
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
      width: 100%;
      min-height: 100vh;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: 'Inter', sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── DASHBOARD WRAPPER ── */
    .manager-dashboard {
      padding: 24px;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(59,130,246,.07), transparent 35%),
        radial-gradient(circle at bottom right, rgba(16,185,129,.05), transparent 35%),
        #f1f5f9;
    }

    /* ── TOPBAR ── */
    .topbar {
      height: 64px;
      border-radius: 18px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 12px rgba(15,23,42,.06);
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .search-box {
      width: 340px;
      height: 40px;
      border-radius: 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
    }

    .search-box input {
      border: none;
      outline: none;
      width: 100%;
      background: transparent;
      color: var(--text-primary);
      font-size: 14px;
    }

    .search-box input::placeholder { color: #94a3b8; }

    .topbar-actions { display: flex; align-items: center; gap: 10px; }

    .notification-btn,
    .manager-btn,
    .refresh-btn {
      border: none;
      cursor: pointer;
      transition: .2s ease;
      font-family: inherit;
    }

    .notification-btn {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      font-size: 16px;
    }

    .notification-btn:hover { background: var(--hover-bg); }

    .manager-btn {
      height: 40px;
      padding: 0 18px;
      border-radius: 12px;
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      color: white;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 4px 14px rgba(59,130,246,.3);
    }

    .manager-btn:hover { transform: translateY(-1px); }

    .refresh-btn {
      height: 36px;
      padding: 0 16px;
      border-radius: 10px;
      background: linear-gradient(135deg, #10b981, #14b8a6);
      color: white;
      font-weight: 600;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(16,185,129,.25);
    }

    .refresh-btn:hover { transform: translateY(-1px); }

    /* ── KPI BANNER ── */
    .kpi-banner {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(15,23,42,.06);
      margin-bottom: 20px;
    }

    .kpi-banner-card {
      padding: 24px 28px;
      border-right: 1px solid #e2e8f0;
      transition: .2s ease;
    }

    .kpi-banner-card:last-child { border-right: none; }
    .kpi-banner-card:hover { background: var(--bg-secondary); }

    .kpi-banner-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .kpi-banner-value {
      font-size: 36px;
      font-weight: 800;
      color: var(--text-primary);
      line-height: 1;
      margin-bottom: 8px;
    }

    .kpi-banner-note {
      font-size: 12px;
      color: #10b981;
      font-weight: 500;
    }

    /* ── PANELS ── */
    .panel {
      background: var(--bg-card);
      border-radius: 18px;
      padding: 22px;
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 12px rgba(15,23,42,.05);
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .panel-header h3 {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .panel-sub {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* ── ROW GRIDS ── */
    .row-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    .row-grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    .row-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    /* ── LINE CHART ── */
    .chart-panel { }

    .line-chart-area {
      position: relative;
    }

    .line-svg {
      width: 100%;
      height: 200px;
      display: block;
    }

    .chart-legend {
      display: flex;
      gap: 18px;
      align-items: center;
      margin-top: 10px;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .legend-dot.blue  { background: #3b82f6; }
    .legend-dot.green { background: #10b981; }
    .legend-dot.red   { background: #f43f5e; }

    /* ── CRITICAL ASSETS ── */
    .assets-list {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .asset-row { }

    .asset-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .asset-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .asset-dot.good     { background: #10b981; }
    .asset-dot.warning  { background: #f59e0b; }
    .asset-dot.critical { background: #ef4444; }

    .asset-name {
      flex: 1;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .asset-pct {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .progress-track {
      width: 100%;
      height: 7px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: inherit;
      transition: width .4s ease;
    }

    .progress-fill.good     { background: linear-gradient(90deg, #10b981, #34d399); }
    .progress-fill.warning  { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .progress-fill.critical { background: linear-gradient(90deg, #ef4444, #fb7185); }

    /* ── BAR CHART ── */
    .bar-chart-area { }
    .bar-svg { width: 100%; height: 160px; display: block; }

    /* ── TEAM ROSTER ── */
    .team-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .team-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-radius: 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      transition: .2s;
    }

    .team-item:hover { background: var(--hover-bg); border-color: #bfdbfe; }

    .team-info h4 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
    }

    .team-info p {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .team-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
    }

    .team-badge.info    { background: #dbeafe; color: #2563eb; }
    .team-badge.warning { background: #fef3c7; color: #d97706; }

    /* ── PRIORITIES ── */
    .priority-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .priority-item:last-of-type { border-bottom: none; }

    .priority-index {
      min-width: 30px;
      height: 30px;
      border-radius: 9px;
      background: linear-gradient(135deg, #2563eb, #60a5fa);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
      box-shadow: 0 4px 10px rgba(59,130,246,.2);
    }

    .priority-content { flex: 1; }

    .priority-content h4 {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 3px;
    }

    .priority-content p {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .priority-arrow {
      font-size: 14px;
      color: #94a3b8;
      flex-shrink: 0;
      transition: .2s;
    }

    .priority-item:hover .priority-arrow {
      color: #2563eb;
      transform: translateX(2px) translateY(-2px);
    }

    /* ── TABLE ITEMS ── */
    .table-wrapper {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .table-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      transition: .2s;
    }

    .table-item:hover {
      transform: translateX(3px);
      background: var(--bg-card);
      border-color: #bfdbfe;
    }

    .table-item h4 {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 3px;
    }

    .table-item p {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .table-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    /* ── BADGES ── */
    .badge {
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .badge.status   { background: #dbeafe; color: #2563eb; }
    .badge.good     { background: #dcfce7; color: #16a34a; }
    .badge.warning  { background: #fef3c7; color: #d97706; }
    .badge.critical { background: #fee2e2; color: #dc2626; }
    .badge.info     { background: #dbeafe; color: #2563eb; }

    /* ── STATES ── */
    .loading-card,
    .error-card,
    .empty-small {
      padding: 18px;
      border-radius: 14px;
      background: white;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 20px;
    }

    .error-card {
      color: #dc2626;
      border-color: #fecaca;
      background: #fef2f2;
    }

    /* ── RESPONSIVE ── */
    @media (max-width: 1200px) {
      .row-grid,
      .row-grid-3 { grid-template-columns: 1fr; }
      .kpi-banner { grid-template-columns: repeat(2, 1fr); }
      .kpi-banner-card:nth-child(2) { border-right: none; }
    }

    @media (max-width: 768px) {
      .manager-dashboard { padding: 14px; }
      .topbar { flex-direction: column; height: auto; padding: 14px; gap: 12px; }
      .search-box { width: 100%; }
      .kpi-banner { grid-template-columns: 1fr; }
      .kpi-banner-card { border-right: none; border-bottom: 1px solid #e2e8f0; }
      .kpi-banner-card:last-child { border-bottom: none; }
      .row-grid-2 { grid-template-columns: 1fr; }
    }
  `],

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagerDashboardComponent extends BaseDashboardComponent implements OnInit {

  readonly machines = signal<Machine[]>([]);
  readonly maintenance = signal<Maintenance[]>([]);
  readonly alerts = signal<AlertResponse[]>([]);
  readonly recommendations = signal<MaintenanceRecommendationDTO[]>([]);

  readonly kpiCards = computed<DashboardKpiCard[]>(() => {
    const total = this.machines().length;

    const uptime = this.machines().filter(m => this.isOperational(m)).length;

    const openMaintenance = this.maintenance().filter(
      item => item.status === 'SCHEDULED' || item.status === 'IN_PROGRESS'
    ).length;

    const teamMembers = new Set(
      this.maintenance().map(item => item.assignedTechnicianId || 'Unassigned')
    ).size;

    return [
      { label: 'Asset Uptime',       value: `${Math.round((uptime / Math.max(1, total)) * 100)}%`, note: '↑ 1.1% vs last period', tone: 'good' },
      { label: 'Open Work Orders',   value: openMaintenance,  note: '↓ 6.2% vs last period', tone: 'warning' },
      { label: 'Active Alerts',      value: this.alerts().length, note: '↓ 3.4% vs last period', tone: 'info' },
      { label: 'Team Productivity',  value: `${teamMembers > 0 ? 88 : 0}%`, note: '↑ 2.7% vs last period', tone: 'good' },
    ];
  });

  readonly uptimeRows = computed<DashboardBarRow[]>(() => {
    const total = Math.max(1, this.machines().length);

    const operational = this.machines().filter(m => this.isOperational(m)).length;
    const maintenance  = this.machines().filter(m => this.isMaintenance(m)).length;
    const faulty       = this.machines().filter(m => this.isFaulty(m)).length;

    return [
      { label: 'Compressor A',  value: Math.round((operational / total) * 100), display: `${operational} machines`, tone: 'good' },
      { label: 'Boiler 3',      value: Math.round((maintenance  / total) * 100), display: `${maintenance} machines`,  tone: 'warning' },
      { label: 'Conveyor C7',   value: Math.round(((operational * .8) / total) * 100), display: `${Math.round(operational * .8)} machines`, tone: 'good' },
      { label: 'Pump P-14',     value: Math.round((faulty / Math.max(1, total)) * 100), display: `${faulty} machines`, tone: 'critical' },
      { label: 'Generator G2',  value: Math.round((operational / total) * 100), display: `${operational} machines`, tone: 'good' },
    ];
  });

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

    return rows.map(([label, value]) => ({
      label,
      value: Math.round((value / total) * 100),
      display: `${value} tasks`,
      tone: value > 4 ? 'warning' : 'info',
    }));
  });

  readonly maintenanceRows = computed(() =>
    this.maintenance().slice(0, 6).map(item => ({
      task:     item.description,
      status:   item.status,
      priority: item.priority,
      machine:  `Machine #${item.machineId}`,
      tone:
        item.priority === 'CRITICAL' || item.priority === 'HIGH' ? 'critical' :
        item.priority === 'MEDIUM' ? 'warning' : 'good',
    }))
  );

  readonly alertRows = computed(() =>
    this.alerts().slice(0, 6).map(alert => ({
      title:    alert.title,
      machine:  alert.machineSerial || String(alert.machineId),
      severity: String(alert.severity),
      age:      this.getAgeLabel(alert.createdDate),
      tone:
        String(alert.severity) === 'CRITICAL' ? 'critical' :
        String(alert.severity) === 'WARNING'  ? 'warning'  : 'info',
    }))
  );

  constructor(
    private readonly machineService: MachineService,
    private readonly maintenanceService: MaintenanceService,
    private readonly alertService: AlertApiService,
    private readonly recommendationService: RecommendationService,
    private readonly notificationService: NotificationService,
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

        const recommendationCalls = machines.slice(0, 8).map(machine =>
          this.recommendationService.getLatestRecommendation(machine.id).pipe(catchError(() => of(null)))
        );

        return forkJoin({
          maintenance: this.maintenanceService
            .getAllMaintenanceTasks(0, 100)
            .pipe(catchError(() => of({ content: [] as Maintenance[] }))),

          alerts: this.alertService
            .list({ size: 25 })
            .pipe(catchError(() => of({ content: [] as AlertResponse[] }))),

          recommendations: recommendationCalls.length
            ? forkJoin(recommendationCalls)
            : of([] as Array<MaintenanceRecommendationDTO | null>),
        });
      })
    ).subscribe({
      next: ({ maintenance, alerts, recommendations }) => {
        this.maintenance.set(maintenance.content ?? []);
        this.alerts.set(alerts.content ?? []);
        this.recommendations.set(
          (recommendations ?? []).filter((item): item is MaintenanceRecommendationDTO => !!item)
        );
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

  private getAgeLabel(createdDate: string): string {
    const created = new Date(createdDate);
    const hours = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60)));
    return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  }
}