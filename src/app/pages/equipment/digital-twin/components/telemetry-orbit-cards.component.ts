import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TelemetryOrbitCard } from '../digital-twin.types';

@Component({
  selector: 'app-telemetry-orbit-cards',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div
      class="orbit-card"
      *ngFor="let c of cards"
      [style.left.%]="c.anchorX"
      [style.top.%]="c.anchorY"
      [class]="'orbit-card--' + c.tone"
    >
      <span class="orbit-card__icon"><lucide-icon [name]="iconName(c.icon)" [size]="13"></lucide-icon></span>
      <span class="orbit-card__body">
        <span class="orbit-card__value">{{ c.value }}<small>{{ c.unit }}</small></span>
        <span class="orbit-card__label">{{ c.label }}</span>
      </span>
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 4;
    }

    .orbit-card {
      position: absolute;
      transform: translate(-50%, -50%);
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 7px 10px;
      border-radius: 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-mid);
      backdrop-filter: blur(8px);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
      animation: orbit-float 5s ease-in-out infinite;
      pointer-events: auto;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .orbit-card:hover {
      transform: translate(-50%, -50%) scale(1.06);
      border-color: var(--border-bright);
    }

    @keyframes orbit-float {
      0%, 100% { margin-top: 0; }
      50% { margin-top: -4px; }
    }

    .orbit-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 8px;
      flex-shrink: 0;
      background: rgba(148, 163, 184, 0.12);
    }

    .orbit-card--green .orbit-card__icon { color: var(--accent-green); background: rgba(34,197,94,0.14); }
    .orbit-card--blue .orbit-card__icon { color: var(--accent-cyan); background: rgba(27,175,122,0.14); }
    .orbit-card--amber .orbit-card__icon { color: var(--accent-amber); background: rgba(245,158,11,0.14); }
    .orbit-card--purple .orbit-card__icon { color: var(--accent-violet); background: rgba(126,34,206,0.14); }
    .orbit-card--red .orbit-card__icon { color: var(--accent-danger); background: rgba(239,68,68,0.14); }

    .orbit-card__body {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }

    .orbit-card__value {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);

      small {
        font-size: 9px;
        font-weight: 500;
        color: var(--text-tertiary);
        margin-left: 2px;
      }
    }

    .orbit-card__label {
      font-size: 8.5px;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    @media (max-width: 900px) {
      .orbit-card { display: none; }
    }
  `],
})
export class TelemetryOrbitCardsComponent {
  @Input() cards: TelemetryOrbitCard[] = [];

  iconName(icon: string): string {
    return icon
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase();
  }
}
