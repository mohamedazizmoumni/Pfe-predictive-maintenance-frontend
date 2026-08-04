import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { MachineDependencyRow } from '../inventory-analytics.types';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  selector: 'app-machine-dependency',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, EmptyStateComponent],
  template: `
    <section class="machine-panel">
      <header class="machine-panel__header">
        <span class="machine-panel__icon"><lucide-icon name="Factory" [size]="18"></lucide-icon></span>
        <div>
          <h3>Machine Dependency</h3>
          <p>Machines at risk of stopping because of a missing spare part</p>
        </div>
      </header>

      <div class="machine-list" *ngIf="rows.length; else emptyBlock">
        <div class="machine-row" *ngFor="let row of rows">
          <div class="machine-row__identity">
            <span class="machine-row__icon" [class]="'machine-row__icon--' + row.risk">
              <lucide-icon name="Factory" [size]="16"></lucide-icon>
            </span>
            <div>
              <strong>{{ row.machineName }}</strong>
              <div class="muted"><lucide-icon name="MapPin" [size]="11"></lucide-icon> {{ row.location }}</div>
            </div>
          </div>

          <div class="machine-row__part">
            <span class="muted">Depends on</span>
            <strong>{{ row.partName }}</strong>
          </div>

          <div class="machine-row__stat">
            <span class="muted">Available</span>
            <strong>{{ row.currentAvailability }}</strong>
          </div>

          <div class="machine-row__stat">
            <span class="muted">Days remaining</span>
            <strong [class]="'text-' + row.risk">{{ row.daysRemaining }}d</strong>
          </div>

          <span class="risk-badge" [class]="'risk-badge--' + row.risk">{{ row.risk }}</span>
        </div>
      </div>

      <ng-template #emptyBlock>
        <app-empty-state
          title="No machines at risk"
          message="No tracked machine currently depends on a low or critical part."
          accentColor="#22C55E"
        ></app-empty-state>
      </ng-template>
    </section>
  `,
  styles: [`
    .machine-panel {
      background: var(--ia-surface);
      border: 1px solid var(--ia-border);
      border-radius: var(--ia-radius-lg);
      padding: 1.5rem;
      box-shadow: var(--ia-shadow-sm);
      height: 100%;
    }

    .machine-panel__header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .machine-panel__icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: rgba(245, 158, 11, 0.16);
      color: #fcd34d;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .machine-panel__header h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--ia-text-primary);
    }

    .machine-panel__header p {
      margin: 0.2rem 0 0;
      font-size: 0.8rem;
      color: var(--ia-text-secondary);
    }

    .machine-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      max-height: 380px;
      overflow: auto;
    }

    .machine-row {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.3fr) 0.7fr 0.9fr auto;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 0.9rem;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid var(--ia-border);
    }

    .machine-row__identity {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      min-width: 0;
    }

    .machine-row__identity strong {
      display: block;
      font-size: 0.86rem;
      color: var(--ia-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .machine-row__icon {
      width: 30px;
      height: 30px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .machine-row__icon--critical { background: rgba(127, 29, 29, 0.35); color: #fca5a5; }
    .machine-row__icon--high     { background: rgba(239, 68, 68, 0.16); color: #fca5a5; }
    .machine-row__icon--medium   { background: rgba(245, 158, 11, 0.16); color: #fcd34d; }
    .machine-row__icon--low      { background: rgba(34, 197, 94, 0.16); color: #86efac; }

    .machine-row__part, .machine-row__stat {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }

    .machine-row__part strong, .machine-row__stat strong {
      font-size: 0.84rem;
      color: var(--ia-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .muted {
      font-size: 0.7rem;
      color: var(--ia-text-muted);
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .text-critical { color: #fca5a5; }
    .text-high { color: #fca5a5; }
    .text-medium { color: #fcd34d; }
    .text-low { color: #86efac; }

    .risk-badge {
      display: inline-flex;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      font-size: 0.66rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      justify-self: end;
    }

    .risk-badge--critical { background: rgba(127, 29, 29, 0.35); color: #fca5a5; }
    .risk-badge--high     { background: rgba(239, 68, 68, 0.16); color: #fca5a5; }
    .risk-badge--medium   { background: rgba(245, 158, 11, 0.16); color: #fcd34d; }
    .risk-badge--low      { background: rgba(34, 197, 94, 0.16); color: #86efac; }

    @media (max-width: 900px) {
      .machine-row {
        grid-template-columns: 1fr 1fr;
        row-gap: 0.5rem;
      }
    }
  `],
})
export class MachineDependencyComponent {
  @Input() rows: MachineDependencyRow[] = [];
}
