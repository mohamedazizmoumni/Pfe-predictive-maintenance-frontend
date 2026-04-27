import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <mat-card class="stat-card accent-{{accent}}">
      <mat-card-content>
        <div class="stat-row">
          <mat-icon class="stat-icon">{{ icon }}</mat-icon>
          <div>
            <div class="stat-value">{{ value }}</div>
            <div class="stat-title">{{ title }}</div>
            <div class="stat-subtitle" *ngIf="subtitle">{{ subtitle }}</div>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .stat-card { border-radius: var(--radius); box-shadow: var(--shadow); min-width: 180px; }
      .accent-primary { border-left: 4px solid var(--primary); }
      .accent-warning { border-left: 4px solid var(--warning); }
      .accent-danger  { border-left: 4px solid var(--danger);  }
      .accent-success { border-left: 4px solid var(--success); }
      .stat-row   { display: flex; align-items: center; gap: 16px; }
      .stat-icon  { font-size: 36px; width: 36px; height: 36px; color: var(--text-secondary); }
      .stat-value { font-size: 28px; font-weight: 700; color: var(--text-primary); }
      .stat-title { font-size: 13px; color: var(--text-secondary); }
      .stat-subtitle { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    `,
  ],
})
export class StatCardComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) value!: string | number;
  @Input() subtitle?: string;
  @Input() accent: 'primary' | 'warning' | 'danger' | 'success' = 'primary';
  @Input() icon = 'info';
}
