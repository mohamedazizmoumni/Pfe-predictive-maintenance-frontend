import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AiInsight } from '../inventory-analytics.types';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  selector: 'app-ai-insights-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, EmptyStateComponent],
  template: `
    <section class="ai-panel">
      <div class="ai-panel__glow"></div>

      <header class="ai-panel__header">
        <span class="ai-panel__icon"><lucide-icon name="Brain" [size]="22"></lucide-icon></span>
        <div class="ai-panel__titles">
          <p class="ai-panel__eyebrow">AI Inventory Intelligence</p>
          <h2>Predictive signals across parts, suppliers and demand</h2>
        </div>
        <span class="ai-panel__live"><span class="ai-panel__dot"></span>Live</span>
      </header>

      <div class="ai-panel__list" *ngIf="insights.length; else emptyBlock">
        <div class="ai-insight" *ngFor="let insight of insights">
          <span class="ai-insight__icon" [class]="'ai-insight__icon--' + insight.accent">
            <lucide-icon [name]="insight.icon" [size]="16"></lucide-icon>
          </span>
          <p class="ai-insight__text">{{ insight.text }}</p>
          <div class="ai-insight__confidence">
            <div class="ai-insight__track">
              <div class="ai-insight__fill" [class]="'ai-insight__fill--' + insight.accent" [style.width.%]="insight.confidence"></div>
            </div>
            <span>{{ insight.confidence }}%</span>
          </div>
        </div>
      </div>

      <ng-template #emptyBlock>
        <app-empty-state
          title="No AI insights yet"
          message="Insights appear once enough inventory activity has been recorded."
          accentColor="#8B5CF6"
        ></app-empty-state>
      </ng-template>
    </section>
  `,
  styles: [`
    .ai-panel {
      position: relative;
      overflow: hidden;
      border-radius: var(--ia-radius-lg);
      padding: 1.75rem 1.85rem;
      background: linear-gradient(160deg, rgba(139, 92, 246, 0.16), rgba(18, 24, 38, 0.6) 55%);
      border: 1px solid rgba(139, 92, 246, 0.28);
      box-shadow: 0 24px 60px rgba(88, 28, 235, 0.14);
      backdrop-filter: blur(18px);
    }

    .ai-panel__glow {
      position: absolute;
      top: -80px;
      right: -60px;
      width: 260px;
      height: 260px;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.35), transparent 70%);
      pointer-events: none;
    }

    .ai-panel__header {
      position: relative;
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.4rem;
    }

    .ai-panel__icon {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(139, 92, 246, 0.22);
      color: #c4b5fd;
      flex-shrink: 0;
      box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.3);
    }

    .ai-panel__titles {
      flex: 1;
      min-width: 0;
    }

    .ai-panel__eyebrow {
      margin: 0;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #c4b5fd;
    }

    .ai-panel__titles h2 {
      margin: 0.25rem 0 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--ia-text-primary);
      letter-spacing: -0.01em;
    }

    .ai-panel__live {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.72rem;
      font-weight: 700;
      color: #c4b5fd;
      background: rgba(139, 92, 246, 0.14);
      border: 1px solid rgba(139, 92, 246, 0.3);
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      white-space: nowrap;
    }

    .ai-panel__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #c4b5fd;
      box-shadow: 0 0 8px #8b5cf6;
      animation: ai-pulse 1.8s infinite;
    }

    @keyframes ai-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .ai-panel__list {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .ai-insight {
      display: grid;
      grid-template-columns: 32px 1fr auto;
      align-items: center;
      gap: 0.9rem;
      padding: 0.85rem 1rem;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      transition: background 0.15s ease, transform 0.15s ease;
    }

    .ai-insight:hover {
      background: rgba(255, 255, 255, 0.055);
      transform: translateX(2px);
    }

    .ai-insight__icon {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .ai-insight__icon--danger  { background: rgba(239, 68, 68, 0.18); color: #fca5a5; }
    .ai-insight__icon--warning { background: rgba(245, 158, 11, 0.18); color: #fcd34d; }
    .ai-insight__icon--info    { background: rgba(59, 130, 246, 0.18); color: #93c5fd; }
    .ai-insight__icon--success { background: rgba(34, 197, 94, 0.18); color: #86efac; }

    .ai-insight__text {
      margin: 0;
      font-size: 0.87rem;
      color: var(--ia-text-primary);
      line-height: 1.45;
    }

    .ai-insight__confidence {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 96px;
    }

    .ai-insight__track {
      width: 56px;
      height: 5px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }

    .ai-insight__fill {
      height: 100%;
      border-radius: 999px;
    }

    .ai-insight__fill--danger  { background: #ef4444; }
    .ai-insight__fill--warning { background: #f59e0b; }
    .ai-insight__fill--info    { background: #3b82f6; }
    .ai-insight__fill--success { background: #22c55e; }

    .ai-insight__confidence span {
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--ia-text-secondary);
      white-space: nowrap;
    }

    @media (max-width: 640px) {
      .ai-insight {
        grid-template-columns: 32px 1fr;
      }
      .ai-insight__confidence {
        grid-column: 2 / 3;
      }
    }
  `],
})
export class AiInsightsPanelComponent {
  @Input() insights: AiInsight[] = [];
}
