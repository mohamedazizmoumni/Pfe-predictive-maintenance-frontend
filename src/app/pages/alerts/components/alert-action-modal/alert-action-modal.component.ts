import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AcknowledgeAlertPayload,
  CloseAlertPayload,
  EscalateAlertPayload,
} from '../../../../core/models/sentinel.models';
import { AlertActionMode } from '../../alert.types';

@Component({
  selector: 'app-alert-action-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './alert-action-modal.component.html',
  styleUrl: './alert-action-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertActionModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() mode: AlertActionMode = 'acknowledge';
  @Input() isSubmitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() submitAction = new EventEmitter<
    AcknowledgeAlertPayload | EscalateAlertPayload | CloseAlertPayload
  >();

  form = this.fb.group({
    acknowledgedDate: [''],
    escalationNotes: [''],
    reassignTo: [''],
    resolutionNotes: ['', Validators.required],
  });

  constructor(private fb: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mode']) {
      this.configureFormForMode();
    }
    if (changes['visible'] && !this.visible) {
      this.form.reset({ resolutionNotes: '' });
    }
  }

  get title(): string {
    switch (this.mode) {
      case 'acknowledge':
        return 'Acknowledge alert';
      case 'escalate':
        return 'Escalate alert';
      case 'close':
        return 'Close alert';
    }
  }

  get description(): string {
    switch (this.mode) {
      case 'acknowledge':
        return 'Confirm you have received the incident. Optionally timestamp the acknowledgment.';
      case 'escalate':
        return 'Provide notes and optionally reassign the alert to another operator or team.';
      case 'close':
        return 'Document the resolution path before closing the alert.';
    }
  }

  onSubmit(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.mode === 'close' && this.form.get('resolutionNotes')?.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { acknowledgedDate, escalationNotes, reassignTo, resolutionNotes } = this.form.value;

    if (this.mode === 'acknowledge') {
      const payload: AcknowledgeAlertPayload = {
        acknowledgedDate: acknowledgedDate ? new Date(acknowledgedDate).toISOString() : undefined,
      };
      this.submitAction.emit(payload);
    } else if (this.mode === 'escalate') {
      const payload: EscalateAlertPayload = {
        escalationNotes: escalationNotes?.trim() || undefined,
        reassignTo: reassignTo?.trim() || undefined,
      };
      this.submitAction.emit(payload);
    } else {
      const payload: CloseAlertPayload = {
        resolutionNotes: resolutionNotes!.trim(),
      };
      this.submitAction.emit(payload);
    }
  }

  onClose(): void {
    this.close.emit();
  }

  private configureFormForMode(): void {
    const resolutionCtrl = this.form.get('resolutionNotes');
    if (!resolutionCtrl) {
      return;
    }

    if (this.mode === 'close') {
      resolutionCtrl.setValidators([Validators.required, Validators.minLength(4)]);
    } else {
      resolutionCtrl.clearValidators();
    }
    resolutionCtrl.updateValueAndValidity({ emitEvent: false });
  }
}
