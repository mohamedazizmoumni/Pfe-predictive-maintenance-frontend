import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SensorPoint, SignalStatus, TrendDirection } from '../digital-twin.types';

@Component({
  selector: 'app-sensor-overlay',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="overlay-layer">
      <svg class="connector-layer" preserveAspectRatio="none" viewBox="0 0 100 100">
        <line
          *ngFor="let s of sensors"
          [attr.x1]="s.x" [attr.y1]="s.y"
          [attr.x2]="labelPos(s).lx" [attr.y2]="labelPos(s).ly"
          [class.connector--active]="hoveredId === s.id"
          class="connector"
        />
      </svg>

      <button
        type="button"
        class="sensor-dot"
        *ngFor="let s of sensors"
        [style.left.%]="s.x"
        [style.top.%]="s.y"
        [class.sensor-dot--warning]="s.status === 'warning'"
        [class.sensor-dot--critical]="s.status === 'critical'"
        [class.sensor-dot--active]="hoveredId === s.id"
        (mouseenter)="setHovered(s.id)"
        (mouseleave)="setHovered(null)"
        (focus)="setHovered(s.id)"
        (blur)="setHovered(null)"
        (click)="setHovered(hoveredId === s.id ? null : s.id)"
        [attr.aria-label]="s.label + ': ' + s.value + s.unit"
      >
        <span class="sensor-dot__ping"></span>
      </button>

      <span
        class="sensor-label"
        *ngFor="let s of sensors"
        [style.left.%]="labelPos(s).lx"
        [style.top.%]="labelPos(s).ly"
        [class.sensor-label--warning]="s.status === 'warning'"
        [class.sensor-label--critical]="s.status === 'critical'"
      >{{ s.value }}<small>{{ s.unit }}</small><small class="sensor-label__est" *ngIf="!s.isReal" title="Estimated — no live sensor feed for this reading">est.</small></span>

      <div
        class="sensor-card"
        *ngIf="hoveredSensor as s"
        [style.left.%]="cardPos(s).lx"
        [style.top.%]="cardPos(s).ly"
        [class.sensor-card--flip]="s.x > 55"
      >
        <header class="sensor-card__head">
          <span class="sensor-card__name">{{ s.label }}</span>
          <span class="sensor-card__status sensor-card__status--estimated" *ngIf="!s.isReal" title="No live sensor feed for this reading — value is estimated">estimated</span>
          <span class="sensor-card__status sensor-card__status--{{ s.status }}">{{ s.status }}</span>
        </header>
        <div class="sensor-card__value">
          {{ s.value }}<span class="sensor-card__unit">{{ s.unit }}</span>
          <lucide-icon
            [name]="s.trend === 'up' ? 'trending-up' : s.trend === 'down' ? 'trending-down' : 'activity'"
            [size]="13"
            class="sensor-card__trend"
            [class.sensor-card__trend--up]="s.trend === 'up'"
            [class.sensor-card__trend--down]="s.trend === 'down'"
          ></lucide-icon>
        </div>
        <svg class="sensor-card__spark" viewBox="0 0 100 28" preserveAspectRatio="none">
          <polyline [attr.points]="sparkPoints(s)" />
        </svg>
        <dl class="sensor-card__meta">
          <div><dt>Normal range</dt><dd>{{ s.normalRange[0] }}–{{ s.normalRange[1] }} {{ s.unit }}</dd></div>
          <div><dt>Last update</dt><dd>{{ s.lastUpdateLabel }}</dd></div>
        </dl>
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
    }

    .overlay-layer {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .connector-layer {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .connector {
      stroke: var(--border-bright);
      stroke-width: 0.3;
      stroke-dasharray: 1.4 1.2;
      opacity: 0.6;
      vector-effect: non-scaling-stroke;
      transition: stroke 0.2s ease, opacity 0.2s ease;
    }

    .connector--active {
      stroke: var(--accent-cyan);
      opacity: 1;
    }

    .sensor-dot {
      position: absolute;
      width: 12px;
      height: 12px;
      margin: -6px 0 0 -6px;
      border-radius: 50%;
      border: none;
      padding: 0;
      background: var(--accent-green);
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18), 0 0 10px rgba(34, 197, 94, 0.7);
      cursor: pointer;
      pointer-events: auto;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .sensor-dot:hover,
    .sensor-dot--active {
      transform: scale(1.35);
    }

    .sensor-dot--warning {
      background: var(--accent-amber);
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18), 0 0 10px rgba(245, 158, 11, 0.7);
    }

    .sensor-dot--critical {
      background: var(--accent-danger);
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2), 0 0 12px rgba(239, 68, 68, 0.8);
    }

    .sensor-dot__ping {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: inherit;
      animation: sensor-ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;
    }

    @keyframes sensor-ping {
      0% { transform: scale(1); opacity: 0.7; }
      100% { transform: scale(2.4); opacity: 0; }
    }

    .sensor-label {
      position: absolute;
      transform: translate(-50%, -50%);
      background: rgba(6, 10, 20, 0.85);
      border: 1px solid var(--border-mid);
      color: var(--text-mono);
      font-family: var(--font-mono);
      font-size: 9.5px;
      font-weight: 600;
      padding: 2px 5px;
      border-radius: 5px;
      white-space: nowrap;
      pointer-events: none;
      backdrop-filter: blur(4px);

      small {
        opacity: 0.65;
        font-size: 8px;
        margin-left: 1px;
      }
    }

    .sensor-label__est {
      opacity: 0.85 !important;
      margin-left: 3px !important;
      color: var(--accent-amber);
      font-style: italic;
    }

    .sensor-label--warning {
      border-color: rgba(245, 158, 11, 0.4);
      color: #fcd34d;
    }

    .sensor-label--critical {
      border-color: rgba(239, 68, 68, 0.45);
      color: #fca5a5;
    }

    .sensor-card {
      position: absolute;
      transform: translate(-50%, -100%);
      margin-top: -14px;
      width: 176px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-bright);
      border-radius: 12px;
      padding: 10px 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      z-index: 20;
      animation: sensor-card-in 0.15s ease;
    }

    @keyframes sensor-card-in {
      from { opacity: 0; transform: translate(-50%, -94%); }
      to { opacity: 1; transform: translate(-50%, -100%); }
    }

    .sensor-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 4px;
    }

    .sensor-card__name {
      font-size: 10.5px;
      font-weight: 700;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .sensor-card__status {
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 1px 5px;
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.15);
      color: #86efac;
    }

    .sensor-card__status--warning {
      background: rgba(245, 158, 11, 0.15);
      color: #fcd34d;
    }

    .sensor-card__status--critical {
      background: rgba(239, 68, 68, 0.18);
      color: #fca5a5;
    }

    .sensor-card__status--estimated {
      background: rgba(148, 163, 184, 0.18);
      color: #cbd5e1;
    }

    .sensor-card__value {
      display: flex;
      align-items: baseline;
      gap: 4px;
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 6px;
    }

    .sensor-card__unit {
      font-size: 10px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .sensor-card__trend {
      margin-left: auto;
      color: var(--text-tertiary);
    }

    .sensor-card__trend--up { color: var(--accent-amber); }
    .sensor-card__trend--down { color: var(--accent-green); }

    .sensor-card__spark {
      width: 100%;
      height: 26px;
      margin-bottom: 6px;

      polyline {
        fill: none;
        stroke: var(--accent-cyan);
        stroke-width: 1.6;
        vector-effect: non-scaling-stroke;
      }
    }

    .sensor-card__meta {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;

      div {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      dt {
        font-size: 9px;
        color: var(--text-tertiary);
      }

      dd {
        margin: 0;
        font-size: 9px;
        color: var(--text-secondary);
        font-weight: 600;
        text-align: right;
      }
    }
  `],
})
export class SensorOverlayComponent {
  @Input() sensors: SensorPoint[] = [];

  hoveredId: string | null = null;

  setHovered(id: string | null): void {
    this.hoveredId = id;
  }

  get hoveredSensor(): SensorPoint | null {
    return this.sensors.find((s) => s.id === this.hoveredId) ?? null;
  }

  labelPos(sensor: SensorPoint): { lx: number; ly: number } {
    const lx = sensor.x < 50 ? Math.max(4, sensor.x - 13) : Math.min(96, sensor.x + 13);
    const ly = sensor.y < 50 ? Math.max(6, sensor.y - 9) : Math.min(94, sensor.y + 9);
    return { lx, ly };
  }

  cardPos(sensor: SensorPoint): { lx: number; ly: number } {
    const { lx, ly } = this.labelPos(sensor);
    return { lx, ly: Math.max(16, ly) };
  }

  sparkPoints(sensor: SensorPoint): string {
    const values = sensor.sparkline;
    if (!values.length) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const w = 100;
    const h = 28;
    const stepX = values.length > 1 ? w / (values.length - 1) : 0;
    return values.map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`).join(' ');
  }
}
