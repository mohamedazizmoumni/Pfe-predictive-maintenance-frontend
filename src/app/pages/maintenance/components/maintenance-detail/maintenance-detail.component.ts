import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Maintenance } from '../../../../core/models/sentinel.models';

@Component({
  selector: 'app-maintenance-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './maintenance-detail.component.html',
  styleUrl: './maintenance-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceDetailComponent {
  @Input() maintenance: Maintenance | null = null;
  @Input() isLoading: boolean | null = false;

  @Output() start = new EventEmitter<string>();
  @Output() complete = new EventEmitter<string>();
  @Output() approve = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();

  get hasSelection(): boolean {
    return !!this.maintenance;
  }

  get canStart(): boolean {
    return this.maintenance?.status === 'SCHEDULED';
  }

  get canComplete(): boolean {
    return this.maintenance?.status === 'IN_PROGRESS';
  }

  get canApprove(): boolean {
    return this.maintenance?.status === 'COMPLETED';
  }

  get canCancel(): boolean {
    return ['SCHEDULED', 'IN_PROGRESS'].includes(this.maintenance?.status || '');
  }

  onStart(): void {
    if (this.maintenance && this.canStart) {
      this.start.emit(this.maintenance.id);
    }
  }

  onComplete(): void {
    if (this.maintenance && this.canComplete) {
      this.complete.emit(this.maintenance.id);
    }
  }

  onApprove(): void {
    if (this.maintenance && this.canApprove) {
      this.approve.emit(this.maintenance.id);
    }
  }

  onCancel(): void {
    if (this.maintenance && this.canCancel) {
      this.cancel.emit(this.maintenance.id);
    }
  }

  onDelete(): void {
    if (this.maintenance) {
      this.delete.emit(this.maintenance.id);
    }
  }

  getStatusBadge(status: Maintenance['status']): string {
    return `status-pill status-${status.toLowerCase()}`;
  }
}
