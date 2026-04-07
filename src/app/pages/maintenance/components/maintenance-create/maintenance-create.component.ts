import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateMaintenanceRequest, Machine, User } from '../../../../core/models/sentinel.models';

@Component({
  selector: 'app-maintenance-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './maintenance-create.component.html',
  styleUrl: './maintenance-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceCreateComponent {
  @Input() visible = false;
  @Input() machines: Machine[] | null = [];
  @Input() technicians: User[] | null = [];
  @Input() isSubmitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() submitRequest = new EventEmitter<CreateMaintenanceRequest>();

  private readonly technicianIdPattern = /^\d+$/;

  readonly maintenanceTypes: Array<{ label: string; value: CreateMaintenanceRequest['type'] }> = [
    { label: 'Preventive', value: 'PREVENTIVE' },
    { label: 'Corrective', value: 'CORRECTIVE' },
    { label: 'Emergency', value: 'EMERGENCY' },
  ];

  readonly priorities: Array<{ label: string; value: CreateMaintenanceRequest['priority'] }> = [
    { label: 'Critical', value: 'CRITICAL' },
    { label: 'High', value: 'HIGH' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'Low', value: 'LOW' },
  ];

  form = this.fb.group({
    machineId: ['', Validators.required],
    type: ['PREVENTIVE', Validators.required],
    priority: ['MEDIUM', Validators.required],
    description: ['', [Validators.required, Validators.minLength(4)]],
    scheduledDate: ['', Validators.required],
    estimatedDuration: [60, [Validators.required, Validators.min(15), Validators.max(1440)]],
    assignedTechnicianId: ['', [Validators.pattern(this.technicianIdPattern)]],
    notes: [''],
  });

  constructor(private fb: FormBuilder) {}

  trackByValue(_: number, item: { label: string; value: string }): string {
    return item.value;
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    const {
      machineId,
      type,
      priority,
      description,
      scheduledDate,
      estimatedDuration,
      assignedTechnicianId,
      notes,
    } = this.form.value;

    const sanitizedTechnicianId = assignedTechnicianId
      ? String(assignedTechnicianId).trim()
      : '';

    const payload: CreateMaintenanceRequest = {
      machineId: machineId!,
      type: type as CreateMaintenanceRequest['type'],
      priority: priority as CreateMaintenanceRequest['priority'],
      description: description!,
      scheduledDate: scheduledDate!,
      estimatedDuration: Number(estimatedDuration),
      ...(sanitizedTechnicianId ? { assignedTechnicianId: sanitizedTechnicianId } : {}),
      ...(notes && notes.trim().length ? { notes: notes.trim() } : {}),
    };

    this.submitRequest.emit(payload);
  }

  onClose(): void {
    this.resetForm();
    this.close.emit();
  }

  private resetForm(): void {
    this.form.reset({
      machineId: '',
      type: 'PREVENTIVE',
      priority: 'MEDIUM',
      description: '',
      scheduledDate: '',
      estimatedDuration: 60,
      assignedTechnicianId: '',
      notes: '',
    });
  }

  trackTechnicianById(_: number, technician: User): string {
    return technician.id;
  }

  getMachineLabel(machine: Machine): string {
    return `${machine.serialNumber} · ${machine.model} (${machine.location})`;
  }

  getTechnicianLabel(technician: User): string {
    const name = technician.displayName?.trim()
      || `${technician.firstName || ''} ${technician.lastName || ''}`.trim();
    return name || technician.username || technician.email;
  }
}