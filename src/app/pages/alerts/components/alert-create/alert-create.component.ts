import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AlertCategory,
  AlertSeverity,
  CreateAlertPayload,
  Machine,
} from '../../../../core/models/sentinel.models';
import { UserService } from '../../../../core/services/user.service';
import { User } from '../../../../core/models/sentinel.models';

@Component({
  selector: 'app-alert-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './alert-create.component.html',
  styleUrl: './alert-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertCreateComponent implements OnInit {
  @Input() visible = false;
  @Input() machines: Machine[] | null = [];
  @Input() isSubmitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() submitAlert = new EventEmitter<CreateAlertPayload>();

  readonly severities = Object.values(AlertSeverity);
  readonly categories = Object.values(AlertCategory);

  /** Users available for assignment (managers, admins, technicians) */
  assignableUsers: User[] = [];
  usersLoading = false;

  form = this.fb.group({
    machineId:       ['', Validators.required],
    title:           ['', [Validators.required, Validators.minLength(4)]],
    message:         [''],
    severity:        [AlertSeverity.WARNING, Validators.required],
    category:        [AlertCategory.SENSOR_ANOMALY],
    sourceReference: [''],
    assignedTo:      ['', Validators.required],
    recommendations: [''],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly userService: UserService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAssignableUsers();
  }

  trackMachine(_: number, machine: Machine): number {
    return machine.id;
  }

  trackUser(_: number, user: User): string {
    return user.id;
  }

  getMachineLabel(machine: Machine): string {
    return `${machine.serialNumber || machine.id} · ${machine.model || 'Unknown'} (${machine.location || 'N/A'})`;
  }

  getUserLabel(user: User): string {
    const name =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.displayName || user.username;
    const role = user.roles?.[0]?.name?.replace('_', ' ') || '';
    return role ? `${name}  (${role})` : name;
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    const {
      machineId,
      title,
      message,
      severity,
      category,
      sourceReference,
      assignedTo,
      recommendations,
    } = this.form.value;

    const payload: CreateAlertPayload = {
      machineId:       Number(machineId),
      title:           title!.trim(),
      message:         message?.trim() || undefined,
      severity:        severity as AlertSeverity,
      category:        category as AlertCategory,
      sourceReference: sourceReference?.trim() || undefined,
      assignedTo:      assignedTo?.trim() || undefined,
      recommendations: recommendations?.trim() || undefined,
    };

    this.submitAlert.emit(payload);
  }

  onClose(): void {
    this.resetForm();
    this.close.emit();
  }

  private loadAssignableUsers(): void {
    this.usersLoading = true;
    // Load a generous page; users are filtered client-side to meaningful roles
    this.userService.users$.subscribe((users) => {
      this.assignableUsers = users.filter((u) =>
        u.roles?.some((r) =>
          ['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'TECHNICIAN'].includes(
            r.name?.toUpperCase()
          )
        )
      );
      this.usersLoading = false;
      this.cdr.markForCheck();
    });

    // Trigger load if not already loaded
    this.userService.loadUsers(0, 200);
  }

  private resetForm(): void {
    this.form.reset({
      machineId:       '',
      title:           '',
      message:         '',
      severity:        AlertSeverity.WARNING,
      category:        AlertCategory.SENSOR_ANOMALY,
      sourceReference: '',
      assignedTo:      '',
      recommendations: '',
    });
  }
}
