import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CriticalPartRow, RiskLevel } from '../inventory-analytics.types';
import { EmptyStateComponent } from './empty-state.component';

type SortKey = keyof Pick<CriticalPartRow,
  'partName' | 'category' | 'currentStock' | 'minimumStock' | 'maximumStock' | 'reserved' | 'supplier' | 'leadTimeDays' | 'dailyUsage' | 'risk'>;

@Component({
  selector: 'app-critical-parts-table',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, EmptyStateComponent],
  template: `
    <section class="table-panel">
      <header class="table-panel__header">
        <div class="table-panel__titles">
          <h3>Critical Parts</h3>
          <p>{{ filteredRows.length }} of {{ rows.length }} tracked parts need attention</p>
        </div>

        <div class="table-panel__tools">
          <div class="table-search">
            <lucide-icon name="Search" [size]="15"></lucide-icon>
            <input type="text" placeholder="Search part, SKU or supplier" [(ngModel)]="searchTerm" />
          </div>

          <div class="chip-group">
            <button type="button" class="chip" [class.chip-active]="riskFilter === 'all'" (click)="riskFilter = 'all'">All</button>
            <button type="button" class="chip" [class.chip-active]="riskFilter === 'critical'" (click)="riskFilter = 'critical'">Critical</button>
            <button type="button" class="chip" [class.chip-active]="riskFilter === 'high'" (click)="riskFilter = 'high'">High</button>
            <button type="button" class="chip" [class.chip-active]="riskFilter === 'medium'" (click)="riskFilter = 'medium'">Medium</button>
            <button type="button" class="chip" [class.chip-active]="riskFilter === 'low'" (click)="riskFilter = 'low'">Low</button>
          </div>
        </div>
      </header>

      <div class="table-scroll" *ngIf="filteredRows.length; else emptyBlock">
        <table class="ia-table">
          <thead>
            <tr>
              <th (click)="setSort('partName')">Part {{ sortIcon('partName') }}</th>
              <th (click)="setSort('category')">Category {{ sortIcon('category') }}</th>
              <th class="num" (click)="setSort('currentStock')">Stock {{ sortIcon('currentStock') }}</th>
              <th class="num" (click)="setSort('minimumStock')">Min {{ sortIcon('minimumStock') }}</th>
              <th class="num">Max</th>
              <th class="num" (click)="setSort('reserved')">Reserved {{ sortIcon('reserved') }}</th>
              <th (click)="setSort('supplier')">Supplier {{ sortIcon('supplier') }}</th>
              <th class="num" (click)="setSort('leadTimeDays')">Lead Time {{ sortIcon('leadTimeDays') }}</th>
              <th class="num" (click)="setSort('dailyUsage')">Daily Usage {{ sortIcon('dailyUsage') }}</th>
              <th>Predicted Stockout</th>
              <th (click)="setSort('risk')">Risk {{ sortIcon('risk') }}</th>
              <th>Recommended Action</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of filteredRows">
              <td>
                <strong>{{ row.partName }}</strong>
                <div class="muted">{{ row.partNumber }}</div>
              </td>
              <td>{{ row.category }}</td>
              <td class="num">{{ row.currentStock }}</td>
              <td class="num">{{ row.minimumStock }}</td>
              <td class="num">{{ row.maximumStock }}</td>
              <td class="num">{{ row.reserved }}</td>
              <td>{{ row.supplier }}</td>
              <td class="num">{{ row.leadTimeDays }}d</td>
              <td class="num">{{ row.dailyUsage }}/day</td>
              <td>{{ row.predictedStockoutDate ? (row.predictedStockoutDate | date:'MMM d') : '—' }}</td>
              <td><span class="risk-badge" [class]="'risk-badge--' + row.risk">{{ row.risk }}</span></td>
              <td class="muted">{{ row.recommendedAction }}</td>
              <td><span class="status-pill" [class]="'status-pill--' + statusTone(row.status)">{{ row.status | titlecase }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <ng-template #emptyBlock>
        <app-empty-state
          title="No parts match this view"
          message="Try clearing the search or filters — or your inventory is in great shape."
          accentColor="#3B82F6"
        ></app-empty-state>
      </ng-template>
    </section>
  `,
  styles: [`
    .table-panel {
      background: var(--ia-surface);
      border: 1px solid var(--ia-border);
      border-radius: var(--ia-radius-lg);
      padding: 1.5rem;
      box-shadow: var(--ia-shadow-sm);
    }

    .table-panel__header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .table-panel__titles h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--ia-text-primary);
    }

    .table-panel__titles p {
      margin: 0.2rem 0 0;
      font-size: 0.8rem;
      color: var(--ia-text-secondary);
    }

    .table-panel__tools {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .table-search {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--ia-border);
      border-radius: 999px;
      padding: 0.5rem 0.9rem;
      color: var(--ia-text-muted);
      min-width: 220px;
    }

    .table-search input {
      border: none;
      background: transparent;
      outline: none;
      color: var(--ia-text-primary);
      font-size: 0.82rem;
      width: 100%;
    }

    .table-search input::placeholder { color: var(--ia-text-muted); }

    .chip-group {
      display: flex;
      gap: 0.3rem;
      background: rgba(255, 255, 255, 0.03);
      padding: 0.2rem;
      border-radius: 999px;
      border: 1px solid var(--ia-border);
    }

    .chip {
      border: none;
      background: transparent;
      color: var(--ia-text-secondary);
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.32rem 0.75rem;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.15s ease;
      text-transform: capitalize;
    }

    .chip:hover { color: var(--ia-text-primary); }

    .chip-active {
      background: var(--ia-info);
      color: #fff;
    }

    .table-scroll {
      max-height: 460px;
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
      z-index: 1;
      background: #0e1524;
      text-align: left;
      padding: 0.75rem 0.9rem;
      font-size: 0.68rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--ia-text-muted);
      white-space: nowrap;
      cursor: pointer;
      border-bottom: 1px solid var(--ia-border);
      user-select: none;
    }

    .ia-table thead th:hover { color: var(--ia-text-primary); }

    .ia-table tbody td {
      padding: 0.7rem 0.9rem;
      color: var(--ia-text-primary);
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      white-space: nowrap;
    }

    .ia-table tbody tr:last-child td { border-bottom: none; }
    .ia-table tbody tr:hover { background: rgba(255, 255, 255, 0.025); }

    .ia-table .num { text-align: right; font-variant-numeric: tabular-nums; }
    .ia-table thead th.num { text-align: right; }

    .muted { color: var(--ia-text-muted); font-size: 0.74rem; }

    .risk-badge {
      display: inline-flex;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .risk-badge--critical { background: rgba(127, 29, 29, 0.35); color: #fca5a5; }
    .risk-badge--high     { background: rgba(239, 68, 68, 0.16); color: #fca5a5; }
    .risk-badge--medium   { background: rgba(245, 158, 11, 0.16); color: #fcd34d; }
    .risk-badge--low      { background: rgba(34, 197, 94, 0.16); color: #86efac; }

    .status-pill {
      display: inline-flex;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .status-pill--success { background: rgba(34, 197, 94, 0.14); color: #86efac; }
    .status-pill--warning { background: rgba(245, 158, 11, 0.14); color: #fcd34d; }
    .status-pill--danger  { background: rgba(239, 68, 68, 0.14); color: #fca5a5; }
  `],
})
export class CriticalPartsTableComponent {
  @Input() rows: CriticalPartRow[] = [];

  searchTerm = '';
  riskFilter: 'all' | RiskLevel = 'all';
  sortKey: SortKey = 'currentStock';
  sortDirection: 'asc' | 'desc' = 'asc';

  private readonly riskWeight: Record<RiskLevel, number> = { critical: 4, high: 3, medium: 2, low: 1 };

  get filteredRows(): CriticalPartRow[] {
    let result = this.rows;

    if (this.riskFilter !== 'all') {
      result = result.filter((r) => r.risk === this.riskFilter);
    }

    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter((r) =>
        r.partName.toLowerCase().includes(term) ||
        r.partNumber.toLowerCase().includes(term) ||
        r.supplier.toLowerCase().includes(term)
      );
    }

    return [...result].sort((a, b) => this.compare(a, b));
  }

  setSort(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
  }

  sortIcon(key: SortKey): string {
    if (this.sortKey !== key) return '';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  statusTone(status: string): 'success' | 'warning' | 'danger' {
    const upper = (status || '').toUpperCase();
    if (upper === 'OUT_OF_STOCK') return 'danger';
    if (upper === 'LOW_STOCK') return 'warning';
    return 'success';
  }

  private compare(a: CriticalPartRow, b: CriticalPartRow): number {
    let result: number;
    if (this.sortKey === 'risk') {
      result = this.riskWeight[a.risk] - this.riskWeight[b.risk];
    } else {
      const va = a[this.sortKey];
      const vb = b[this.sortKey];
      result = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
    }
    return this.sortDirection === 'asc' ? result : -result;
  }
}
