import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { BottomStat } from '../inventory-analytics.types';
import { ProgressRingComponent } from './progress-ring.component';

@Component({
  selector: 'app-bottom-stats',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ProgressRingComponent],
  template: `
    <div class="bottom-grid">
      <article class="bottom-tile" *ngFor="let stat of stats">
        <app-progress-ring
          *ngIf="hasRing(stat); else plainIcon"
          [percent]="ringPercent(stat)"
          [size]="46"
          [strokeWidth]="4"
          [color]="accentHex(stat.accent)"
        ></app-progress-ring>
        <ng-template #plainIcon>
          <span class="bottom-tile__icon" [style.background]="accentHex(stat.accent) + '1f'" [style.color]="accentHex(stat.accent)">
            <lucide-icon [name]="stat.icon" [size]="18"></lucide-icon>
          </span>
        </ng-template>

        <div class="bottom-tile__text">
          <strong>{{ stat.value }}</strong>
          <p>{{ stat.label }}</p>
        </div>
      </article>
    </div>
  `,
  styles: [`
    .bottom-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .bottom-tile {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      background: var(--ia-surface);
      border: 1px solid var(--ia-border);
      border-radius: var(--ia-radius-md);
      padding: 1.1rem 1.2rem;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .bottom-tile:hover {
      transform: translateY(-2px);
      border-color: var(--ia-border-strong);
    }

    .bottom-tile__icon {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .bottom-tile__text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }

    .bottom-tile__text strong {
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--ia-text-primary);
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bottom-tile__text p {
      margin: 0;
      font-size: 0.74rem;
      color: var(--ia-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `],
})
export class BottomStatsComponent {
  @Input() stats: BottomStat[] = [];

  private readonly accentHexMap: Record<BottomStat['accent'], string> = {
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    ai: '#8B5CF6',
    neutral: '#94A3B8',
  };

  accentHex(accent: BottomStat['accent']): string {
    return this.accentHexMap[accent];
  }

  hasRing(stat: BottomStat): boolean {
    return stat.suffix === '%' || stat.suffix === '/100';
  }

  ringPercent(stat: BottomStat): number {
    return Math.max(0, Math.min(100, stat.rawValue));
  }
}
