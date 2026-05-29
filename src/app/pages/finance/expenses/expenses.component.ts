import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { jsPDF } from 'jspdf';
import { takeUntil } from 'rxjs/operators';
import { FinanceService } from '../../../core/services/finance.service';
import { AuthService } from '../../../core/services/auth.service';
import { rolesCollectionHasAny } from '../../../core/utils/role.utils';
import {
  ExpenseReportResponse,
  ExpenseReportRequest,
  ApproveExpenseRequest,
  RejectExpenseRequest,
  ExpenseStatus,
  ExpenseCategory,
} from '../../../core/models/sentinel.models';

type ActiveTab = 'mine' | 'all';
type StatusFilter = 'ALL' | ExpenseStatus;
type CategoryFilter = 'ALL' | ExpenseCategory;
type ReviewMode = 'approve' | 'reject';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss',
})
export class ExpensesComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // ── state ──────────────────────────────────────────────────────────────────
  isLoading = false;
  error: string | null = null;
  successMessage: string | null = null;

  expenses: ExpenseReportResponse[] = [];
  filteredExpenses: ExpenseReportResponse[] = [];

  activeTab: ActiveTab = 'mine';
  statusFilter: StatusFilter = 'ALL';
  categoryFilter: CategoryFilter = 'ALL';

  isFinanceManager = false;
  currentUsername = '';

  showSubmitForm = false;
  editingExpense: ExpenseReportResponse | null = null;
  isSubmitting = false;

  reviewingExpense: ExpenseReportResponse | null = null;
  reviewMode: ReviewMode = 'approve';
  isReviewing = false;
  resubmittingFrom: ExpenseReportResponse | null = null;

  // ── forms ──────────────────────────────────────────────────────────────────
  submitForm!: FormGroup;
  reviewForm!: FormGroup;

  // ── enums exposed to template ──────────────────────────────────────────────
  readonly ExpenseStatus = ExpenseStatus;
  readonly ExpenseCategory = ExpenseCategory;
  readonly categories: ExpenseCategory[] = [
    ExpenseCategory.MAINTENANCE,
    ExpenseCategory.PARTS,
    ExpenseCategory.LABOR,
    ExpenseCategory.EQUIPMENT,
    ExpenseCategory.OTHER,
  ];
  readonly statusFilters: StatusFilter[] = ['ALL', ExpenseStatus.PENDING, ExpenseStatus.APPROVED, ExpenseStatus.REJECTED];
  readonly categoryFilters: CategoryFilter[] = ['ALL', ...this.categories];

  constructor(
    private financeService: FinanceService,
    private authService: AuthService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.buildForms();
    this.resolveRole();
    this.subscribeToService();
    this.loadExpenses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── init helpers ───────────────────────────────────────────────────────────

  private buildForms(): void {
    this.submitForm = this.fb.group({
      title:       ['', [Validators.required, Validators.maxLength(120)]],
      amount:      [null, [Validators.required, Validators.min(0.01)]],
      category:    [ExpenseCategory.MAINTENANCE, Validators.required],
      machineName: [''],
      description: [''],
      notes:       [''],
    });

    this.reviewForm = this.fb.group({
      reviewNote:      [''],
      rejectionReason: [''],
    });
  }

  private resolveRole(): void {
    const user = this.authService.getCurrentUser();
    this.currentUsername = user?.username ?? '';
    this.isFinanceManager = rolesCollectionHasAny(user?.roles, ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN']);
    if (this.isFinanceManager) {
      this.activeTab = 'all';
    }
  }

  private subscribeToService(): void {
    this.financeService.isLoading$.pipe(takeUntil(this.destroy$))
      .subscribe(v => this.isLoading = v);

    this.financeService.error$.pipe(takeUntil(this.destroy$))
      .subscribe(e => this.error = e);

    this.financeService.expenses$.pipe(takeUntil(this.destroy$))
      .subscribe(list => {
        this.expenses = list;
        this.applyFilters();
      });
  }

  private loadExpenses(): void {
    const call$ = this.isFinanceManager
      ? this.financeService.getAllExpenses()
      : this.financeService.getMyExpenses();

    call$.pipe(takeUntil(this.destroy$)).subscribe({ error: () => {} });
  }

  // ── filtering ──────────────────────────────────────────────────────────────

  applyFilters(): void {
    let list = this.activeTab === 'mine'
      ? this.expenses.filter(e => e.submittedBy === this.currentUsername)
      : this.expenses;

    if (this.statusFilter !== 'ALL') {
      list = list.filter(e => e.status === this.statusFilter);
    }
    if (this.categoryFilter !== 'ALL') {
      list = list.filter(e => e.category === this.categoryFilter);
    }
    this.filteredExpenses = list;
  }

  setTab(tab: ActiveTab): void {
    this.activeTab = tab;
    this.applyFilters();
  }

  setStatusFilter(f: StatusFilter): void {
    this.statusFilter = f;
    this.applyFilters();
  }

  setCategoryFilter(f: CategoryFilter): void {
    this.categoryFilter = f;
    this.applyFilters();
  }

  // ── submit form ────────────────────────────────────────────────────────────

  openSubmitForm(): void {
    this.editingExpense = null;
    this.submitForm.reset({ category: ExpenseCategory.MAINTENANCE });
    this.showSubmitForm = true;
    this.successMessage = null;
  }

  openEditForm(expense: ExpenseReportResponse): void {
    this.editingExpense = expense;
    this.submitForm.patchValue({
      title:       expense.title,
      amount:      expense.amount,
      category:    expense.category,
      machineName: expense.machineName ?? '',
      description: expense.description ?? '',
      notes:       expense.notes ?? '',
    });
    this.showSubmitForm = true;
    this.successMessage = null;
  }

  closeSubmitForm(): void {
    this.showSubmitForm = false;
    this.editingExpense = null;
    this.submitForm.reset();
  }

  handleSubmit(): void {
    if (this.submitForm.invalid) {
      this.submitForm.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;
    this.successMessage = null;

    const raw = this.submitForm.value;
    const request: ExpenseReportRequest = {
      title:       raw.title,
      amount:      raw.amount,
      category:    raw.category,
      machineName: raw.machineName || undefined,
      description: raw.description || undefined,
      notes:       raw.notes || undefined,
    };

    const op$ = this.editingExpense
      ? this.financeService.updateExpense(this.editingExpense.id, request)
      : this.financeService.submitExpense(request);

    op$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = this.editingExpense
          ? 'Expense updated successfully.'
          : 'Expense submitted for review.';
        if (this.resubmittingFrom) {
          this.clearResubmit();
          this.successMessage = 'Expense resubmitted successfully. The original rejected record is kept for audit trail.';
        }
        this.closeSubmitForm();
      },
      error: () => { this.isSubmitting = false; },
    });
  }

  resubmit(expense: ExpenseReportResponse): void {
    if (expense.status !== 'REJECTED') return;
    const currentUsername = this.authService.getCurrentUser()?.username ?? '';
    if (expense.submittedBy !== currentUsername) return;
    this.resubmittingFrom = expense;
    this.submitForm.patchValue({
      title:       expense.title,
      amount:      expense.amount,
      category:    expense.category,
      machineName: expense.machineName ?? '',
      description: expense.description ?? '',
      notes:       '',
    });
    this.showSubmitForm = true;
    setTimeout(() => document.querySelector('.submit-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  clearResubmit(): void {
    this.resubmittingFrom = null;
    this.submitForm.reset({ category: this.categories[0] });
  }

  exportExpensePdf(expense: ExpenseReportResponse): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const x = 20;
    let y = 40;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Sentinel Predictive Maintenance', x, y);
    y += 24;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Expense Report Receipt', x, y);
    y += 12;
    doc.line(x, y, 595 - x, y);
    y += 18;
    doc.setFontSize(11);
    doc.setTextColor('#6b7280');
    doc.setFont('helvetica', 'bold');
    doc.text('EXPENSE DETAILS', x, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#000000');
    const lines = [
      `Reference: Expense #${expense.id}`,
      `Title: ${expense.title}`,
      `Category: ${expense.category}`,
      `Amount: ${expense.amount.toFixed(2)} TND`,
      `Status: ${expense.status}`,
      `Machine: ${expense.machineName ?? 'N/A'}`,
      `Description: ${expense.description ?? 'N/A'}`,
    ];
    lines.forEach(line => { doc.text(line, x, y); y += 14; });
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#6b7280');
    doc.text('SUBMISSION INFO', x, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#000');
    doc.text(`Submitted by: ${expense.submittedByName}`, x, y); y += 14;
    doc.text(`Submitted on: ${new Date(expense.createdDate).toLocaleDateString()}`, x, y); y += 18;

    if (expense.status === 'APPROVED') {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#6b7280');
      doc.text('APPROVAL INFO', x, y); y += 18;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#000');
      doc.text(`Approved by: ${expense.reviewedBy ?? 'N/A'}`, x, y); y += 14;
      doc.text(`Approved on: ${expense.reviewedDate ? new Date(expense.reviewedDate).toLocaleDateString() : 'N/A'}`, x, y); y += 14;
      doc.text(`Review note: ${expense.reviewNote ?? 'None'}`, x, y); y += 18;
    }

    doc.line(x, y, 595 - x, y); y += 12;
    doc.setFontSize(9);
    doc.setTextColor('#6b7280');
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated on: ${new Date().toLocaleString()}`, x, y); y += 12;
    doc.text('This document is auto-generated by Sentinel Finance Module', x, y);

    const filename = `expense-receipt-${expense.id}-${expense.title.toLowerCase().replace(/\s+/g, '-')}.pdf`;
    doc.save(filename);
  }

  // ── delete ─────────────────────────────────────────────────────────────────

  handleDelete(expense: ExpenseReportResponse): void {
    this.financeService.deleteExpense(expense.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.successMessage = 'Expense deleted.'; },
        error: () => {},
      });
  }

  // ── review ─────────────────────────────────────────────────────────────────

  openReview(expense: ExpenseReportResponse, mode: ReviewMode): void {
    this.reviewingExpense = expense;
    this.reviewMode = mode;
    this.reviewForm.reset();
    if (mode === 'reject') {
      this.reviewForm.get('rejectionReason')!.setValidators([Validators.required]);
    } else {
      this.reviewForm.get('rejectionReason')!.clearValidators();
    }
    this.reviewForm.get('rejectionReason')!.updateValueAndValidity();
    this.successMessage = null;
  }

  closeReview(): void {
    this.reviewingExpense = null;
    this.reviewForm.reset();
  }

  handleReview(): void {
    if (this.reviewForm.invalid) {
      this.reviewForm.markAllAsTouched();
      return;
    }
    if (!this.reviewingExpense) return;

    this.isReviewing = true;
    const id = this.reviewingExpense.id;

    const op$ = this.reviewMode === 'approve'
      ? this.financeService.approveExpense(id, { reviewNote: this.reviewForm.value.reviewNote } as ApproveExpenseRequest)
      : this.financeService.rejectExpense(id, { rejectionReason: this.reviewForm.value.rejectionReason } as RejectExpenseRequest);

    op$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isReviewing = false;
        this.successMessage = this.reviewMode === 'approve'
          ? 'Expense approved.'
          : 'Expense rejected.';
        this.closeReview();
      },
      error: () => { this.isReviewing = false; },
    });
  }

  // ── template helpers ───────────────────────────────────────────────────────

  isOwner(expense: ExpenseReportResponse): boolean {
    return expense.submittedBy === this.currentUsername;
  }

  canEdit(expense: ExpenseReportResponse): boolean {
    return this.isOwner(expense) && expense.status === ExpenseStatus.PENDING;
  }

  canDelete(expense: ExpenseReportResponse): boolean {
    return this.isOwner(expense) && expense.status === ExpenseStatus.PENDING;
  }

  canReview(expense: ExpenseReportResponse): boolean {
    return this.isFinanceManager && expense.status === ExpenseStatus.PENDING;
  }

  categoryLabel(cat: ExpenseCategory): string {
    const map: Record<ExpenseCategory, string> = {
      [ExpenseCategory.MAINTENANCE]: 'Maintenance',
      [ExpenseCategory.PARTS]:       'Parts',
      [ExpenseCategory.LABOR]:       'Labor',
      [ExpenseCategory.EQUIPMENT]:   'Equipment',
      [ExpenseCategory.OTHER]:       'Other',
    };
    return map[cat] ?? cat;
  }

  // ✅ Fixed: use proper emoji literals instead of escaped byte sequences
  categoryIcon(cat: ExpenseCategory): string {
    const map: Record<ExpenseCategory, string> = {
      [ExpenseCategory.MAINTENANCE]: '🔧',
      [ExpenseCategory.PARTS]:       '⚙️',
      [ExpenseCategory.LABOR]:       '👷',
      [ExpenseCategory.EQUIPMENT]:   '🏭',
      [ExpenseCategory.OTHER]:       '📦',
    };
    return map[cat] ?? '🔄';
  }

  dismissError(): void   { this.financeService.clearError(); }
  dismissSuccess(): void { this.successMessage = null; }

  trackById(_: number, item: ExpenseReportResponse): number { return item.id; }
}