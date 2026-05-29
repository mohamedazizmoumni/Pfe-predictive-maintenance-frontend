import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CurrencyPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MaintenanceRecommendationDTO } from '../../core/models/recommendation.model';
import { UrgencyBadgeComponent } from '../../shared/urgency-badge/urgency-badge.component';

@Component({
  selector: 'app-recommendation-card',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    NgIf,
    NgFor,
    DecimalPipe,
    CurrencyPipe,
    UrgencyBadgeComponent,
  ],
  templateUrl: './recommendation-card.component.html',
  styleUrl: './recommendation-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationCardComponent {
  @Input({ required: true }) recommendation!: MaintenanceRecommendationDTO | any;
}
