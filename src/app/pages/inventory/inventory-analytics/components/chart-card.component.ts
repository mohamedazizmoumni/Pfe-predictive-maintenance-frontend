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

@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <article class="chart-card">
      <header class="chart-card__header">
        <div class="chart-card__title-block">
          <span class="chart-card__icon" *ngIf="icon" [style.background]="accentColor + '1f'" [style.color]="accentColor">
            <lucide-icon [name]="icon" [size]="18"></lucide-icon>
          </span>
          <div class="chart-card__titles">
            <h3>{{ title }}</h3>
            <p *ngIf="subtitle">{{ subtitle }}</p>
          </div>
        </div>

        <div class="chart-card__actions">
          <span class="chart-card__badge" *ngIf="badge">{{ badge }}</span>
          <div class="chip-group" *ngIf="toggleOptions?.length">
            <button
              type="button"
              *ngFor="let opt of toggleOptions"
              class="chip"
              [class.chip-active]="opt.value === activeToggle"
              (click)="toggleChange.emit(opt.value)"
            >{{ opt.label }}</button>
          </div>
        </div>
      </header>

      <div class="chart-card__body" [class.chart-card__body--with-legend]="!!legend?.length">
        <div class="chart-card__canvas-wrap" [style.height.px]="height">
          <canvas #canvas></canvas>
        </div>

        <div class="chart-card__legend" *ngIf="legend?.length">
          <div class="chart-card__legend-item" *ngFor="let item of legend">
            <span class="chart-card__legend-dot" [style.background]="item.color"></span>
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
      background: var(--ia-surface);
      border: 1px solid var(--ia-border);
      border-radius: var(--ia-radius-lg);
      padding: 1.5rem;
      box-shadow: var(--ia-shadow-sm);
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }

    .chart-card:hover {
      border-color: var(--ia-border-strong);
    }

    .chart-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .chart-card__title-block {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      min-width: 0;
    }

    .chart-card__icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .chart-card__titles h3 {
      margin: 0;
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--ia-text-primary);
      letter-spacing: -0.01em;
    }

    .chart-card__titles p {
      margin: 0.2rem 0 0;
      font-size: 0.8rem;
      color: var(--ia-text-secondary);
    }

    .chart-card__actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .chart-card__badge {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--ia-text-secondary);
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--ia-border);
      padding: 0.3rem 0.65rem;
      border-radius: 999px;
      white-space: nowrap;
    }

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
    }

    .chip:hover {
      color: var(--ia-text-primary);
    }

    .chip-active {
      background: var(--ia-info);
      color: #fff;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
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
      gap: 1.25rem;
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
      gap: 0.65rem;
    }

    .chart-card__legend-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .chart-card__legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.04);
    }

    .chart-card__legend-text {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }

    .chart-card__legend-text strong {
      font-size: 0.78rem;
      color: var(--ia-text-primary);
      font-weight: 700;
    }

    .chart-card__legend-text span {
      font-size: 0.72rem;
      color: var(--ia-text-muted);
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
  @Input() accentColor = '#3B82F6';
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
