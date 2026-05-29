import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AsyncPipe, CurrencyPipe, DecimalPipe, NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Observable, catchError, finalize, of } from 'rxjs';
import { MaintenanceBudgetDTO } from '../../core/models/budget.model';
import { BudgetService } from '../../core/services/budget.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-budget-overview',
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressBarModule,
    ReactiveFormsModule,
    AsyncPipe,
    NgIf,
    DecimalPipe,
    CurrencyPipe,
  ],
  templateUrl: './budget-overview.component.html',
  styleUrl: './budget-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetOverviewComponent {
  readonly form = this.fb.nonNullable.group({
    department: ['Workshop A'],
    period: ['2025-Q2'],
  });

  budget$: Observable<MaintenanceBudgetDTO> | null = null;
  readonly loading = signal(false);

  constructor(
    private readonly fb: FormBuilder,
    private readonly budgetService: BudgetService,
    private readonly notificationService: NotificationService
  ) {}

  loadBudget(): void {
    const { department, period } = this.form.getRawValue();
    this.loading.set(true);

    this.budget$ = this.budgetService.getStatus(department, period).pipe(
      catchError(() => {
        this.notificationService.error('Budget not found');
        return of({
          budgetId: 0,
          department,
          period,
          allocatedAmount: 0,
          spentAmount: 0,
          remainingAmount: 0,
          percentageUsed: 0,
          alertTriggered: false,
        } as MaintenanceBudgetDTO);
      }),
      finalize(() => this.loading.set(false))
    );
  }
}
