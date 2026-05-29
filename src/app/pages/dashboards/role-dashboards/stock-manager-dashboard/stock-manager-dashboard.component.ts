import { CommonModule, CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chart } from 'chart.js/auto';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/services/auth.service';
import { InventoryService } from '../../../../core/services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { InventoryStats, Part, ReorderRequest, StockOrder } from '../../../../core/models/sentinel.models';
import { BaseDashboardComponent, DashboardKpiCard } from '../../base-dashboard/base-dashboard.component';
import { DASHBOARD_SHELL_STYLES } from '../../base-dashboard/dashboard-shell.styles';

interface CategoryRow {
  label: string;
  count: number;
  value: number;
  tone: 'good' | 'warning' | 'critical' | 'info';
}

interface PriorityRow {
  sku: string;
  part: string;
  category: string;
  stock: number;
  target: number;
  tone: 'good' | 'warning' | 'critical';
}

interface ShipmentRow {
  name: string;
  eta: string;
  quantity: number;
  status: string;
  tone: 'good' | 'warning' | 'critical' | 'info';
}

@Component({
  selector: 'app-stock-manager-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, RouterLink, CurrencyPipe, DatePipe],
  template: `
    <section class="dashboard-shell stock-dashboard">
      <header class="dashboard-header hero">
        <div>
          <p class="dashboard-eyebrow">Stock manager dashboard</p>
          <h1 class="dashboard-title">Inventory command center</h1>
          <p class="dashboard-subtitle">
            Live stock levels, reorder pressure, and incoming shipments tied directly to parts and inventory activity.
          </p>
          <p class="dashboard-meta">
            {{ currentUser()?.department || 'Operations' }} · {{ currentUser()?.displayName || currentUser()?.username || 'Stock manager' }}
          </p>
        </div>

        <div class="dashboard-actions">
          <button class="dashboard-button secondary" type="button" (click)="refresh()">Refresh</button>
          <a class="dashboard-button" routerLink="/inventory">Open inventory</a>
        </div>
      </header>

      <div *ngIf="error()" class="dashboard-error">{{ error() }}</div>
      <div *ngIf="loading()" class="empty-state">Loading stock telemetry...</div>

      <ng-container *ngIf="!loading()">
        <section class="kpi-grid">
          <article class="card kpi-card" *ngFor="let card of kpiCards()">
            <p class="dashboard-eyebrow">{{ card.label }}</p>
            <p class="kpi-value">{{ card.value }}</p>
            <p class="kpi-note">{{ card.note }}</p>
          </article>
        </section>

        <section class="split-grid chart-grid">
          <article class="chart-card wide-chart">
            <div class="card-header">
              <div>
                <p class="dashboard-eyebrow">Part movement</p>
                <h3>Top categories by stock value</h3>
              </div>
              <span class="tone info">{{ totalPartsTracked() }} parts tracked</span>
            </div>

            <div class="chart-canvas-wrap">
              <canvas #movementCanvas></canvas>
            </div>
          </article>

          <article class="chart-card donut-card">
            <div class="card-header">
              <div>
                <p class="dashboard-eyebrow">Category mix</p>
                <h3>Stock health distribution</h3>
              </div>
            </div>

            <div class="donut-layout">
              <div class="chart-canvas-wrap chart-canvas-wrap--donut">
                <canvas #healthCanvas></canvas>
              </div>

              <div class="mix-legend">
                <div *ngFor="let item of healthLegend()" class="mix-legend__item">
                  <span class="mix-legend__swatch" [style.background]="item.color"></span>
                  <div>
                    <strong>{{ item.label }}</strong>
                    <p>{{ item.value }} · {{ item.percent }}%</p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section class="split-grid bottom-grid">
          <article class="table-card">
            <div class="card-header">
              <div>
                <p class="dashboard-eyebrow">Reorder priorities</p>
                <h3>Parts that need attention</h3>
              </div>
              <span class="tone warning">{{ lowStockParts() + criticalParts() }} at risk</span>
            </div>

            <table class="list-table" *ngIf="priorityRows().length; else emptyPriority">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of priorityRows()">
                  <td>
                    <strong>{{ row.part }}</strong>
                    <div class="table-note">{{ row.sku }}</div>
                  </td>
                  <td>{{ row.category }}</td>
                  <td>
                    <span class="tone" [class.good]="row.tone === 'good'" [class.warning]="row.tone === 'warning'" [class.critical]="row.tone === 'critical'">
                      {{ row.stock }}
                    </span>
                  </td>
                  <td>{{ row.target }}</td>
                </tr>
              </tbody>
            </table>

            <ng-template #emptyPriority>
              <div class="empty-state">No parts are available yet.</div>
            </ng-template>
          </article>

          <article class="table-card">
            <div class="card-header">
              <div>
                <p class="dashboard-eyebrow">Incoming shipments</p>
                <h3>Purchase orders in flight</h3>
              </div>
              <span class="tone info">{{ pendingOrders() }} pending</span>
            </div>

            <div class="shipment-list" *ngIf="shipmentRows().length; else emptyShipments">
              <div class="shipment-card" *ngFor="let row of shipmentRows()">
                <div>
                  <strong>{{ row.name }}</strong>
                  <p>{{ row.eta }}</p>
                </div>

                <div class="shipment-meta">
                  <span class="tone" [class.good]="row.tone === 'good'" [class.warning]="row.tone === 'warning'" [class.critical]="row.tone === 'critical'" [class.info]="row.tone === 'info'">
                    {{ row.status }}
                  </span>
                  <strong>{{ row.quantity }} items</strong>
                </div>
              </div>
            </div>

            <ng-template #emptyShipments>
              <div class="empty-state">No shipments have been returned by the backend yet.</div>
            </ng-template>
          </article>
        </section>

        <section class="summary-grid">
          <article class="summary-card">
            <span class="dashboard-eyebrow">Inventory value</span>
            <p class="summary-value">{{ inventoryValue() | currency:'USD':'symbol':'1.0-0' }}</p>
            <p class="card-note">Live estimate from tracked part quantities and costs.</p>
          </article>

          <article class="summary-card">
            <span class="dashboard-eyebrow">Last refresh</span>
            <p class="summary-value">{{ lastRefreshAt() ? (lastRefreshAt() | date:'shortTime') : 'Pending' }}</p>
            <p class="card-note">Updated from inventory service cache.</p>
          </article>

          <article class="summary-card">
            <span class="dashboard-eyebrow">Quick links</span>
            <div class="quick-links">
              <a routerLink="/inventory/part-form" class="quick-link">Add part</a>
              <a routerLink="/stock-notifications" class="quick-link">Stock alerts</a>
              <a routerLink="/inventory/categories" class="quick-link">Categories</a>
            </div>
          </article>
        </section>
      </ng-container>
    </section>
  `,
  styles: [
    DASHBOARD_SHELL_STYLES,
    `
      :host {
        display: block;
      }

      .stock-dashboard {
        min-height: 100%;
        background: linear-gradient(180deg, rgba(5, 10, 16, 0.82), rgba(5, 10, 16, 0.96));
      }

      .hero {
        padding: 24px;
        border-radius: 28px;
        border: 1px solid rgba(148, 163, 184, 0.16);
        background: linear-gradient(135deg, rgba(13, 19, 29, 0.95), rgba(16, 24, 39, 0.88));
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 14px;
      }

      .wide-chart,
      .donut-card {
        min-height: 360px;
      }

      .chart-canvas-wrap {
        position: relative;
        height: 260px;
      }

      .chart-canvas-wrap--donut {
        height: 220px;
      }

      .chart-canvas-wrap canvas {
        width: 100% !important;
        height: 100% !important;
      }

      .donut-layout {
        display: grid;
        grid-template-columns: minmax(180px, 260px) 1fr;
        gap: 18px;
        align-items: center;
      }

      .mix-legend {
        display: grid;
        gap: 12px;
      }

      .mix-legend__item {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .mix-legend__item p {
        margin: 2px 0 0;
        color: var(--dashboard-muted, #94a3b8);
      }

      .mix-legend__swatch {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        flex: 0 0 auto;
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.04);
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }

      .summary-card {
        border-radius: 20px;
        border: 1px solid var(--dashboard-border, rgba(148, 163, 184, 0.16));
        background: rgba(15, 23, 42, 0.72);
        padding: 18px;
        backdrop-filter: blur(14px);
      }

      .summary-value {
        margin: 8px 0 0;
        font-size: 1.5rem;
        font-weight: 800;
      }

      .quick-links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
      }

      .quick-link {
        border-radius: 999px;
        padding: 0.65rem 0.9rem;
        text-decoration: none;
        color: #dbeafe;
        background: rgba(37, 99, 235, 0.18);
        border: 1px solid rgba(96, 165, 250, 0.2);
      }

      .shipment-list {
        display: grid;
        gap: 12px;
      }

      .shipment-card {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.14);
        background: rgba(255, 255, 255, 0.03);
      }

      .shipment-card p {
        margin: 4px 0 0;
        color: var(--dashboard-muted, #94a3b8);
      }

      .shipment-meta {
        display: grid;
        justify-items: end;
        gap: 8px;
      }

      @media (max-width: 900px) {
        .donut-layout {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        .shipment-card {
          flex-direction: column;
          align-items: flex-start;
        }

        .shipment-meta {
          justify-items: flex-start;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockManagerDashboardComponent extends BaseDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('movementCanvas') movementCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('healthCanvas') healthCanvas?: ElementRef<HTMLCanvasElement>;

  private movementChart?: Chart;
  private healthChart?: Chart;
  private viewReady = false;

  readonly parts = signal<Part[]>([]);
  readonly reorders = signal<ReorderRequest[]>([]);
  readonly stockOrders = signal<StockOrder[]>([]);
  readonly inventoryStats = signal<InventoryStats | null>(null);

  readonly totalPartsTracked = computed(() => this.inventoryStats()?.totalPartsTracked ?? this.parts().length);
  readonly pendingOrders = computed(() => this.inventoryStats()?.pendingOrdersCount ?? this.reorders().filter((item) => item.status === 'REQUESTED' || item.status === 'APPROVED').length);
  readonly inventoryValue = computed(() => this.inventoryStats()?.totalInventoryValue ?? this.totalInventoryValue());
  readonly currentUser = signal(this.authService.getCurrentUser());

  readonly kpiCards = computed<DashboardKpiCard[]>(() => {
    const stats = this.inventoryStats();
    return [
      { label: 'Parts tracked', value: stats?.totalPartsTracked ?? this.parts().length, note: 'Live parts catalog', tone: 'info' },
      { label: 'Healthy stock', value: this.healthyParts(), note: 'Above minimum thresholds', tone: 'good' },
      { label: 'Low / critical', value: this.lowStockParts() + this.criticalParts(), note: 'Needs reorder attention', tone: 'warning' },
      { label: 'Inventory value', value: this.formatCompactCurrency(stats?.totalInventoryValue ?? this.totalInventoryValue()), note: 'Costed stock on hand', tone: 'critical' },
    ];
  });

  readonly categoryRows = computed<CategoryRow[]>(() => {
    const groups = new Map<string, { count: number; value: number; lowCount: number }>();

    for (const part of this.parts()) {
      const key = (part.category || 'GENERAL').trim() || 'GENERAL';
      const current = groups.get(key) ?? { count: 0, value: 0, lowCount: 0 };
      current.count += 1;
      current.value += (part.currentStock || 0) * (part.cost || 0);
      if (part.currentStock <= part.minimumStock) {
        current.lowCount += 1;
      }
      groups.set(key, current);
    }

    return [...groups.entries()]
      .map(([label, data]) => ({
        label: this.prettyLabel(label),
        count: data.count,
        value: data.value,
        tone: (data.lowCount > 2 ? 'warning' : 'info') as 'warning' | 'info',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  });

  readonly priorityRows = computed<PriorityRow[]>(() =>
    this.parts()
      .slice()
      .sort((a, b) => this.priorityScore(b) - this.priorityScore(a))
      .slice(0, 6)
      .map((part) => ({
        sku: part.partNumber,
        part: part.name,
        category: this.prettyLabel(part.category || 'GENERAL'),
        stock: part.currentStock,
        target: Math.max(part.minimumStock || part.reorderQuantity || 1, 1),
        tone: part.currentStock <= 0 ? 'critical' : part.currentStock <= part.minimumStock ? 'warning' : 'good',
      }))
  );

  readonly shipmentRows = computed<ShipmentRow[]>(() =>
    this.stockOrders()
      .slice()
      .sort((a, b) => this.toDateValue(a.expectedDeliveryDate || a.orderedDate) - this.toDateValue(b.expectedDeliveryDate || b.orderedDate))
      .slice(0, 5)
      .map((order) => ({
        name: order.supplierPurchaseOrder || order.partName || 'Stock order',
        eta: this.shipmentEta(order),
        quantity: order.quantity,
        status: order.status || 'ORDERED',
        tone: order.status === 'RECEIVED' ? 'good' : order.status === 'CANCELLED' ? 'critical' : order.status === 'DELIVERED' ? 'good' : 'info',
      }))
  );

  readonly healthLegend = computed(() => {
    const total = Math.max(1, this.totalPartsTracked());
    return [
      { label: 'Healthy', value: this.healthyParts(), percent: Math.round((this.healthyParts() / total) * 100), color: '#22c55e' },
      { label: 'Low stock', value: this.lowStockParts(), percent: Math.round((this.lowStockParts() / total) * 100), color: '#f59e0b' },
      { label: 'Critical', value: this.criticalParts(), percent: Math.round((this.criticalParts() / total) * 100), color: '#ef4444' },
    ];
  });

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.scheduleChartRender();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  refresh(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.beginLoad();

    forkJoin({
      parts: this.inventoryService.getParts(0, 10000).pipe(catchError(() => of({ content: [] as Part[] }))),
      reorders: this.inventoryService.getReorders(0, 10000).pipe(catchError(() => of({ content: [] as ReorderRequest[] }))),
      stockOrders: this.inventoryService.getStockOrders(0, 10000).pipe(catchError(() => of({ content: [] as StockOrder[] }))),
    })
      .pipe(
        switchMap((data) =>
          this.inventoryService.getInventoryStats().pipe(
            catchError(() => of(null)),
            map((stats) => ({ ...data, stats }))
          )
        )
      )
      .subscribe({
        next: ({ parts, reorders, stockOrders, stats }) => {
          this.parts.set(this.asArray<Part>(parts));
          this.reorders.set(this.asArray<ReorderRequest>(reorders));
          this.stockOrders.set(this.asArray<StockOrder>(stockOrders));
          this.inventoryStats.set(stats);
          this.endLoad();
          this.scheduleChartRender();
        },
        error: () => {
          this.fail('Stock dashboard data could not be loaded.');
          this.notificationService.error('Stock dashboard data could not be loaded.');
        },
      });
  }

  private scheduleChartRender(): void {
    if (!this.viewReady || typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => this.renderCharts());
  }

  private renderCharts(): void {
    if (!this.movementCanvas?.nativeElement || !this.healthCanvas?.nativeElement) {
      return;
    }

    this.destroyCharts();

    const categoryRows = this.categoryRows();
    this.movementChart = new Chart(this.movementCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: categoryRows.map((item) => item.label),
        datasets: [
          {
            label: 'Stock value',
            data: categoryRows.map((item) => Number(item.value.toFixed(0))),
            backgroundColor: categoryRows.map((item) => item.tone === 'warning' ? '#f59e0b' : '#fbbf24'),
            borderRadius: 10,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8' },
            grid: { display: false },
          },
          y: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(148, 163, 184, 0.12)' },
          },
        },
      },
    });

    const healthLegend = this.healthLegend();
    this.healthChart = new Chart(this.healthCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: healthLegend.map((item) => item.label),
        datasets: [
          {
            data: healthLegend.map((item) => item.value),
            backgroundColor: healthLegend.map((item) => item.color),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        cutout: '68%',
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  private destroyCharts(): void {
    this.movementChart?.destroy();
    this.healthChart?.destroy();
    this.movementChart = undefined;
    this.healthChart = undefined;
  }

  private asArray<T>(response: { content?: T[] } | T[] | null | undefined): T[] {
    if (Array.isArray(response)) {
      return response;
    }

    return response?.content ?? [];
  }

  private prettyLabel(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private priorityScore(part: Part): number {
    if (part.currentStock <= 0) {
      return 3;
    }

    if (part.currentStock <= part.minimumStock) {
      return 2;
    }

    return 1;
  }

  private healthyParts(): number {
    return this.parts().filter((part) => part.currentStock > part.minimumStock).length;
  }

  lowStockParts(): number {
    return this.parts().filter((part) => part.currentStock > 0 && part.currentStock <= part.minimumStock).length;
  }

  criticalParts(): number {
    return this.parts().filter((part) => part.currentStock <= 0).length;
  }

  private totalInventoryValue(): number {
    return this.parts().reduce((sum, part) => sum + (part.currentStock || 0) * (part.cost || 0), 0);
  }

  private formatCompactCurrency(value: number): string {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value || 0);
  }

  private shipmentEta(order: StockOrder): string {
    const eta = order.expectedDeliveryDate || order.orderedDate;
    if (!eta) {
      return 'ETA pending';
    }

    const date = new Date(eta);
    return `ETA ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }

  private toDateValue(value?: string): number {
    const date = value ? new Date(value) : new Date(0);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
}