import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TwinComponentDetail } from '../digital-twin.types';

@Component({
  selector: 'app-component-detail-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <aside class="detail-panel" *ngIf="detail as d" [class.detail-panel--open]="!!detail">
      <header class="detail-panel__head" [class]="'tone-' + d.tone">
        <span class="detail-panel__icon"><lucide-icon [name]="iconName(d.icon)" [size]="18"></lucide-icon></span>
        <div class="detail-panel__title">
          <strong>{{ d.label }}</strong>
          <span class="detail-panel__status">{{ statusLabel(d.status) }}</span>
        </div>
        <button type="button" class="detail-panel__close" (click)="close.emit()" aria-label="Close">
          <lucide-icon name="x" [size]="15"></lucide-icon>
        </button>
      </header>

      <p class="detail-panel__disclaimer">
        Per-component health, RUL, anomaly score and history below are estimated — there is no dedicated sensor feed per component yet.
      </p>

      <div class="detail-panel__metrics">
        <div class="metric-cell">
          <span>Current Temp</span>
          <strong>{{ d.currentTemp | number: '1.1-1' }}°C</strong>
        </div>
        <div class="metric-cell">
          <span>RPM</span>
          <strong>{{ d.rpm }}</strong>
        </div>
        <div class="metric-cell">
          <span>Power</span>
          <strong>{{ d.power }} kW</strong>
        </div>
        <div class="metric-cell">
          <span>Health</span>
          <strong [class]="'tone-' + d.tone">{{ d.health }}/100</strong>
        </div>
      </div>

      <div class="detail-panel__row">
        <span class="detail-panel__row-label">Predicted RUL</span>
        <strong>{{ d.predictedRulHours }} h</strong>
      </div>
      <div class="detail-panel__row">
        <span class="detail-panel__row-label">Anomaly Score</span>
        <strong>{{ d.anomalyScore }}/100</strong>
      </div>

      <section class="detail-panel__section">
        <p class="detail-panel__section-title">AI Recommendation</p>
        <p class="detail-panel__recommendation">{{ d.aiRecommendation }}</p>
      </section>

      <section class="detail-panel__section">
        <p class="detail-panel__section-title">Maintenance History <small class="detail-panel__section-est">simulated</small></p>
        <ul class="history-list">
          <li *ngFor="let h of d.maintenanceHistory">
            <span class="history-list__date">{{ h.date }}</span>
            <span class="history-list__desc">{{ h.description }}</span>
          </li>
        </ul>
      </section>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
    }

    .detail-panel {
      width: 100%;
      background: var(--bg-elevated);
      border: 1px solid var(--border-bright);
      border-radius: 16px;
      padding: 16px;
      backdrop-filter: blur(12px);
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
      animation: detail-panel-in 0.25s ease;
    }

    @keyframes detail-panel-in {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .detail-panel__head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .detail-panel__icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(148, 163, 184, 0.12);
      flex-shrink: 0;
    }

    .tone-green .detail-panel__icon, .detail-panel__status.tone-green { color: var(--accent-green); }
    .tone-amber .detail-panel__icon { color: var(--accent-amber); }
    .tone-red .detail-panel__icon { color: var(--accent-danger); }
    .tone-blue .detail-panel__icon { color: var(--accent-cyan); }
    .tone-purple .detail-panel__icon { color: var(--accent-violet); }

    .detail-panel__title {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;

      strong {
        font-size: 13.5px;
        color: var(--text-primary);
      }
    }

    .detail-panel__status {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-tertiary);
      font-weight: 700;
    }

    .detail-panel__close {
      background: rgba(148, 163, 184, 0.1);
      border: none;
      border-radius: 8px;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      cursor: pointer;
      flex-shrink: 0;

      &:hover {
        background: rgba(148, 163, 184, 0.18);
        color: var(--text-primary);
      }
    }

    .detail-panel__metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }

    .metric-cell {
      background: rgba(148, 163, 184, 0.06);
      border: 1px solid var(--border-dim);
      border-radius: 10px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;

      span {
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--text-tertiary);
      }

      strong {
        font-family: var(--font-mono);
        font-size: 15px;
        color: var(--text-primary);
      }
    }

    .detail-panel__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 2px;
      border-bottom: 1px solid var(--border-dim);
      font-size: 12px;

      strong {
        font-family: var(--font-mono);
        color: var(--text-primary);
      }
    }

    .detail-panel__row-label {
      color: var(--text-secondary);
    }

    .detail-panel__section {
      margin-top: 12px;
    }

    .detail-panel__section-title {
      margin: 0 0 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-tertiary);
    }

    .detail-panel__section-est {
      font-size: 8.5px;
      font-weight: 600;
      font-style: italic;
      text-transform: none;
      letter-spacing: normal;
      color: var(--accent-amber);
      margin-left: 5px;
    }

    .detail-panel__disclaimer {
      margin: 0 0 12px;
      font-size: 10px;
      line-height: 1.4;
      color: var(--text-tertiary);
      background: rgba(148, 163, 184, 0.08);
      border: 1px solid var(--border-dim);
      border-radius: 8px;
      padding: 7px 9px;
    }

    .detail-panel__recommendation {
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      color: var(--text-secondary);
      background: rgba(126, 34, 206, 0.08);
      border: 1px solid rgba(126, 34, 206, 0.2);
      border-radius: 10px;
      padding: 9px 11px;
    }

    .history-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .history-list li {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 11px;
      padding: 6px 0;
      border-bottom: 1px dashed var(--border-dim);

      &:last-child {
        border-bottom: none;
      }
    }

    .history-list__date {
      color: var(--text-tertiary);
      white-space: nowrap;
      font-family: var(--font-mono);
      font-size: 10px;
    }

    .history-list__desc {
      color: var(--text-secondary);
      text-align: right;
    }
  `],
})
export class ComponentDetailPanelComponent {
  @Input() detail: TwinComponentDetail | null = null;
  @Output() close = new EventEmitter<void>();

  iconName(icon: string): string {
    return icon.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  statusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
