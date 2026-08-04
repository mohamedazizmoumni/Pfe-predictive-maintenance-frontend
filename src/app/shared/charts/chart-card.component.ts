import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Chart } from 'chart.js/auto';
import type { ChartConfiguration } from 'chart.js';

export interface ChartToggleOption {
  label: string;
  value: string;
}

export interface ChartLegendItem {
  label: string;
  value: string;
  color: string;
}

/**
 * Generic Chart.js wrapper used by any premium dashboard/analytics page.
 * Styled entirely from the app's real --color-, --space-, --radius- tokens
 * (see styles.scss) so it follows the light/dark toggle automatically.
 */
@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <article class="chart-card" role="group" [attr.aria-label]="title">
      <header class="chart-card__header">
        <div class="chart-card__title-block">
          <span class="chart-card__icon" *ngIf="icon" aria-hidden="true" [style.background]="accentColor + '1f'" [style.color]="accentColor">
            <lucide-icon [name]="icon" [size]="18"></lucide-icon>
          </span>
          <div class="chart-card__titles">
            <h3>{{ title }}</h3>
            <p *ngIf="subtitle">{{ subtitle }}</p>
          </div>
        </div>

        <div class="chart-card__actions">
          <span class="chart-card__badge" *ngIf="badge">{{ badge }}</span>
          <div class="chip-group" *ngIf="toggleOptions?.length" role="group" aria-label="Chart view options">
            <button
              type="button"
              *ngFor="let opt of toggleOptions"
              class="chip"
              [class.chip-active]="opt.value === activeToggle"
              [attr.aria-pressed]="opt.value === activeToggle"
              (click)="toggleChange.emit(opt.value)"
            >{{ opt.label }}</button>
          </div>
        </div>
      </header>

      <div class="chart-card__body" [class.chart-card__body--with-legend]="!!legend?.length">
        <div class="chart-card__canvas-wrap" [style.height.px]="height">
          <canvas #canvas role="img" [attr.aria-label]="(title + (subtitle ? ': ' + subtitle : '')) + '. Chart data is summarized in the legend below.'"></canvas>
        </div>

        <div class="chart-card__legend" *ngIf="legend?.length">
          <div class="chart-card__legend-item" *ngFor="let item of legend">
            <span class="chart-card__legend-dot" aria-hidden="true" [style.background]="item.color"></span>
            <div class="chart-card__legend-text">
              <strong>{{ item.label }}</strong>
              <span>{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  `,
  styles: [`
    .chart-card {
      background: var(--color-bg-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      box-shadow: var(--shadow-sm);
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      transition: border-color var(--ease-base);
    }

    .chart-card:hover {
      border-color: var(--color-border-strong);
    }

    .chart-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .chart-card__title-block {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      min-width: 0;
    }

    .chart-card__icon {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .chart-card__titles h3 {
      margin: 0;
      font-size: var(--text-md);
      font-weight: var(--weight-bold);
      color: var(--color-text-primary);
      letter-spacing: -0.01em;
    }

    .chart-card__titles p {
      margin: 0.2rem 0 0;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .chart-card__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .chart-card__badge {
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      color: var(--color-text-secondary);
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      padding: 0.3rem 0.65rem;
      border-radius: var(--radius-full);
      white-space: nowrap;
    }

    .chip-group {
      display: flex;
      gap: 0.3rem;
      background: var(--color-bg-elevated);
      padding: 0.2rem;
      border-radius: var(--radius-full);
      border: 1px solid var(--color-border);
    }

    .chip {
      border: none;
      background: transparent;
      color: var(--color-text-secondary);
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      padding: 0.32rem 0.75rem;
      border-radius: var(--radius-full);
      cursor: pointer;
      transition: all var(--ease-fast);
    }

    .chip:hover {
      color: var(--color-text-primary);
    }

    .chip-active {
      background: var(--color-accent);
      color: var(--color-text-on-accent);
      box-shadow: var(--shadow-accent);
    }

    .chart-card__body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .chart-card__body--with-legend {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(140px, 0.7fr);
      gap: var(--space-5);
      align-items: center;
    }

    .chart-card__canvas-wrap {
      position: relative;
      width: 100%;
    }

    .chart-card__canvas-wrap canvas {
      width: 100% !important;
      height: 100% !important;
    }

    .chart-card__legend {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .chart-card__legend-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .chart-card__legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 0 3px var(--color-bg-elevated);
    }

    .chart-card__legend-text {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }

    .chart-card__legend-text strong {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      font-weight: var(--weight-bold);
    }

    .chart-card__legend-text span {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    @media (max-width: 640px) {
      .chart-card__body--with-legend {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class ChartCardComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() title = '';
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() accentColor = '#6b7280';
  @Input() badge?: string;
  @Input() height = 280;
  @Input() config?: ChartConfiguration<any>;
  @Input() toggleOptions?: ChartToggleOption[];
  @Input() activeToggle?: string;
  @Input() legend?: ChartLegendItem[];
  @Output() toggleChange = new EventEmitter<string>();

  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart<any>;
  private viewReady = false;
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    // Chart.js needs a real <canvas> 2D context, which Angular's server-side
    // DOM shim doesn't implement — skip entirely during SSR/prerendering.
    if (!this.isBrowser || !this.viewReady || !this.canvasRef?.nativeElement || !this.config) {
      return;
    }
    this.chart?.destroy();
    this.chart = new Chart(this.canvasRef.nativeElement, this.config);
  }
}
