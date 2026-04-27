import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { UrgencyLevel } from '../../core/models/recommendation.model';

@Component({
  selector: 'app-urgency-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge badge-{{ urgencyClass }}">{{ urgencyLabel }}</span>`,
  styles: [
    `
      .badge { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
      .badge-low      { background: #E3F2FD; color: #1565C0; }
      .badge-medium   { background: #FFF8E1; color: #F57C00; }
      .badge-high     { background: #FFF3E0; color: #E65100; }
      .badge-critical { background: #FFEBEE; color: #C62828; }
    `,
  ],
})
export class UrgencyBadgeComponent {
  @Input() urgency: UrgencyLevel = 'LOW';

  get urgencyClass(): string {
    return (this.urgency ?? 'LOW').toLowerCase();
  }

  get urgencyLabel(): string {
    return this.urgency ?? 'LOW';
  }
}
