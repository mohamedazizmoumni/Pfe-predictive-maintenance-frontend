import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CostComparison } from '../models/cost-comparison.model';
import { apiEndpoint } from '../core/http/api-base';

interface CompareCostsPayload {
  machineId: number;
  actionId: number;
  estimatedFailureDowntimeHours: number;
}

@Injectable({
  providedIn: 'root',
})
export class CostService {
  private readonly baseUrl = apiEndpoint('/v1/costs');

  constructor(private http: HttpClient) {}

  compareCosts(
    machineId: number,
    actionId: number,
    estimatedFailureDowntimeHours: number
  ): Observable<CostComparison> {
    const payload: CompareCostsPayload = {
      machineId,
      actionId,
      estimatedFailureDowntimeHours,
    };

    return this.http
      .post<CostComparison>(`${this.baseUrl}/compare`, payload)
      .pipe(catchError((error) => this.handleError(error, 'Failed to compare maintenance costs.')));
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
