import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Maintenance, User } from '../../../../core/models/sentinel.models';

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
  @Input() technicians: User[] | null = [];
  /** Manager/Admin/Super Admin — may accept (or delete, where applicable) any task. */
  @Input() isPrivilegedRole = false;
  /** True when the viewer holds the Technician role — combined with ownership below to self-accept their own task. */
  @Input() isTechnicianRole = false;
  @Input() currentUserId: string | null = null;
  /** Mirrors the backend's PERM_MAINTENANCE_DELETE (Admin/Super Admin only). */
  @Input() canDeleteRole = false;

  /** Accept is allowed for Manager/Admin/Super Admin on any task, or a Technician on their own assigned task — mirrors MaintenanceController.approveMaintenance's ownership check. */
  get canApproveRole(): boolean {
    if (this.isPrivilegedRole) return true;
    return this.isTechnicianRole && this.isOwnTask;
  }

  get isOwnTask(): boolean {
    return !!this.currentUserId
      && !!this.maintenance?.assignedTechnicianId
      && String(this.maintenance.assignedTechnicianId) === String(this.currentUserId);
  }

  get technicianName(): string {
    const id = this.maintenance?.assignedTechnicianId;
    if (!id) return 'Unassigned';
    const match = (this.technicians || []).find((t) => String(t.id) === String(id));
    if (!match) return `Technician #${id}`;
    return match.displayName?.trim()
      || `${match.firstName || ''} ${match.lastName || ''}`.trim()
      || match.username
      || `Technician #${id}`;
  }

  @Output() start = new EventEmitter<string>();
  @Output() complete = new EventEmitter<string>();
  @Output() approve = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();

  get hasSelection(): boolean {
    return !!this.maintenance;
  }

  get canApprove(): boolean {
    return this.canApproveRole && this.maintenance?.status === 'SCHEDULED';
  }

  get canStart(): boolean {
    return this.maintenance?.status === 'APPROVED';
  }

  get canComplete(): boolean {
    return this.maintenance?.status === 'IN_PROGRESS';
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
    if (this.maintenance && this.canDeleteRole) {
      this.delete.emit(this.maintenance.id);
    }
  }

  getStatusBadge(status: Maintenance['status']): string {
    return `status-pill status-${status.toLowerCase()}`;
  }
}
