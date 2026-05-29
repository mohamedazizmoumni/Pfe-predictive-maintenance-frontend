import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-risk-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './risk-badge.component.html',
  styleUrls: ['./risk-badge.component.scss'],
})
export class RiskBadgeComponent {
  @Input() level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

  get classes(): string {
    switch (this.level) {
      case 'CRITICAL':
        return 'badge critical';
      case 'HIGH':
        return 'badge high';
      case 'MEDIUM':
        return 'badge medium';
      default:
        return 'badge low';
    }
  }
}
