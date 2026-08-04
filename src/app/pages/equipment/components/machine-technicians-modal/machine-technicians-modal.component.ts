import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { EquipmentService } from '../../../../core/services/equipment.service';
import { UserService } from '../../../../core/services/user.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { Machine, MachineTechnicianDTO, User } from '../../../../core/models/sentinel.models';

@Component({
  selector: 'app-machine-technicians-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './machine-technicians-modal.component.html',
  styleUrl: './machine-technicians-modal.component.scss',
})
export class MachineTechniciansModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() machine: Machine | null = null;

  @Output() close = new EventEmitter<void>();

  assigned: MachineTechnicianDTO[] = [];
  availableTechnicians: User[] = [];
  selectedTechnicianId = '';
  private allTechnicians: User[] = [];

  isLoading = false;
  isSubmitting = false;
  errorMessage = '';

  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly userService: UserService,
    private readonly confirmDialog: ConfirmDialogService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.machine) {
      this.loadData();
    }
    if (changes['visible'] && !this.visible) {
      this.reset();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  assign(): void {
    if (!this.machine || !this.selectedTechnicianId || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    const technicianId = Number(this.selectedTechnicianId);

    this.equipmentService.assignTechnician(this.machine.id, technicianId).subscribe({
      next: (dto) => {
        this.isSubmitting = false;
        this.assigned = [...this.assigned, dto];
        this.selectedTechnicianId = '';
        this.recomputeAvailable();
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = this.resolveError(error, 'Failed to assign technician.');
      },
    });
  }

  async unassign(entry: MachineTechnicianDTO): Promise<void> {
    if (!this.machine || this.isSubmitting) {
      return;
    }

    const confirmed = await this.confirmDialog.confirmDanger(
      'Unassign technician',
      `Unassign ${entry.technicianDisplayName} from ${this.machine.name || 'this machine'}?`,
      'Unassign'
    );
    if (!confirmed) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.equipmentService.unassignTechnician(this.machine.id, entry.technicianId).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.assigned = this.assigned.filter((a) => a.technicianId !== entry.technicianId);
        this.recomputeAvailable();
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = this.resolveError(error, 'Failed to unassign technician.');
      },
    });
  }

  trackByAssignment(_: number, entry: MachineTechnicianDTO): number {
    return entry.id;
  }

  trackByUser(_: number, user: User): string {
    return user.id;
  }

  getUserLabel(user: User): string {
    return user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName} (${user.username})`
      : user.displayName || user.username;
  }

  private loadData(): void {
    if (!this.machine) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const machineId = this.machine.id;

    forkJoin({
      assigned: this.equipmentService.getMachineTechnicians(machineId),
      technicians: this.userService.getTechnicians(),
    }).subscribe({
      next: ({ assigned, technicians }) => {
        this.isLoading = false;
        this.assigned = assigned;
        this.allTechnicians = technicians;
        this.recomputeAvailable();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = this.resolveError(error, 'Failed to load technician assignments.');
      },
    });
  }

  private recomputeAvailable(): void {
    const assignedIds = new Set(this.assigned.map((a) => String(a.technicianId)));
    this.availableTechnicians = this.allTechnicians.filter((t) => !assignedIds.has(String(t.id)));
  }

  private reset(): void {
    this.assigned = [];
    this.availableTechnicians = [];
    this.allTechnicians = [];
    this.selectedTechnicianId = '';
    this.errorMessage = '';
    this.isLoading = false;
    this.isSubmitting = false;
  }

  private resolveError(error: any, fallback: string): string {
    const e = error?.error;
    if (!e) return fallback;
    if (typeof e === 'string' && e.trim()) return e;
    if (typeof e?.message === 'string' && e.message.trim()) return e.message;
    return fallback;
  }
}
