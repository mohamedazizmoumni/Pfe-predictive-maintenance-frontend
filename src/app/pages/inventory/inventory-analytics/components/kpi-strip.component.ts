import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { KpiMetric } from '../inventory-analytics.types';
import { CountUpDirective } from '../../../../shared/charts/count-up.directive';

@Component({
  selector: 'app-kpi-strip',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, CountUpDirective],
  template: `
    <div class="kpi-grid">
      <article class="kpi-card" *ngFor="let kpi of metrics" [class]="'kpi-card--' + kpi.accent">
        <div class="kpi-card__top">
          <span class="kpi-card__icon">
            <lucide-icon [name]="kpi.icon" [size]="20"></lucide-icon>
          </span>
          <span class="kpi-card__badge" *ngIf="kpi.badge">{{ kpi.badge }}</span>
        </div>

        <p class="kpi-card__label">{{ kpi.label }}</p>

        <p class="kpi-card__value">
          <span [appCountUp]="kpi.rawValue" [countUpFormat]="formatterFor(kpi)">{{ kpi.value }}</span>
        </p>

        <div class="kpi-card__footer">
          <span class="kpi-card__change" *ngIf="kpi.changeLabel" [class]="'kpi-card__change--' + (kpi.changeDirection || 'flat')">
            <lucide-icon
              [name]="kpi.changeDirection === 'up' ? 'TrendingUp' : kpi.changeDirection === 'down' ? 'TrendingDown' : 'Minus'"
              [size]="13"
            ></lucide-icon>
            {{ kpi.changeLabel }}
          </span>
          <span class="kpi-card__caption" *ngIf="!kpi.changeLabel">{{ kpi.caption }}</span>
        </div>

        <svg
          *ngIf="kpi.sparkline?.length"
          class="kpi-card__sparkline"
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
      gap: 1rem;
    }

    .kpi-card {
      position: relative;
      overflow: hidden;
      background: var(--ia-surface);
      border: 1px solid var(--ia-border);
      border-radius: var(--ia-radius-lg);
      padding: 1.25rem 1.35rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      min-height: 152px;
    }

    .kpi-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--ia-shadow-md);
      border-color: var(--ia-border-strong);
    }

    .kpi-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      height: 3px;
      background: var(--accent, var(--ia-info));
      opacity: 0.9;
    }

    .kpi-card--success { --accent: var(--ia-success); }
    .kpi-card--warning { --accent: var(--ia-warning); }
    .kpi-card--danger  { --accent: var(--ia-danger); }
    .kpi-card--info    { --accent: var(--ia-info); }
    .kpi-card--ai      { --accent: var(--ia-ai); }
    .kpi-card--neutral { --accent: var(--ia-text-muted); }

    .kpi-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .kpi-card__icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--accent, var(--ia-info)) 16%, transparent);
      color: var(--accent, var(--ia-info));
      flex-shrink: 0;
    }

    .kpi-card__badge {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--accent, var(--ia-info));
      background: color-mix(in srgb, var(--accent, var(--ia-info)) 14%, transparent);
      padding: 0.28rem 0.6rem;
      border-radius: 999px;
      white-space: nowrap;
    }

    .kpi-card__label {
      margin: 0;
      font-size: 0.76rem;
      font-weight: 600;
      color: var(--ia-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .kpi-card__value {
      margin: 0;
      font-size: 1.65rem;
      font-weight: 800;
      color: var(--ia-text-primary);
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
      font-size: 0.76rem;
      font-weight: 700;
    }

    .kpi-card__change--up { color: var(--ia-success); }
    .kpi-card__change--down { color: var(--ia-danger); }
    .kpi-card__change--flat { color: var(--ia-text-muted); }

    .kpi-card__caption {
      font-size: 0.76rem;
      color: var(--ia-text-muted);
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
export class KpiStripComponent {
  @Input() metrics: KpiMetric[] = [];

  private readonly accentHexMap: Record<KpiMetric['accent'], string> = {
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    ai: '#8B5CF6',
    neutral: '#94A3B8',
  };

  accentHex(accent: KpiMetric['accent']): string {
    return this.accentHexMap[accent];
  }

  formatterFor(kpi: KpiMetric): (value: number) => string {
    switch (kpi.id) {
      case 'inventory-value':
        return (v: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(v);
      case 'stock-coverage':
        return (v: number) => `${Math.round(v)}d`;
      case 'turnover':
        return (v: number) => v.toFixed(1);
      default:
        return (v: number) => Math.round(v).toLocaleString();
    }
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
