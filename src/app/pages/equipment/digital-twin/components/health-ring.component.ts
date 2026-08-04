import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MachineHealthRing } from '../digital-twin.types';

@Component({
  selector: 'app-health-ring',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="health-ring-card" *ngIf="ring as r">
      <div class="ring-visual">
        <svg viewBox="0 0 120 120" class="ring-svg">
          <circle class="ring-track" cx="60" cy="60" r="52"/>
          <circle
            class="ring-fill"
            [class]="'ring-fill--' + r.tone"
            cx="60" cy="60" r="52"
            [style.stroke-dashoffset]="offsetFor(r.overall)"
          />
        </svg>
        <svg viewBox="0 0 120 120" class="needle-svg" aria-hidden="true">
          <g class="needle-group" [class]="'needle-group--' + r.tone" [attr.transform]="'rotate(' + needleRotation(r.overall) + ' 60 60)'">
            <line class="needle-shadow" x1="60" y1="64" x2="60" y2="18"/>
            <line class="needle" x1="60" y1="60" x2="60" y2="16"/>
          </g>
          <circle class="hub-outer" cx="60" cy="60" r="7"/>
          <circle class="hub" cx="60" cy="60" r="3.5"/>
        </svg>
        <div class="ring-center">
          <strong>{{ r.overall }}<span>%</span></strong>
          <span class="ring-center__label" [class]="'tone-' + r.tone">{{ r.statusLabel }}</span>
        </div>
      </div>

      <div class="ring-subscores">
        <p class="ring-subscores__title">Overall Health</p>
        <div class="sub-row" *ngFor="let s of r.subscores">
          <span class="sub-row__label">{{ s.label }}</span>
          <div class="sub-row__track">
            <div class="sub-row__fill" [class]="'sub-row__fill--' + s.tone" [style.width.%]="s.value"></div>
          </div>
          <span class="sub-row__val">{{ s.value }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .health-ring-card {
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-mid);
      border-radius: 16px;
      padding: 14px 16px;
      backdrop-filter: blur(10px);
    }

    .ring-visual {
      position: relative;
      width: 88px;
      height: 88px;
      flex-shrink: 0;
    }

    .ring-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .ring-track {
      fill: none;
      stroke: rgba(148, 163, 184, 0.14);
      stroke-width: 9;
    }

    .ring-fill {
      fill: none;
      stroke-width: 9;
      stroke-linecap: round;
      stroke-dasharray: 326.7;
      transition: stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .ring-fill--green { stroke: var(--accent-green); filter: drop-shadow(0 0 5px rgba(34,197,94,0.5)); }
    .ring-fill--blue { stroke: var(--accent-cyan); filter: drop-shadow(0 0 5px rgba(27,175,122,0.5)); }
    .ring-fill--amber { stroke: var(--accent-amber); filter: drop-shadow(0 0 5px rgba(245,158,11,0.5)); }
    .ring-fill--red { stroke: var(--accent-danger); filter: drop-shadow(0 0 5px rgba(239,68,68,0.5)); }

    .needle-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .needle-group {
      transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
      transform-origin: 60px 60px;
    }

    .needle,
    .needle-shadow {
      stroke-linecap: round;
    }

    .needle {
      stroke-width: 2.6;
      stroke: var(--text-primary);
    }

    .needle-shadow {
      stroke-width: 4;
      stroke: rgba(0, 0, 0, 0.3);
      filter: blur(0.7px);
    }

    .needle-group--green .needle { stroke: var(--accent-green); filter: drop-shadow(0 0 3px rgba(34,197,94,0.6)); }
    .needle-group--blue .needle { stroke: var(--accent-cyan); filter: drop-shadow(0 0 3px rgba(27,175,122,0.6)); }
    .needle-group--amber .needle { stroke: var(--accent-amber); filter: drop-shadow(0 0 3px rgba(245,158,11,0.6)); }
    .needle-group--red .needle { stroke: var(--accent-danger); filter: drop-shadow(0 0 3px rgba(239,68,68,0.6)); }

    .hub-outer {
      fill: var(--bg-elevated);
      stroke: rgba(148, 163, 184, 0.35);
      stroke-width: 1.2;
    }

    .hub {
      fill: var(--text-primary);
      filter: drop-shadow(0 0 2px rgba(0,0,0,0.4));
    }

    .ring-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;

      strong {
        font-family: var(--font-mono);
        font-size: 22px;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1;

        span {
          font-size: 11px;
          color: var(--text-tertiary);
          margin-left: 1px;
        }
      }
    }

    .ring-center__label {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .tone-green { color: var(--accent-green); }
    .tone-blue { color: var(--accent-cyan); }
    .tone-amber { color: var(--accent-amber); }
    .tone-red { color: var(--accent-danger); }

    .ring-subscores {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .ring-subscores__title {
      margin: 0 0 2px;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-tertiary);
    }

    .sub-row {
      display: grid;
      grid-template-columns: 60px 1fr 24px;
      align-items: center;
      gap: 7px;
    }

    .sub-row__label {
      font-size: 9.5px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sub-row__track {
      height: 4px;
      border-radius: 2px;
      background: rgba(148, 163, 184, 0.14);
      overflow: hidden;
    }

    .sub-row__fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.6s ease;
    }

    .sub-row__fill--green { background: var(--accent-green); }
    .sub-row__fill--blue { background: var(--accent-cyan); }
    .sub-row__fill--amber { background: var(--accent-amber); }
    .sub-row__fill--red { background: var(--accent-danger); }
    .sub-row__fill--purple { background: var(--accent-violet); }

    .sub-row__val {
      font-family: var(--font-mono);
      font-size: 9.5px;
      font-weight: 700;
      color: var(--text-mono);
      text-align: right;
    }

    @media (max-width: 640px) {
      .health-ring-card {
        flex-direction: column;
        align-items: stretch;
      }

      .ring-visual {
        align-self: center;
      }
    }
  `],
})
export class HealthRingComponent {
  @Input() ring: MachineHealthRing | null = null;

  private readonly circumference = 2 * Math.PI * 52;

  offsetFor(value: number): number {
    const clamped = Math.max(0, Math.min(100, value));
    return this.circumference - (clamped / 100) * this.circumference;
  }

  needleRotation(value: number): number {
    const clamped = Math.max(0, Math.min(100, value));
    return (clamped / 100) * 360;
  }
}
