import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateTaskRequest, Machine, User } from '../../../../core/models/sentinel.models';

/** Carries context from another page (an alert, an AI recommendation…) into a fresh create form. */
export interface MaintenanceCreatePrefill {
  machineId?: number;
  title?: string;
  description?: string;
  priority?: CreateTaskRequest['priority'];
}

@Component({
  selector: 'app-maintenance-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './maintenance-create.component.html',
  styleUrl: './maintenance-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceCreateComponent implements OnChanges {
  @Input() visible = false;
  @Input() machines: Machine[] | null = [];
  @Input() technicians: User[] | null = [];
  @Input() isSubmitting = false;
  @Input() prefill: MaintenanceCreatePrefill | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() submitRequest = new EventEmitter<CreateTaskRequest>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.prefill) {
      this.form.patchValue({
        title: this.prefill.title ?? this.form.value.title,
        machineId: this.prefill.machineId ? String(this.prefill.machineId) : this.form.value.machineId,
        priority: this.prefill.priority ?? this.form.value.priority,
        description: this.prefill.description ?? this.form.value.description,
      });
    }
  }

  readonly priorities: Array<{ label: string; value: CreateTaskRequest['priority'] }> = [
    { label: 'Critical', value: 'CRITICAL' },
    { label: 'High', value: 'HIGH' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'Low', value: 'LOW' },
  ];

  readonly types: Array<{ label: string; value: NonNullable<CreateTaskRequest['type']> }> = [
    { label: 'Preventive', value: 'PREVENTIVE' },
    { label: 'Corrective', value: 'CORRECTIVE' },
    { label: 'Emergency', value: 'EMERGENCY' },
  ];

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    machineId: ['', Validators.required],
    type: ['PREVENTIVE', Validators.required],
    priority: ['MEDIUM', Validators.required],
    estimatedDuration: ['', [Validators.required, Validators.min(1)]],
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
      type,
      priority,
      estimatedDuration,
      description,
      dueDate,
      assignedTechnicianId,
    } = this.form.getRawValue();

    const parsedTechnicianId = Number(assignedTechnicianId);
    const parsedMachineId = Number(machineId);
    const parsedDuration = Number(estimatedDuration);
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

    // The maintenance record has no title column — fold it into the description
    // so it's still visible to whoever reads the work order.
    const payload: CreateTaskRequest = {
      machineId: parsedMachineId,
      type: type as CreateTaskRequest['type'],
      priority: priority as CreateTaskRequest['priority'],
      estimatedDuration: Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : undefined,
      description: `${sanitizedTitle}: ${sanitizedDescription}`,
      scheduledDate: this.toApiDateTime(dueDate || ''),
      assignedTechnicianId: parsedTechnicianId,
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
      type: 'PREVENTIVE',
      priority: 'MEDIUM',
      estimatedDuration: '',
      description: '',
      dueDate: '',
      assignedTechnicianId: '',
    });
  }
}