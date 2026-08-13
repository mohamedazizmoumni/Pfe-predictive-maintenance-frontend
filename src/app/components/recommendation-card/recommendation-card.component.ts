import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SavedRecommendationResponse } from '../../core/models/sentinel.models';
import { UrgencyBadgeComponent } from '../../shared/urgency-badge/urgency-badge.component';
import { UrgencyLevel } from '../../core/models/recommendation.model';

export interface RecommendationDecision {
  id: number;
  note?: string;
}

@Component({
  selector: 'app-recommendation-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    UrgencyBadgeComponent,
  ],
  templateUrl: './recommendation-card.component.html',
  styleUrl: './recommendation-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationCardComponent {
  @Input({ required: true }) recommendation!: SavedRecommendationResponse;
  @Output() approveRecommendation = new EventEmitter<RecommendationDecision>();
  @Output() rejectRecommendation = new EventEmitter<RecommendationDecision>();
  @Output() viewMaintenanceTask = new EventEmitter<number>();

  rejectNote = '';
  showRejectForm = false;

  get urgencyLevel(): UrgencyLevel {
    const valid: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const level = this.recommendation.urgencyLevel as UrgencyLevel;
    return valid.includes(level) ? level : 'LOW';
  }

  approve(): void {
    this.approveRecommendation.emit({ id: this.recommendation.id });
  }

  startReject(): void {
    this.showRejectForm = true;
  }

  cancelReject(): void {
    this.showRejectForm = false;
    this.rejectNote = '';
  }

  confirmReject(): void {
    if (!this.rejectNote.trim()) {
      return;
    }
    this.rejectRecommendation.emit({ id: this.recommendation.id, note: this.rejectNote.trim() });
    this.showRejectForm = false;
  }
}
