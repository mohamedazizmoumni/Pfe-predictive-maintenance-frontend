import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { MaintenanceService } from '../../core/services/maintenance.service';
import { FinanceService } from '../../core/services/finance.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { AlertApiService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';

import {
  Maintenance,
  FinanceBudgetResponse,
  FinanceDashboardStats,
  ExpenseReportResponse,
  ExpenseReportRequest,
  ExpenseCategory,
  FinanceBudgetRequest,
  DashboardOverview,
  AlertResponse,
  AlertSeverity,
  AlertStatus,
} from '../../core/models/sentinel.models';

// Local view model that maps finance API data to the dashboard display
interface BudgetData {
  id?: number;
  name: string;
  description: string;
  totalAmount: number;
  spent: number;
  category: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'exceeded';
  expenses: ExpenseReportResponse[];
}

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './manager-dashboard.component.html',
  styleUrl: './manager-dashboard.component.scss',
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ── Data signals ──────────────────────────────────────────────────────────
  budgets = signal<BudgetData[]>([]);
  selectedBudget = signal<BudgetData | null>(null);
  maintenanceTasks = signal<Maintenance[]>([]);
  dashboardOverview = signal<DashboardOverview | null>(null);
  recentAlerts = signal<AlertResponse[]>([]);
  financeDashboard = signal<FinanceDashboardStats | null>(null);

  // ── UI State ──────────────────────────────────────────────────────────────
  showBudgetModal = signal(false);
  showExpenseModal = signal(false);
  activeTab = signal<'overview' | 'budgets' | 'expenses' | 'monitoring'>('overview');
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  // ── Calendar ──────────────────────────────────────────────────────────────
  currentDate = signal(new Date());
  selectedDate = signal<Date | null>(null);

  // ── Forms ─────────────────────────────────────────────────────────────────
  budgetForm!: FormGroup;
  expenseForm!: FormGroup;

  // ── Computed stats ────────────────────────────────────────────────────────
  stats = computed(() => {
    const tasks = this.maintenanceTasks();
    const fin = this.financeDashboard();
    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
      pendingTasks: tasks.filter(t => t.status === 'SCHEDULED').length,
      overdueTasks: tasks.filter(t => t.status === 'CANCELLED').length,
      inProgressTasks: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      totalBudget: fin?.totalBudget ?? this.budgets().reduce((s, b) => s + b.totalAmount, 0),
      totalSpent: fin?.spentAmount ?? this.budgets().reduce((s, b) => s + b.spent, 0),
      budgetUtilization: fin?.utilizationPercentage
        ?? (this.budgets().length > 0
          ? Math.round(
              (this.budgets().reduce((s, b) => s + b.spent, 0) /
               this.budgets().reduce((s, b) => s + b.totalAmount, 0)) * 100
            )
          : 0),
    };
  });

  constructor(
    private maintenanceService: MaintenanceService,
    private financeService: FinanceService,
    private dashboardService: DashboardService,
    private alertService: AlertApiService,
    private authService: AuthService,
    private fb: FormBuilder,
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Initialization ────────────────────────────────────────────────────────

  private initializeForms(): void {
    this.budgetForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      totalAmount: ['', [Validators.required, Validators.min(0)]],
      category: ['maintenance', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
    });

    this.expenseForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      amount: ['', [Validators.required, Validators.min(0)]],
      category: [ExpenseCategory.MAINTENANCE, Validators.required],
      date: ['', Validators.required],
      notes: [''],
    });
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  loadAllData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Load maintenance tasks
    this.maintenanceService.loadMaintenanceTasks(0, 100);
    this.maintenanceService.maintenance$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => this.maintenanceTasks.set(tasks));

    // Load dashboard overview KPIs
    this.dashboardService.loadDashboard();
    this.dashboardService.overview$
      .pipe(takeUntil(this.destroy$))
      .subscribe(overview => {
        if (overview) this.dashboardOverview.set(overview);
      });

    // Load finance dashboard stats + expenses in parallel
    forkJoin({
      dashboard: this.financeService.getDashboard().pipe(catchError(() => of(null))),
      expenses: this.financeService.getAllExpenses().pipe(catchError(() => of([] as ExpenseReportResponse[]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ dashboard, expenses }) => {
        if (dashboard) {
          this.financeDashboard.set(dashboard);
          this.buildBudgetViewFromDashboard(dashboard, expenses ?? []);
        }
        this.isLoading.set(false);
      });

    // Load recent alerts (last 10)
    this.alertService.list({ page: 0, size: 10 })
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of(null)),
      )
      .subscribe(page => {
        if (page) this.recentAlerts.set(page.content);
      });
  }

  /**
   * Build the local BudgetData view model from the finance dashboard response.
   * The finance API returns a single annual budget; we represent it as one entry
   * and group expenses by category as sub-items.
   */
  private buildBudgetViewFromDashboard(
    dashboard: FinanceDashboardStats,
    expenses: ExpenseReportResponse[],
  ): void {
    if (!dashboard.budgetExists) {
      this.budgets.set([]);
      return;
    }

    const now = new Date();
    const yearStart = `${dashboard.currentYear}-01-01`;
    const yearEnd = `${dashboard.currentYear}-12-31`;

    const budget: BudgetData = {
      id: undefined, // will be set when we fetch the budget object
      name: `${dashboard.currentYear} Annual Budget`,
      description: `Annual maintenance & operations budget for ${dashboard.currentYear}`,
      totalAmount: dashboard.totalBudget,
      spent: dashboard.spentAmount,
      category: 'annual',
      startDate: yearStart,
      endDate: yearEnd,
      status: this.calculateBudgetStatus(dashboard.spentAmount, dashboard.totalBudget),
      expenses: expenses.filter(e => new Date(e.createdDate).getFullYear() === dashboard.currentYear),
    };

    this.budgets.set([budget]);
  }

  // ── Budget CRUD ───────────────────────────────────────────────────────────

  openBudgetModal(): void {
    this.budgetForm.reset({ category: 'maintenance' });
    this.selectedBudget.set(null);
    this.showBudgetModal.set(true);
  }

  editBudget(budget: BudgetData): void {
    this.selectedBudget.set(budget);
    this.budgetForm.patchValue({
      name: budget.name,
      description: budget.description,
      totalAmount: budget.totalAmount,
      category: budget.category,
      startDate: budget.startDate,
      endDate: budget.endDate,
    });
    this.showBudgetModal.set(true);
  }

  createBudget(): void {
    if (!this.budgetForm.valid) {
      this.markFormGroupTouched(this.budgetForm);
      return;
    }

    const formValue = this.budgetForm.value;
    const year = new Date(formValue.startDate).getFullYear();

    const request: FinanceBudgetRequest = {
      year,
      totalBudget: formValue.totalAmount,
      notes: formValue.description,
    };

    this.isLoading.set(true);
    this.financeService.createBudget(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showBudgetModal.set(false);
          this.budgetForm.reset();
          this.loadAllData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to create budget');
          this.isLoading.set(false);
        },
      });
  }

  deleteBudget(budgetId: number | undefined): void {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    // The finance API does not expose a delete endpoint for the annual budget;
    // remove locally and notify the user.
    const updated = this.budgets().filter(b => b.id !== budgetId);
    this.budgets.set(updated);
    this.selectedBudget.set(null);
  }

  // ── Expense CRUD ──────────────────────────────────────────────────────────

  openExpenseModal(budget: BudgetData): void {
    this.selectedBudget.set(budget);
    this.expenseForm.reset({
      category: ExpenseCategory.MAINTENANCE,
      date: new Date().toISOString().split('T')[0],
    });
    this.showExpenseModal.set(true);
  }

  registerExpense(): void {
    if (!this.expenseForm.valid || !this.selectedBudget()) {
      this.markFormGroupTouched(this.expenseForm);
      return;
    }

    const formValue = this.expenseForm.value;
    const request: ExpenseReportRequest = {
      title: formValue.title,
      description: formValue.description,
      amount: formValue.amount,
      category: formValue.category as ExpenseCategory,
      notes: formValue.notes,
    };

    this.isLoading.set(true);
    this.financeService.submitExpense(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showExpenseModal.set(false);
          this.expenseForm.reset();
          this.loadAllData(); // refresh to get updated totals
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to register expense');
          this.isLoading.set(false);
        },
      });
  }

  deleteExpense(expenseId: number): void {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    this.financeService.deleteExpense(expenseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadAllData(),
        error: (err) => this.errorMessage.set(err?.error?.message ?? 'Failed to delete expense'),
      });
  }

  // ── Calendar ──────────────────────────────────────────────────────────────

  previousMonth(): void {
    const c = this.currentDate();
    this.currentDate.set(new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const c = this.currentDate();
    this.currentDate.set(new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }

  goToToday(): void {
    this.currentDate.set(new Date());
  }

  selectDate(date: Date | null): void {
    if (date) this.selectedDate.set(date);
  }

  getMonthName(): string {
    return this.currentDate().toLocaleString('default', { month: 'long' });
  }

  getYear(): number {
    return this.currentDate().getFullYear();
  }

  getCalendarDays(): (Date | null)[] {
    const current = this.currentDate();
    const year = current.getFullYear();
    const month = current.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: (Date | null)[] = [];
    const date = new Date(startDate);
    while (days.length < 42) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }

  isToday(date: Date | null): boolean {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  hasEvents(date: Date | null): boolean {
    if (!date) return false;
    return this.getTasksForDate(date).length > 0;
  }

  getTasksForDate(date: Date): Maintenance[] {
    return this.maintenanceTasks().filter((task: any) => {
      const taskDate = new Date(task.scheduledDate);
      return (
        taskDate.getDate() === date.getDate() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getFullYear() === date.getFullYear()
      );
    });
  }

  // ── Utility helpers ───────────────────────────────────────────────────────

  getUpcomingTasks(): Maintenance[] {
    const today = new Date();
    return this.maintenanceTasks()
      .filter((t: any) => new Date(t.scheduledDate) >= today && t.status !== 'COMPLETED')
      .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .slice(0, 5);
  }

  getOverdueTasks(): Maintenance[] {
    const today = new Date();
    return this.maintenanceTasks()
      .filter((t: any) => new Date(t.scheduledDate) < today && t.status !== 'COMPLETED')
      .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .slice(0, 5);
  }

  getBudgetPercentage(budget: BudgetData): number {
    return budget.totalAmount > 0 ? Math.round((budget.spent / budget.totalAmount) * 100) : 0;
  }

  getActiveBudgetsCount(): number {
    return this.budgets().filter(b => b.status === 'active').length;
  }

  getRemainingBudget(): number {
    return this.stats().totalBudget - this.stats().totalSpent;
  }

  private calculateBudgetStatus(spent: number, total: number): 'active' | 'completed' | 'exceeded' {
    if (spent > total) return 'exceeded';
    if (spent === total) return 'completed';
    return 'active';
  }

  getTaskStatusClass(status: string): string {
    const map: Record<string, string> = {
      COMPLETED: 'status-completed',
      IN_PROGRESS: 'status-in-progress',
      PENDING: 'status-pending',
      OVERDUE: 'status-overdue',
    };
    return map[status] || 'status-pending';
  }

  getTaskPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      HIGH: 'priority-high',
      MEDIUM: 'priority-medium',
      LOW: 'priority-low',
      CRITICAL: 'priority-high',
    };
    return map[priority] || 'priority-medium';
  }

  getBudgetStatusClass(percentage: number): string {
    if (percentage >= 100) return 'budget-exceeded';
    if (percentage >= 80) return 'budget-warning';
    if (percentage >= 50) return 'budget-moderate';
    return 'budget-healthy';
  }

  getAlertSeverityClass(severity: AlertSeverity): string {
    const map: Record<string, string> = {
      CRITICAL: 'severity-critical',
      WARNING: 'severity-warning',
      INFO: 'severity-info',
    };
    return map[severity] || 'severity-info';
  }

  getExpenseCategoryLabel(category: string): string {
    const map: Record<string, string> = {
      MAINTENANCE: 'Maintenance',
      PARTS: 'Parts',
      LABOR: 'Labor',
      EQUIPMENT: 'Equipment',
      OTHER: 'Other',
    };
    return map[category] || category;
  }

  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount ?? 0);
  }

  closeModals(): void {
    this.showBudgetModal.set(false);
    this.showExpenseModal.set(false);
  }

  dismissError(): void {
    this.errorMessage.set(null);
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      formGroup.get(key)?.markAsTouched();
    });
  }

  // Expose enum to template
  readonly ExpenseCategory = ExpenseCategory;
}
