import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AiPrediction } from '../digital-twin.types';

@Component({
  selector: 'app-ai-predictions-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="ai-panel" *ngIf="prediction as p">
      <header class="ai-panel__head">
        <span class="ai-panel__icon"><lucide-icon name="brain" [size]="17"></lucide-icon></span>
        <div>
          <p class="ai-panel__eyebrow">
            AI Machine Intelligence
            <span class="ai-panel__signal" [class.ai-panel__signal--live]="p.usingRealSignal">
              {{ p.usingRealSignal ? 'live signal' : 'estimated' }}
            </span>
          </p>
          <p class="ai-panel__narrative">{{ p.narrative }}</p>
        </div>
      </header>

      <div class="ai-panel__grid">
        <div class="ai-stat">
          <span class="ai-stat__label">Bearing Wear Probability</span>
          <strong class="ai-stat__value">{{ p.bearingWearProbability }}<small>%</small></strong>
        </div>
        <div class="ai-stat">
          <span class="ai-stat__label">Remaining Useful Life</span>
          <strong class="ai-stat__value">{{ p.remainingUsefulLifeHours }}<small>h</small></strong>
        </div>
        <div class="ai-stat">
          <span class="ai-stat__label">Recommended Maintenance</span>
          <strong class="ai-stat__value">Within {{ p.recommendedWithinDays }}<small>{{ p.recommendedWithinDays === 1 ? 'day' : 'days' }}</small></strong>
        </div>
        <div class="ai-stat">
          <span class="ai-stat__label">Downtime Avoided <small class="ai-stat__est">est.</small></span>
          <strong class="ai-stat__value">{{ p.predictedDowntimeAvoidedHours }}<small>h</small></strong>
        </div>
      </div>

      <div class="ai-panel__footer">
        <div class="ai-confidence">
          <lucide-icon name="sparkles" [size]="13"></lucide-icon>
          Confidence <small class="ai-stat__est">est.</small>
          <strong>{{ p.confidence }}%</strong>
        </div>
        <div class="ai-savings">
          Estimated savings
          <strong>{{ p.estimatedSavingsTnd | number }} TND</strong>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .ai-panel {
      position: relative;
      border-radius: 16px;
      padding: 16px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-mid);
      overflow: hidden;
    }

    .ai-panel::before {
      content: '';
      position: absolute;
      top: -40%;
      right: -20%;
      width: 220px;
      height: 220px;
      background: radial-gradient(circle, rgba(126, 34, 206, 0.14), transparent 70%);
      pointer-events: none;
    }

    .ai-panel__head {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 14px;
      position: relative;
    }

    .ai-panel__icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(126, 34, 206, 0.16);
      color: var(--accent-violet);
      flex-shrink: 0;
    }

    .ai-panel__eyebrow {
      margin: 0 0 3px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent-violet);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ai-panel__signal {
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--bg-surface);
      color: var(--text-secondary);
    }

    .ai-panel__signal--live {
      background: rgba(34, 197, 94, 0.16);
      color: var(--accent-green);
    }

    .ai-stat__est {
      font-size: 8px;
      font-weight: 500;
      font-style: italic;
      text-transform: none;
      color: var(--text-tertiary);
      margin-left: 3px;
    }

    .ai-panel__narrative {
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      color: var(--text-secondary);
    }

    .ai-panel__grid {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 14px;
    }

    .ai-stat {
      background: var(--bg-surface);
      border: 1px solid var(--border-dim);
      border-radius: 11px;
      padding: 9px 10px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .ai-stat__label {
      font-size: 9.5px;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .ai-stat__value {
      font-family: var(--font-mono);
      font-size: 17px;
      font-weight: 700;
      color: var(--text-primary);

      small {
        font-size: 10px;
        color: var(--accent-violet);
        margin-left: 2px;
        font-weight: 500;
      }
    }

    .ai-panel__footer {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 12px;
      border-top: 1px solid var(--border-dim);
      font-size: 11px;
      color: var(--text-secondary);
    }

    .ai-confidence {
      display: flex;
      align-items: center;
      gap: 5px;

      strong {
        color: var(--text-primary);
        margin-left: 2px;
      }
    }

    .ai-savings {
      display: flex;
      align-items: center;
      gap: 5px;

      strong {
        color: var(--accent-green);
        font-family: var(--font-mono);
      }
    }
  `],
})
export class AiPredictionsPanelComponent {
  @Input() prediction: AiPrediction | null = null;
}
