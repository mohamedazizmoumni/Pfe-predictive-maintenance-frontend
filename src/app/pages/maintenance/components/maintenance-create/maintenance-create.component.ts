import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateTaskRequest, Machine, User } from '../../../../core/models/sentinel.models';

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
  @Input() maintenanceId: number | null = null;
  @Input() isSubmitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() submitRequest = new EventEmitter<CreateTaskRequest>();

  readonly priorities: Array<{ label: string; value: CreateTaskRequest['priority'] }> = [
    { label: 'Critical', value: 'CRITICAL' },
    { label: 'High', value: 'HIGH' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'Low', value: 'LOW' },
  ];

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    machineId: ['', Validators.required],
    priority: ['MEDIUM', Validators.required],
    description: ['', [Validators.required, Validators.minLength(5)]],
    dueDate: ['', Validators.required],
    assignedTechnicianId: ['', Validators.required],
  });

  constructor(private fb: FormBuilder) {}

  trackByValue(_: number, item: { label: string; value: string }): string {
    return item.value;
  }

  trackTechnicianById(_: number, technician: User): string {
    // Use id so the [value]="technician.id" binding is consistent
    return String(technician.id);
  }

  getMachineLabel(machine: Machine): string {
    return `${machine.serialNumber} · ${machine.model} (${machine.location})`;
  }

  getTechnicianLabel(technician: User): string {
    const name =
      technician.displayName?.trim() ||
      `${technician.firstName || ''} ${technician.lastName || ''}`.trim();
    return name || technician.username || technician.email;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.isSubmitting) return;

    const {
      title,
      machineId,
      priority,
      description,
      dueDate,
      assignedTechnicianId,
    } = this.form.getRawValue();

    const parsedTechnicianId = Number(assignedTechnicianId);
    const parsedMachineId = Number(machineId);
    const sanitizedTitle = (title || '').trim();
    const sanitizedDescription = (description || '').trim();

    if (!sanitizedTitle || sanitizedTitle.length < 3) {
      this.form.controls.title.setErrors({ invalidTitle: true });
      this.form.controls.title.markAsTouched();
      return;
    }

    if (!sanitizedDescription || sanitizedDescription.length < 5) {
      this.form.controls.description.setErrors({ invalidDescription: true });
      this.form.controls.description.markAsTouched();
      return;
    }

    if (!Number.isInteger(parsedMachineId) || parsedMachineId <= 0) {
      this.form.controls.machineId.setErrors({ invalidMachineId: true });
      this.form.controls.machineId.markAsTouched();
      return;
    }

    if (!Number.isInteger(parsedTechnicianId) || parsedTechnicianId <= 0) {
      this.form.controls.assignedTechnicianId.setErrors({ invalidTechnicianId: true });
      this.form.controls.assignedTechnicianId.markAsTouched();
      return;
    }

    const payload: CreateTaskRequest = {
      title: sanitizedTitle,
      description: sanitizedDescription,
      machineId: parsedMachineId,
      priority: priority as CreateTaskRequest['priority'],
      status: 'PENDING',
      dueDate: this.toApiDateTime(dueDate || ''),
      assignedTechnicianId: parsedTechnicianId,
      ...(this.maintenanceId && this.maintenanceId > 0
        ? { maintenanceId: this.maintenanceId }
        : {}),
    };

    this.submitRequest.emit(payload);
    this.onClose();
  }

  private toApiDateTime(dateTime: string): string {
    if (!dateTime) return '';
    return dateTime.length === 16 ? `${dateTime}:00` : dateTime;
  }

  onClose(): void {
    this.resetForm();
    this.close.emit();
  }

  private resetForm(): void {
    this.form.reset({
      title: '',
      machineId: '',
      priority: 'MEDIUM',
      description: '',
      dueDate: '',
      assignedTechnicianId: '',
    });
  }
}