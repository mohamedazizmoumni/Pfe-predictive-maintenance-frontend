import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

let instanceCounter = 0;

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty">
      <svg class="empty__art" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" [attr.stop-color]="accentColor" stop-opacity="0.55" />
            <stop offset="100%" [attr.stop-color]="accentColor" stop-opacity="0.08" />
          </linearGradient>
        </defs>
        <rect x="18" y="34" width="84" height="44" rx="10" [attr.stroke]="accentColor" stroke-opacity="0.35" stroke-width="1.5" [attr.fill]="'url(#' + gradientId + ')'" />
        <path d="M18 46 L60 62 L102 46" [attr.stroke]="accentColor" stroke-opacity="0.5" stroke-width="1.5" fill="none" />
        <path d="M60 62 L60 78" [attr.stroke]="accentColor" stroke-opacity="0.5" stroke-width="1.5" />
        <circle cx="60" cy="20" r="11" [attr.stroke]="accentColor" stroke-opacity="0.45" stroke-width="1.5" fill="none" stroke-dasharray="3 4" />
        <circle cx="60" cy="20" r="3" [attr.fill]="accentColor" fill-opacity="0.6" />
      </svg>
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
    </div>
  `,
  styles: [`
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.5rem;
      padding: 2.5rem 1.5rem;
      color: var(--ia-text-secondary);
    }
    .empty__art {
      width: 120px;
      height: 90px;
      margin-bottom: 0.5rem;
    }
    .empty h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--ia-text-primary);
    }
    .empty p {
      margin: 0;
      font-size: 0.8rem;
      max-width: 34ch;
      line-height: 1.5;
      color: var(--ia-text-muted);
    }
  `],
})
export class EmptyStateComponent {
  @Input() title = 'Nothing here yet';
  @Input() message = 'Data will appear here once it becomes available.';
  @Input() accentColor = '#3B82F6';
  readonly gradientId = `empty-grad-${++instanceCounter}`;
}
