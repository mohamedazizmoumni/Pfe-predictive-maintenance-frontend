import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CountUpDirective } from './count-up.directive';

export type KpiAccent = 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'neutral';

export interface DashboardKpiMetric {
  id: string;
  label: string;
  value: string;
  rawValue: number;
  icon: string;
  accent: KpiAccent;
  changeLabel?: string;
  changeDirection?: 'up' | 'down' | 'flat';
  badge?: string;
  sparkline?: number[];
  caption?: string;
  /** Formats rawValue for the count-up animation; defaults to a rounded integer. */
  format?: (value: number) => string;
}

/**
 * Generic KPI card strip with count-up animation + sparkline, styled from
 * the app's real theme tokens. Shared across any dashboard/analytics page.
 */
@Component({
  selector: 'app-dashboard-kpi-strip',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, CountUpDirective],
  template: `
    <div class="kpi-grid">
      <article
        class="kpi-card"
        *ngFor="let kpi of metrics"
        [class]="'kpi-card--' + kpi.accent"
        role="group"
        [attr.aria-label]="kpi.label + ': ' + kpi.value + (kpi.changeLabel ? ', ' + kpi.changeLabel : '')"
      >
        <div class="kpi-card__top">
          <span class="kpi-card__icon" aria-hidden="true">
            <lucide-icon [name]="kpi.icon" [size]="20"></lucide-icon>
          </span>
          <span class="kpi-card__badge" *ngIf="kpi.badge">{{ kpi.badge }}</span>
        </div>

        <p class="kpi-card__label">{{ kpi.label }}</p>

        <p class="kpi-card__value">
          <span [appCountUp]="kpi.rawValue" [countUpFormat]="kpi.format || defaultFormat">{{ kpi.value }}</span>
        </p>

        <div class="kpi-card__footer">
          <span class="kpi-card__change" *ngIf="kpi.changeLabel" [class]="'kpi-card__change--' + (kpi.changeDirection || 'flat')">
            <lucide-icon
              aria-hidden="true"
              [name]="kpi.changeDirection === 'up' ? 'trending-up' : kpi.changeDirection === 'down' ? 'trending-down' : 'minus'"
              [size]="13"
            ></lucide-icon>
            {{ kpi.changeLabel }}
          </span>
          <span class="kpi-card__caption" *ngIf="!kpi.changeLabel">{{ kpi.caption }}</span>
        </div>

        <svg
          *ngIf="kpi.sparkline?.length"
          class="kpi-card__sparkline"
          aria-hidden="true"
          [attr.viewBox]="'0 0 100 28'"
          preserveAspectRatio="none"
        >
          <polyline
            [attr.points]="sparklinePoints(kpi.sparkline!)"
            fill="none"
            [attr.stroke]="accentHex(kpi.accent)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></polyline>
          <polygon
            [attr.points]="sparklineFill(kpi.sparkline!)"
            [attr.fill]="accentHex(kpi.accent)"
            opacity="0.08"
          ></polygon>
        </svg>
      </article>
    </div>
  `,
  styles: [`
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: var(--space-4);
    }

    .kpi-card {
      position: relative;
      overflow: hidden;
      background: var(--color-bg-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1.25rem 1.35rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      transition: transform var(--ease-base), border-color var(--ease-base), box-shadow var(--ease-base);
      min-height: 152px;
    }

    .kpi-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
      border-color: var(--color-border-strong);
    }

    .kpi-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      height: 3px;
      background: var(--accent, var(--color-info));
      opacity: 0.9;
    }

    .kpi-card--success { --accent: var(--color-success); }
    .kpi-card--warning { --accent: var(--color-warning); }
    .kpi-card--danger  { --accent: var(--color-danger); }
    .kpi-card--info    { --accent: var(--color-info); }
    .kpi-card--ai      { --accent: #8B5CF6; }
    .kpi-card--neutral { --accent: var(--color-text-muted); }

    .kpi-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .kpi-card__icon {
      width: 38px;
      height: 38px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--accent, var(--color-info)) 16%, transparent);
      color: var(--accent, var(--color-info));
      flex-shrink: 0;
    }

    .kpi-card__badge {
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      color: var(--accent, var(--color-info));
      background: color-mix(in srgb, var(--accent, var(--color-info)) 14%, transparent);
      padding: 0.28rem 0.6rem;
      border-radius: var(--radius-full);
      white-space: nowrap;
    }

    .kpi-card__label {
      margin: 0;
      font-size: var(--text-xs);
      font-weight: var(--weight-semi);
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .kpi-card__value {
      margin: 0;
      font-size: 1.65rem;
      font-weight: var(--weight-black);
      color: var(--color-text-primary);
      letter-spacing: -0.02em;
      line-height: 1.1;
    }

    .kpi-card__footer {
      min-height: 18px;
      display: flex;
      align-items: center;
    }

    .kpi-card__change {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
    }

    .kpi-card__change--up { color: var(--color-success); }
    .kpi-card__change--down { color: var(--color-danger); }
    .kpi-card__change--flat { color: var(--color-text-muted); }

    .kpi-card__caption {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .kpi-card__sparkline {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 40%;
      height: 30px;
      opacity: 0.9;
      pointer-events: none;
    }
  `],
})
export class DashboardKpiStripComponent {
  @Input() metrics: DashboardKpiMetric[] = [];

  private readonly accentHexMap: Record<KpiAccent, string> = {
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#6b7280',
    ai: '#8B5CF6',
    neutral: '#94A3B8',
  };

  defaultFormat = (v: number): string => Math.round(v).toLocaleString();

  accentHex(accent: KpiAccent): string {
    return this.accentHexMap[accent];
  }

  sparklinePoints(values: number[]): string {
    if (!values.length) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = 100 / (values.length - 1 || 1);
    return values.map((v, i) => `${i * stepX},${28 - ((v - min) / range) * 26 - 1}`).join(' ');
  }

  sparklineFill(values: number[]): string {
    const line = this.sparklinePoints(values);
    return `0,28 ${line} 100,28`;
  }
}
