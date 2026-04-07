import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertResponse, AlertSeverity, AlertStatus } from '../../../../core/models/sentinel.models';

@Component({
  selector: 'app-alert-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-detail.component.html',
  styleUrl: './alert-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertDetailComponent {
  @Input() alert: AlertResponse | null = null;
  @Input() isLoading: boolean | null = false;
  @Input() actionInFlight: boolean | null = false;
  @Input() error: string | null = null;

  @Output() acknowledge = new EventEmitter<number>();
  @Output() escalate = new EventEmitter<number>();
  @Output() close = new EventEmitter<number>();
  @Output() delete = new EventEmitter<number>();
  @Output() refresh = new EventEmitter<void>();

  get hasSelection(): boolean {
    return !!this.alert;
  }

  get canAcknowledge(): boolean {
    return this.alert?.status === AlertStatus.NEW;
  }

  get canEscalate(): boolean {
    return [AlertStatus.NEW, AlertStatus.ACKNOWLEDGED].includes(
      this.alert?.status as AlertStatus
    );
  }

  get canClose(): boolean {
    return this.alert?.status === AlertStatus.ACKNOWLEDGED || this.alert?.status === AlertStatus.ESCALATED;
  }

  get timeline(): Array<{ label: string; date?: string; actor?: string; note?: string }> {
    if (!this.alert) {
      return [];
    }

    return [
      {
        label: 'Created',
        date: this.alert.createdDate,
        actor: this.alert.createdByDisplayName || this.alert.createdBy,
        note: this.alert.recommendations,
      },
      {
        label: 'Acknowledged',
        date: this.alert.acknowledgedDate,
        actor: this.alert.acknowledgedBy,
      },
      {
        label: 'Escalated',
        date: this.alert.escalatedDate,
        actor: this.alert.escalatedBy,
        note: this.alert.escalationNotes,
      },
      {
        label: 'Closed',
        date: this.alert.closedDate,
        actor: this.alert.closedBy,
        note: this.alert.resolutionNotes,
      },
    ].filter((step) => step.date);
  }

  getSeverityBadgeClass(severity?: AlertSeverity): string {
    if (!severity) {
      return 'severity-badge';
    }
    return `severity-badge severity-${severity.toLowerCase()}`;
  }

  triggerAcknowledge(): void {
    if (this.alert) {
      this.acknowledge.emit(this.alert.id);
    }
  }

  triggerEscalate(): void {
    if (this.alert) {
      this.escalate.emit(this.alert.id);
    }
  }

  triggerClose(): void {
    if (this.alert) {
      this.close.emit(this.alert.id);
    }
  }

  triggerDelete(): void {
    if (this.alert) {
      this.delete.emit(this.alert.id);
    }
  }
}
