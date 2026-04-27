import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Budget } from '../models/budget.model';
import { apiEndpoint } from '../core/http/api-base';

@Injectable({
  providedIn: 'root',
})
export class BudgetService {
  private readonly baseUrl = apiEndpoint('/v1/budgets');

  constructor(private http: HttpClient) {}

  getBudgetStatus(department: string, period: string): Observable<Budget> {
    return this.http
      .get<Budget>(`${this.baseUrl}/${department}/${period}`)
      .pipe(catchError((error) => this.handleError(error, 'Failed to load budget status.')));
  }

  registerExpense(budgetId: number, amount: number): Observable<any> {
    return this.http
      .post<any>(`${this.baseUrl}/${budgetId}/expense`, { amount })
      .pipe(catchError((error) => this.handleError(error, 'Failed to register budget expense.')));
  }

  getBudgetAlert(budgetId: number): Observable<boolean> {
    return this.http
      .get<boolean>(`${this.baseUrl}/${budgetId}/alert`)
      .pipe(catchError((error) => this.handleError(error, 'Failed to check budget alert status.')));
  }

  private handleError(error: unknown, fallbackMessage: string) {
    const message =
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof (error as { error?: { message?: string } }).error?.message === 'string'
        ? (error as { error: { message: string } }).error.message
        : fallbackMessage;

    return throwError(() => new Error(message));
  }
}
