import { ChangeDetectionStrategy, Component, Input, OnInit, signal } from '@angular/core';
import { AsyncPipe, CurrencyPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Observable, catchError, of } from 'rxjs';
import { CompareRequestDTO, CostComparisonDTO } from '../../core/models/cost-comparison.model';
import { Machine } from '../../core/models/machine.model';
import { MachineService } from '../../core/services/machine.service';
import { CostService } from '../../core/services/cost.service';
import { NotificationService } from '../../core/services/notification.service';
import { UrgencyBadgeComponent } from '../../shared/urgency-badge/urgency-badge.component';

@Component({
  selector: 'app-cost-comparison',
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    AsyncPipe,
    NgIf,
    NgFor,
    DecimalPipe,
    CurrencyPipe,
    MatIconModule,
    UrgencyBadgeComponent,
  ],
  templateUrl: './cost-comparison.component.html',
  styleUrl: './cost-comparison.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostComparisonComponent implements OnInit {
  @Input() preselectedMachineId?: number | null;

  machines$!: Observable<Machine[]>;
  result: CostComparisonDTO | null = null;
  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    machineId: [0, [Validators.required, Validators.min(1)]],
    actionId: [0, [Validators.required, Validators.min(1)]],
    estimatedFailureDowntimeHours: [1, [Validators.required, Validators.min(1)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly costService: CostService,
    private readonly machineService: MachineService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.machines$ = this.machineService.getAll().pipe(
      catchError(() => {
        this.notificationService.error('Failed to load machines');
        return of([]);
      })
    );

    if (this.preselectedMachineId !== null && this.preselectedMachineId !== undefined) {
      this.form.patchValue({ machineId: this.preselectedMachineId });
    }
  }

  compare(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { machineId, actionId, estimatedFailureDowntimeHours } = this.form.getRawValue();
    const request: CompareRequestDTO = {
      machineId,
      actionId,
      estimatedFailureDowntimeHours,
    };

    this.loading.set(true);
    this.costService.compareCosts(request).subscribe({
      next: (result) => {
        this.result = result;
        this.loading.set(false);
        this.notificationService.success('Cost comparison ready');
      },
      error: () => {
        this.loading.set(false);
        this.notificationService.error('Failed to compare costs');
      },
    });
  }
}
