import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { HeatmapCell } from '../inventory-analytics.types';
import { EmptyStateComponent } from './empty-state.component';

const TONE_RGB: Record<HeatmapCell['turnoverLabel'], string> = {
  'High turnover': '34,197,94',
  'Low turnover': '245,158,11',
  'Dead stock': '100,116,139',
  'Critical stock': '239,68,68',
};

const TONE_ICON: Record<HeatmapCell['turnoverLabel'], string> = {
  'High turnover': 'Flame',
  'Low turnover': 'Snowflake',
  'Dead stock': 'PackageOpen',
  'Critical stock': 'OctagonAlert',
};

@Component({
  selector: 'app-category-heatmap',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, EmptyStateComponent],
  template: `
    <section class="heatmap-panel">
      <header class="heatmap-panel__header">
        <span class="heatmap-panel__icon"><lucide-icon name="LayoutGrid" [size]="18"></lucide-icon></span>
        <div>
          <h3>Warehouse Heat Map</h3>
          <p>Turnover intensity by category</p>
        </div>
      </header>

      <div class="heatmap-grid" *ngIf="cells.length; else emptyBlock">
        <div class="heatmap-cell" *ngFor="let cell of cells" [style.background]="cellBackground(cell)">
          <div class="heatmap-cell__top">
            <span class="heatmap-cell__name">{{ cell.category }}</span>
            <span class="heatmap-cell__icon" [style.color]="'rgb(' + toneRgb(cell) + ')'">
              <lucide-icon [name]="toneIcon(cell)" [size]="14"></lucide-icon>
            </span>
          </div>
          <strong>{{ cell.value | currency:'TND':'symbol':'1.0-0' }}</strong>
          <p>{{ cell.partCount }} part{{ cell.partCount === 1 ? '' : 's' }} · {{ cell.turnoverLabel }}</p>
        </div>
      </div>

      <ng-template #emptyBlock>
        <app-empty-state
          title="No category data"
          message="Add parts with categories to see warehouse turnover here."
          accentColor="#8B5CF6"
        ></app-empty-state>
      </ng-template>
    </section>
  `,
  styles: [`
    .heatmap-panel {
      background: var(--ia-surface);
      border: 1px solid var(--ia-border);
      border-radius: var(--ia-radius-lg);
      padding: 1.5rem;
      box-shadow: var(--ia-shadow-sm);
      height: 100%;
    }

    .heatmap-panel__header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .heatmap-panel__icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: rgba(139, 92, 246, 0.16);
      color: #c4b5fd;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .heatmap-panel__header h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--ia-text-primary);
    }

    .heatmap-panel__header p {
      margin: 0.2rem 0 0;
      font-size: 0.8rem;
      color: var(--ia-text-secondary);
    }

    .heatmap-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.75rem;
    }

    .heatmap-cell {
      border-radius: 14px;
      border: 1px solid var(--ia-border);
      padding: 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      transition: transform 0.15s ease;
    }

    .heatmap-cell:hover {
      transform: translateY(-2px);
    }

    .heatmap-cell__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .heatmap-cell__name {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--ia-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .heatmap-cell__icon {
      display: flex;
      align-items: center;
    }

    .heatmap-cell strong {
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--ia-text-primary);
    }

    .heatmap-cell p {
      margin: 0;
      font-size: 0.7rem;
      color: var(--ia-text-muted);
    }
  `],
})
export class CategoryHeatmapComponent {
  @Input() cells: HeatmapCell[] = [];

  toneRgb(cell: HeatmapCell): string {
    return TONE_RGB[cell.turnoverLabel];
  }

  toneIcon(cell: HeatmapCell): string {
    return TONE_ICON[cell.turnoverLabel];
  }

  cellBackground(cell: HeatmapCell): string {
    const rgb = this.toneRgb(cell);
    const alpha = 0.1 + (cell.intensity / 100) * 0.3;
    return `linear-gradient(160deg, rgba(${rgb}, ${alpha}), rgba(${rgb}, ${alpha * 0.35}))`;
  }
}
