import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SupplierPerformanceRow } from '../inventory-analytics.types';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  selector: 'app-supplier-performance',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, EmptyStateComponent],
  template: `
    <section class="supplier-panel">
      <header class="supplier-panel__header">
        <span class="supplier-panel__icon"><lucide-icon name="Building2" [size]="18"></lucide-icon></span>
        <div>
          <h3>Supplier Performance</h3>
          <p>Delivery reliability and quality across every active supplier</p>
        </div>
      </header>

      <div class="table-scroll" *ngIf="rows.length; else emptyBlock">
        <table class="ia-table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th class="num">Avg. Delivery</th>
              <th class="num">Delayed Orders</th>
              <th class="num">Total Purchases</th>
              <th>Quality Score</th>
              <th class="num">Late %</th>
              <th>Reliability</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows">
              <td><strong>{{ row.supplier }}</strong></td>
              <td class="num">{{ row.avgDeliveryDays.toFixed(1) }}d</td>
              <td class="num">{{ row.delayedOrders }}</td>
              <td class="num">{{ row.totalPurchases }}</td>
              <td>
                <div class="bar-cell">
                  <div class="bar-track"><div class="bar-fill bar-fill--quality" [style.width.%]="row.qualityScore"></div></div>
                  <span>{{ row.qualityScore }}</span>
                </div>
              </td>
              <td class="num" [class.text-warning]="row.latePercent > 15">{{ row.latePercent }}%</td>
              <td>
                <div class="bar-cell">
                  <div class="bar-track"><div class="bar-fill bar-fill--reliability" [style.width.%]="row.reliabilityPercent"></div></div>
                  <span>{{ row.reliabilityPercent }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ng-template #emptyBlock>
        <app-empty-state
          title="No supplier data yet"
          message="Supplier performance appears once parts are linked to suppliers."
          accentColor="#3B82F6"
        ></app-empty-state>
      </ng-template>
    </section>
  `,
  styles: [`
    .supplier-panel {
      background: var(--ia-surface);
      border: 1px solid var(--ia-border);
      border-radius: var(--ia-radius-lg);
      padding: 1.5rem;
      box-shadow: var(--ia-shadow-sm);
      height: 100%;
    }

    .supplier-panel__header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .supplier-panel__icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: rgba(59, 130, 246, 0.16);
      color: #93c5fd;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .supplier-panel__header h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--ia-text-primary);
    }

    .supplier-panel__header p {
      margin: 0.2rem 0 0;
      font-size: 0.8rem;
      color: var(--ia-text-secondary);
    }

    .table-scroll {
      max-height: 380px;
      overflow: auto;
      border-radius: 14px;
      border: 1px solid var(--ia-border);
    }

    .ia-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }

    .ia-table thead th {
      position: sticky;
      top: 0;
      background: #0e1524;
      text-align: left;
      padding: 0.7rem 0.9rem;
      font-size: 0.68rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--ia-text-muted);
      white-space: nowrap;
      border-bottom: 1px solid var(--ia-border);
    }

    .ia-table thead th.num, .ia-table td.num { text-align: right; }

    .ia-table tbody td {
      padding: 0.65rem 0.9rem;
      color: var(--ia-text-primary);
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      white-space: nowrap;
    }

    .ia-table tbody tr:last-child td { border-bottom: none; }
    .ia-table tbody tr:hover { background: rgba(255, 255, 255, 0.025); }

    .text-warning { color: var(--ia-warning); font-weight: 700; }

    .bar-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 120px;
    }

    .bar-track {
      width: 72px;
      height: 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }

    .bar-fill { height: 100%; border-radius: 999px; }
    .bar-fill--quality { background: linear-gradient(90deg, #8b5cf6, #3b82f6); }
    .bar-fill--reliability { background: linear-gradient(90deg, #22c55e, #4ade80); }

    .bar-cell span {
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--ia-text-secondary);
    }
  `],
})
export class SupplierPerformanceComponent {
  @Input() rows: SupplierPerformanceRow[] = [];
}
