import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AlertCategory,
  AlertSeverity,
  CreateAlertPayload,
  Machine,
} from '../../../../core/models/sentinel.models';

@Component({
  selector: 'app-alert-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './alert-create.component.html',
  styleUrl: './alert-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertCreateComponent {
  @Input() visible = false;
  @Input() machines: Machine[] | null = [];
  @Input() isSubmitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() submitAlert = new EventEmitter<CreateAlertPayload>();

  readonly severities = Object.values(AlertSeverity);
  readonly categories = Object.values(AlertCategory);

  form = this.fb.group({
    machineId: ['', Validators.required],
    title: ['', [Validators.required, Validators.minLength(4)]],
    message: [''],
    severity: [AlertSeverity.WARNING, Validators.required],
    category: [AlertCategory.SENSOR_ANOMALY],
    sourceReference: [''],
    assignedTo: [''],
    recommendations: [''],
  });

  constructor(private fb: FormBuilder) {}

  trackMachine(_: number, machine: Machine): number {
    return machine.id;
  }

  getMachineLabel(machine: Machine): string {
    return `${machine.serialNumber || machine.id} · ${machine.model || 'Unknown'} (${machine.location || 'N/A'})`;
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    const { machineId, title, message, severity, category, sourceReference, assignedTo, recommendations } =
      this.form.value;

    const payload: CreateAlertPayload = {
      machineId: Number(machineId),
      title: title!.trim(),
      message: message?.trim() || undefined,
      severity: severity as AlertSeverity,
      category: category as AlertCategory,
      sourceReference: sourceReference?.trim() || undefined,
      assignedTo: assignedTo?.trim() || undefined,
      recommendations: recommendations?.trim() || undefined,
    };

    this.submitAlert.emit(payload);
  }

  onClose(): void {
    this.resetForm();
    this.close.emit();
  }

  private resetForm(): void {
    this.form.reset({
      machineId: '',
      title: '',
      message: '',
      severity: AlertSeverity.WARNING,
      category: AlertCategory.SENSOR_ANOMALY,
      sourceReference: '',
      assignedTo: '',
      recommendations: '',
    });
  }
}
