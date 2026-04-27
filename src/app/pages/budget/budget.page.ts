import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
} from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MaintenanceBudgetDTO } from '../../core/models';
import { BudgetService } from '../../core/services/budget.service';
import { NotificationService } from '../../core/services/notification.service';
import { BudgetOverviewComponent } from '../../components/budget-overview/budget-overview.component';

@Component({
  selector: 'app-budget-page',
  standalone: true,
  imports: [
    BudgetOverviewComponent,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    NgIf,
    NgFor,
    DecimalPipe,
  ],
  templateUrl: './budget.page.html',
  styleUrl: './budget.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetPage implements OnInit {
  readonly budgets = signal<MaintenanceBudgetDTO[]>([]);
  readonly loading = signal(false);

  private readonly budgetRefs = [
    { department: 'Workshop A', period: '2025-Q2' },
    { department: 'Workshop B', period: '2025-Q2' },
  ];

  readonly expenseForm = this.fb.nonNullable.group({
    budgetId: [0, [Validators.required, Validators.min(1)]],
    amount: [0, [Validators.required, Validators.min(1)]],
  });

  constructor(
    private readonly budgetService: BudgetService,
    private readonly notificationService: NotificationService,
    private readonly fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.loadBudgets();
  }

  loadBudgets(): void {
    this.loading.set(true);

    forkJoin(
      this.budgetRefs.map((ref) =>
        this.budgetService.getStatus(ref.department, ref.period)
      )
    )
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (budgets) => this.budgets.set(budgets),
        error: () => this.notificationService.error('Failed to load budgets'),
      });
  }

  submitExpense(): void {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const { budgetId, amount } = this.expenseForm.getRawValue();
    this.loading.set(true);

    this.budgetService
      .registerExpense(budgetId, amount)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.notificationService.success('Expense registered');
          this.loadBudgets();
        },
        error: () => this.notificationService.error('Failed to register expense'),
      });
  }
}
