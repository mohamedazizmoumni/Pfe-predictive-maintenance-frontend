import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { apiEndpoint } from '../http/api-base';
import {
  ExpenseReportRequest,
  ExpenseReportResponse,
  ApproveExpenseRequest,
  RejectExpenseRequest,
  ExpenseSummaryResponse,
  FinanceBudgetRequest,
  FinanceBudgetResponse,
  FinanceDashboardStats,
} from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly expensesUrl  = apiEndpoint('/finance/expenses');
  private readonly budgetUrl    = apiEndpoint('/finance/budget');
  private readonly dashboardUrl = apiEndpoint('/finance/dashboard');

  private expensesSubject  = new BehaviorSubject<ExpenseReportResponse[]>([]);
  private dashboardSubject = new BehaviorSubject<FinanceDashboardStats | null>(null);
  private pendingCountSubject = new BehaviorSubject<number>(0);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject     = new BehaviorSubject<string | null>(null);

  readonly expenses$  = this.expensesSubject.asObservable();
  readonly dashboard$ = this.dashboardSubject.asObservable();
  readonly pendingCount$ = this.pendingCountSubject.asObservable();
  readonly isLoading$ = this.isLoadingSubject.asObservable();
  readonly error$     = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private setLoading(v: boolean): void { this.isLoadingSubject.next(v); }

  private setError(err: unknown): void {
    const e = err as { error?: { message?: string }; message?: string };
    const msg = e?.error?.message ?? e?.message ?? 'An unexpected error occurred';
    this.errorSubject.next(msg);
  }

  clearError(): void { this.errorSubject.next(null); }

  private updateCachedExpense(updated: ExpenseReportResponse): void {
    const list = this.expensesSubject.value.map(e => e.id === updated.id ? updated : e);
    this.expensesSubject.next(list);
  }

  // ── EXPENSES ──────────────────────────────────────────────────────────────

  submitExpense(request: ExpenseReportRequest): Observable<ExpenseReportResponse> {
    this.setLoading(true);
    this.clearError();
    return this.http.post<ExpenseReportResponse>(this.expensesUrl, request).pipe(
      tap(created => this.expensesSubject.next([created, ...this.expensesSubject.value])),
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  getMyExpenses(): Observable<ExpenseReportResponse[]> {
    this.setLoading(true);
    this.clearError();
    return this.http.get<ExpenseReportResponse[]>(`${this.expensesUrl}/mine`).pipe(
      tap(list => this.expensesSubject.next(list)),
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  getAllExpenses(): Observable<ExpenseReportResponse[]> {
    this.setLoading(true);
    this.clearError();
    return this.http.get<ExpenseReportResponse[]>(this.expensesUrl).pipe(
      tap(list => this.expensesSubject.next(list)),
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  getPendingExpenses(): Observable<ExpenseReportResponse[]> {
    this.setLoading(true);
    this.clearError();
    return this.http.get<ExpenseReportResponse[]>(`${this.expensesUrl}/pending`).pipe(
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  getExpenseById(id: number): Observable<ExpenseReportResponse> {
    return this.http.get<ExpenseReportResponse>(`${this.expensesUrl}/${id}`).pipe(
      catchError(err => { this.setError(err); throw err; }),
    );
  }

  approveExpense(id: number, request: ApproveExpenseRequest): Observable<ExpenseReportResponse> {
    this.setLoading(true);
    this.clearError();
    return this.http.post<ExpenseReportResponse>(`${this.expensesUrl}/${id}/approve`, request).pipe(
      tap(updated => {
        this.updateCachedExpense(updated);
        this.pendingCountSubject.next(Math.max(0, this.pendingCountSubject.value - 1));
      }),
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  rejectExpense(id: number, request: RejectExpenseRequest): Observable<ExpenseReportResponse> {
    this.setLoading(true);
    this.clearError();
    return this.http.post<ExpenseReportResponse>(`${this.expensesUrl}/${id}/reject`, request).pipe(
      tap(updated => {
        this.updateCachedExpense(updated);
        this.pendingCountSubject.next(Math.max(0, this.pendingCountSubject.value - 1));
      }),
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  updateExpense(id: number, request: ExpenseReportRequest): Observable<ExpenseReportResponse> {
    this.setLoading(true);
    this.clearError();
    return this.http.put<ExpenseReportResponse>(`${this.expensesUrl}/${id}`, request).pipe(
      tap(updated => this.updateCachedExpense(updated)),
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  deleteExpense(id: number): Observable<void> {
    this.setLoading(true);
    this.clearError();
    return this.http.delete<void>(`${this.expensesUrl}/${id}`).pipe(
      tap(() => {
        this.expensesSubject.next(this.expensesSubject.value.filter(e => e.id !== id));
      }),
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  // ── BUDGET ────────────────────────────────────────────────────────────────

  createBudget(request: FinanceBudgetRequest): Observable<FinanceBudgetResponse> {
    this.setLoading(true);
    this.clearError();
    return this.http.post<FinanceBudgetResponse>(this.budgetUrl, request).pipe(
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  getCurrentBudget(): Observable<FinanceBudgetResponse> {
    this.setLoading(true);
    return this.http.get<FinanceBudgetResponse>(`${this.budgetUrl}/current`).pipe(
      tap(() => this.setLoading(false)),
      catchError((err: { status?: number; error?: { message?: string } }) => {
        this.setLoading(false);
        // 404 = no budget yet — not a real error, don't push to errorSubject
        if (err?.status !== 404) {
          this.errorSubject.next(err?.error?.message ?? 'Failed to load budget');
        }
        throw err;
      }),
    );
  }

  // FIX: was missing — added updateBudget
  updateBudget(id: number, request: FinanceBudgetRequest): Observable<FinanceBudgetResponse> {
    this.setLoading(true);
    this.clearError();
    return this.http.put<FinanceBudgetResponse>(`${this.budgetUrl}/${id}`, request).pipe(
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────

  getDashboard(): Observable<FinanceDashboardStats> {
    this.setLoading(true);
    this.clearError();
    return this.http.get<FinanceDashboardStats>(this.dashboardUrl).pipe(
      tap(data => this.dashboardSubject.next(data)),
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  getExpenseSummary(year: number, month: number): Observable<ExpenseSummaryResponse> {
    const params = { year: year.toString(), month: month.toString() };
    return this.http.get<ExpenseSummaryResponse>(apiEndpoint('/finance/expenses/summary'), { params }).pipe(
      catchError((err: unknown) => { this.setError(err); throw err; })
    );
  }

  getExpensesByMachine(machineId: number): Observable<ExpenseReportResponse[]> {
    return this.http.get<ExpenseReportResponse[]>(apiEndpoint('/finance/expenses/machine/' + machineId)).pipe(
      catchError((err: unknown) => { this.setError(err); throw err; })
    );
  }

  refreshPendingCount(): void {
    this.http.get<ExpenseReportResponse[]>(apiEndpoint('/finance/expenses/pending')).pipe(
      catchError(() => {
        return of([] as ExpenseReportResponse[]);
      })
    ).subscribe(list => this.pendingCountSubject.next(list.length));
  }
}