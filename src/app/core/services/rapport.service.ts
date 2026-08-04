import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, tap, finalize } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import {
  MaintenanceRapportRequest,
  MaintenanceRapportResponse,
  ApprovalRequest,
} from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class RapportService {
  private readonly rapportsUrl = apiEndpoint('/finance/rapports');

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private pendingCountSubject = new BehaviorSubject<number>(0);

  readonly isLoading$ = this.isLoadingSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();
  /** Sidebar badge count — manager-stage + finance-stage pending rapports relevant to the viewer's role(s). */
  readonly pendingCount$ = this.pendingCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  /** Mirrors FinanceService.refreshPendingCount's one-shot-on-login pattern, but sums whichever stage(s) the caller can actually review. */
  refreshPendingCount(includeManagerStage: boolean, includeFinanceStage: boolean): void {
    const calls: Observable<MaintenanceRapportResponse[]>[] = [];
    if (includeManagerStage) calls.push(this.getPendingManagerApprovals().pipe(catchError(() => of([]))));
    if (includeFinanceStage) calls.push(this.getPendingFinanceApprovals().pipe(catchError(() => of([]))));

    if (calls.length === 0) {
      this.pendingCountSubject.next(0);
      return;
    }

    forkJoin(calls).subscribe(results => {
      this.pendingCountSubject.next(results.reduce((sum, list) => sum + list.length, 0));
    });
  }

  private setLoading(v: boolean): void { this.isLoadingSubject.next(v); }

  private setError(err: unknown): void {
    const e = err as { error?: { message?: string }; message?: string };
    this.errorSubject.next(e?.error?.message ?? e?.message ?? 'An unexpected error occurred');
  }

  clearError(): void { this.errorSubject.next(null); }

  createRapport(request: MaintenanceRapportRequest): Observable<MaintenanceRapportResponse> {
    this.setLoading(true);
    this.clearError();
    return this.http.post<MaintenanceRapportResponse>(this.rapportsUrl, request).pipe(
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  getMyRapports(): Observable<MaintenanceRapportResponse[]> {
    return this.http.get<MaintenanceRapportResponse[]>(`${this.rapportsUrl}/mine`).pipe(
      catchError(err => { this.setError(err); throw err; }),
    );
  }

  getAllRapports(): Observable<MaintenanceRapportResponse[]> {
    return this.http.get<MaintenanceRapportResponse[]>(this.rapportsUrl).pipe(
      catchError(err => { this.setError(err); throw err; }),
    );
  }

  getPendingManagerApprovals(): Observable<MaintenanceRapportResponse[]> {
    return this.http.get<MaintenanceRapportResponse[]>(`${this.rapportsUrl}/pending-manager`).pipe(
      catchError(err => { this.setError(err); throw err; }),
    );
  }

  getPendingFinanceApprovals(): Observable<MaintenanceRapportResponse[]> {
    return this.http.get<MaintenanceRapportResponse[]>(`${this.rapportsUrl}/pending-finance`).pipe(
      catchError(err => { this.setError(err); throw err; }),
    );
  }

  getRapportById(id: number): Observable<MaintenanceRapportResponse> {
    return this.http.get<MaintenanceRapportResponse>(`${this.rapportsUrl}/${id}`).pipe(
      catchError(err => { this.setError(err); throw err; }),
    );
  }

  managerApproval(id: number, request: ApprovalRequest): Observable<MaintenanceRapportResponse> {
    this.setLoading(true);
    this.clearError();
    return this.http.post<MaintenanceRapportResponse>(`${this.rapportsUrl}/${id}/manager-approval`, request).pipe(
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }

  financeApproval(id: number, request: ApprovalRequest): Observable<MaintenanceRapportResponse> {
    this.setLoading(true);
    this.clearError();
    return this.http.post<MaintenanceRapportResponse>(`${this.rapportsUrl}/${id}/finance-approval`, request).pipe(
      catchError(err => { this.setError(err); throw err; }),
      finalize(() => this.setLoading(false)),
    );
  }
}
