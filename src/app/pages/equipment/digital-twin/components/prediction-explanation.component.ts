import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExplainabilityService } from '../../../../core/services/explainability.service';
import { PredictionExplanation } from '../../../../core/models/sentinel.models';

@Component({
  selector: 'app-prediction-explanation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="explain" *ngIf="explanation as e">
      <p class="summary">{{ e.summary }}</p>

      <div class="factor" *ngFor="let f of e.topFactors">
        <div class="factor__head">
          <span class="factor__name">{{ f.sensorName }}</span>
          <span class="factor__badge factor__badge--{{ f.contribution }}">{{ f.contribution }}</span>
        </div>
        <div class="factor__track">
          <div class="factor__fill factor__fill--{{ f.contribution }}" [style.width.%]="minPercent(f.deviationPercent)"></div>
        </div>
        <p class="factor__detail">
          {{ f.currentValue }}{{ f.unit ? ' ' + f.unit : '' }} — normal range {{ f.normalMin }}–{{ f.normalMax }}{{ f.unit ? ' ' + f.unit : '' }}
          <span *ngIf="f.deviationPercent > 0">({{ f.deviationPercent }}% outside range)</span>
        </p>
      </div>

      <p class="empty" *ngIf="!e.hasSensorData">No sensor range data available for this machine yet.</p>
    </div>
    <p class="loading" *ngIf="isLoading">Loading explanation…</p>
  `,
  styles: [`
    .explain { display: flex; flex-direction: column; gap: 12px; }
    .summary { margin: 0; font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; }
    .factor { display: flex; flex-direction: column; gap: 4px; }
    .factor__head { display: flex; justify-content: space-between; align-items: center; }
    .factor__name { font-size: 12px; font-weight: 700; color: var(--text-primary); }
    .factor__badge {
      font-size: 9.5px; font-weight: 800; text-transform: uppercase; padding: 2px 7px; border-radius: 999px;
    }
    .factor__badge--high { background: rgba(249, 112, 102, 0.15); color: #f97066; }
    .factor__badge--medium { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .factor__badge--low { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .factor__track { height: 5px; border-radius: 999px; background: rgba(148,163,184,0.15); overflow: hidden; }
    .factor__fill { height: 100%; border-radius: 999px; }
    .factor__fill--high { background: #f97066; }
    .factor__fill--medium { background: #f59e0b; }
    .factor__fill--low { background: #22c55e; }
    .factor__detail { margin: 0; font-size: 10.5px; color: var(--text-tertiary); }
    .empty, .loading { font-size: 12px; color: var(--text-tertiary); margin: 0; }
  `],
})
export class PredictionExplanationComponent implements OnChanges {
  @Input() machineId!: number;

  explanation: PredictionExplanation | null = null;
  isLoading = true;

  constructor(private explainabilityService: ExplainabilityService) {}

  ngOnChanges(): void {
    if (!this.machineId) return;
    this.isLoading = true;
    this.explainabilityService.explain(this.machineId).subscribe({
      next: (explanation) => { this.explanation = explanation; this.isLoading = false; },
      error: () => { this.isLoading = false; },
    });
  }

  minPercent(deviation: number): number {
    return Math.min(100, Math.max(4, deviation));
  }
}
