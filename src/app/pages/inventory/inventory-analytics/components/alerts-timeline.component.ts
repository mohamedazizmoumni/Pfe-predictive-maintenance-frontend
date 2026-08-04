import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TimelineEvent, TimelineEventKind } from '../inventory-analytics.types';
import { EmptyStateComponent } from './empty-state.component';

const KIND_ICON: Record<TimelineEventKind, string> = {
  replenished: 'PackageCheck',
  critical: 'OctagonAlert',
  'order-approved': 'ClipboardCheck',
  'ai-prediction': 'ScanEye',
  'supplier-delay': 'Truck',
  audit: 'ListChecks',
  general: 'Info',
};

@Component({
  selector: 'app-alerts-timeline',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, EmptyStateComponent],
  template: `
    <section class="timeline-panel">
      <header class="timeline-panel__header">
        <span class="timeline-panel__icon"><lucide-icon name="History" [size]="18"></lucide-icon></span>
        <div>
          <h3>Alerts Timeline</h3>
          <p>Recent inventory events</p>
        </div>
      </header>

      <ol class="timeline" *ngIf="events.length; else emptyBlock">
        <li class="timeline__item" *ngFor="let event of events">
          <span class="timeline__marker" [class]="'timeline__marker--' + event.accent">
            <lucide-icon [name]="iconFor(event.kind)" [size]="14"></lucide-icon>
          </span>
          <div class="timeline__content">
            <div class="timeline__row">
              <strong>{{ event.title }}</strong>
              <time>{{ event.timestamp | date:'MMM d, HH:mm' }}</time>
            </div>
            <p>{{ event.body }}</p>
          </div>
        </li>
      </ol>

      <ng-template #emptyBlock>
        <app-empty-state
          title="No recent activity"
          message="Inventory events like restocks, approvals and AI predictions will show up here."
          accentColor="#3B82F6"
        ></app-empty-state>
      </ng-template>
    </section>
  `,
  styles: [`
    .timeline-panel {
      background: var(--ia-surface);
      border: 1px solid var(--ia-border);
      border-radius: var(--ia-radius-lg);
      padding: 1.5rem;
      box-shadow: var(--ia-shadow-sm);
      height: 100%;
    }

    .timeline-panel__header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .timeline-panel__icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: rgba(59, 130, 246, 0.16);
      color: #93c5fd;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .timeline-panel__header h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--ia-text-primary);
    }

    .timeline-panel__header p {
      margin: 0.2rem 0 0;
      font-size: 0.8rem;
      color: var(--ia-text-secondary);
    }

    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 420px;
      overflow: auto;
      position: relative;
    }

    .timeline__item {
      position: relative;
      display: flex;
      gap: 0.85rem;
      padding-bottom: 1.1rem;
    }

    .timeline__item:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 13px;
      top: 28px;
      bottom: 0;
      width: 1px;
      background: var(--ia-border);
    }

    .timeline__marker {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      z-index: 1;
    }

    .timeline__marker--success { background: rgba(34, 197, 94, 0.18); color: #86efac; }
    .timeline__marker--warning { background: rgba(245, 158, 11, 0.18); color: #fcd34d; }
    .timeline__marker--danger  { background: rgba(239, 68, 68, 0.18); color: #fca5a5; }
    .timeline__marker--info    { background: rgba(59, 130, 246, 0.18); color: #93c5fd; }
    .timeline__marker--ai      { background: rgba(139, 92, 246, 0.2); color: #c4b5fd; }

    .timeline__content {
      flex: 1;
      min-width: 0;
    }

    .timeline__row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.75rem;
    }

    .timeline__row strong {
      font-size: 0.85rem;
      color: var(--ia-text-primary);
    }

    .timeline__row time {
      font-size: 0.7rem;
      color: var(--ia-text-muted);
      white-space: nowrap;
    }

    .timeline__content p {
      margin: 0.2rem 0 0;
      font-size: 0.78rem;
      color: var(--ia-text-secondary);
      line-height: 1.45;
    }
  `],
})
export class AlertsTimelineComponent {
  @Input() events: TimelineEvent[] = [];

  iconFor(kind: TimelineEventKind): string {
    return KIND_ICON[kind];
  }
}
