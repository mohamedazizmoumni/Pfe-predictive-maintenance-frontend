import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, timeout } from 'rxjs/operators';
import { FinanceService } from '../../../core/services/finance.service';
import { FinanceBudgetResponse, FinanceBudgetRequest } from '../../../core/models/sentinel.models';

type BudgetHealth = 'Healthy' | 'Warning' | 'Critical' | 'Over Budget';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './budget.component.html',
  styleUrl: './budget.component.scss',
})
export class BudgetComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // Show the form immediately — never block on a network call
  showForm   = true;
  isEditMode = false;
  isChecking = true;   // small spinner while we probe for existing budget
  isSubmitting = false;

  budget: FinanceBudgetResponse | null = null;
  error: string | null = null;
  successMessage: string | null = null;

  form!: FormGroup;
  readonly currentYear = new Date().getFullYear();

  constructor(
    private financeService: FinanceService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.probeExistingBudget();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── private ────────────────────────────────────────────────────

  private buildForm(): void {
    this.form = this.fb.group({
      year:        [this.currentYear, [Validators.required, Validators.min(2000), Validators.max(2099)]],
      totalBudget: [null as number | null, [Validators.required, Validators.min(0.01)]],
      notes:       [''],
    });
  }

  /**
   * Try to fetch the current budget with a 6-second timeout.
   * If it succeeds  → switch to view mode.
   * If it fails/404 → stay in create mode (form already visible).
   * Either way the form is always rendered.
   */
  private probeExistingBudget(): void {
    this.isChecking = true;

    this.financeService.getCurrentBudget()
      .pipe(
        timeout(6000),          // give up after 6 s — never hang forever
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (b) => {
          this.isChecking = false;
          this.budget = b;
          // Budget exists → switch to view/edit mode
          this.isEditMode = true;
          this.form.get('year')!.disable();
          this.form.patchValue({
            year:        b.year,
            totalBudget: b.totalBudget,
            notes:       b.notes ?? '',
          });
        },
        error: () => {
          // 404, timeout, 500, anything — just stay in create mode
          this.isChecking = false;
          this.budget = null;
          this.isEditMode = false;
          this.form.get('year')!.enable();
          this.form.reset({ year: this.currentYear, totalBudget: null, notes: '' });
        },
      });
  }

  // ── public ─────────────────────────────────────────────────────

  switchToEdit(): void {
    if (!this.budget) return;
    this.isEditMode = true;
    this.showForm = true;
    this.form.get('year')!.disable();
    this.form.patchValue({
      year:        this.budget.year,
      totalBudget: this.budget.totalBudget,
      notes:       this.budget.notes ?? '',
    });
    this.error = null;
    this.successMessage = null;
  }

  cancelEdit(): void {
    // Go back to view — don't hide the budget details
    this.showForm = false;
    this.error = null;
  }

  handleSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = null;
    this.successMessage = null;

    const raw = this.form.getRawValue();
    const request: FinanceBudgetRequest = {
      year:        Number(raw.year),
      totalBudget: Number(raw.totalBudget),
      notes:       raw.notes || undefined,
    };

    const op$ = this.isEditMode && this.budget
      ? this.financeService.updateBudget(this.budget.id, request)
      : this.financeService.createBudget(request);

    op$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (b) => {
        this.isSubmitting = false;
        this.budget = b;
        this.showForm = false;
        this.successMessage = this.isEditMode
          ? 'Budget updated successfully.'
          : 'Budget created successfully.';
        this.isEditMode = true;   // now we have a budget, future action = edit
      },
      error: (err) => {
        this.isSubmitting = false;
        const status: number = err?.status ?? 0;
        this.error = err?.error?.message ?? (
          status === 409
            ? 'A budget for this year already exists.'
            : 'Failed to save budget. Please try again.'
        );
      },
    });
  }

  // ── template helpers ────────────────────────────────────────────

  utilizationClass(pct: number): string {
    if (pct > 100) return 'bar-over';
    if (pct >= 85)  return 'bar-critical';
    if (pct >= 60)  return 'bar-warning';
    return 'bar-ok';
  }

  healthLabel(pct: number): BudgetHealth {
    if (pct > 100) return 'Over Budget';
    if (pct >= 85)  return 'Critical';
    if (pct >= 60)  return 'Warning';
    return 'Healthy';
  }

  healthClass(pct: number): string {
    if (pct > 100) return 'health-over';
    if (pct >= 85)  return 'health-critical';
    if (pct >= 60)  return 'health-warning';
    return 'health-ok';
  }

  dismissError(): void   { this.error = null; }
  dismissSuccess(): void { this.successMessage = null; }
}
