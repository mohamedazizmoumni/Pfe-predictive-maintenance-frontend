import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Recommendation } from '../models/recommendation.model';
import { apiEndpoint } from '../core/http/api-base';

interface GenerateRecommendationPayload {
  machineId: number;
  failureProbability: number;
  daysUntilPredictedFailure: number;
  requiredPartIds: number[];
}

@Injectable({
  providedIn: 'root',
})
export class RecommendationService {
  private readonly baseUrl = apiEndpoint('/v1/recommendations');

  constructor(private http: HttpClient) {}

  generateRecommendation(
    machineId: number,
    failureProbability: number,
    daysUntilPredictedFailure: number,
    requiredPartIds: number[]
  ): Observable<Recommendation> {
    const payload: GenerateRecommendationPayload = {
      machineId,
      failureProbability,
      daysUntilPredictedFailure,
      requiredPartIds,
    };

    return this.http
      .post<Recommendation>(`${this.baseUrl}/generate`, payload)
      .pipe(catchError((error) => this.handleError(error, 'Failed to generate recommendation.')));
  }

  getLatestRecommendation(machineId: number): Observable<Recommendation> {
    return this.http
      .get<Recommendation>(`${this.baseUrl}/machine/${machineId}`)
      .pipe(catchError((error) => this.handleError(error, 'Failed to load latest recommendation.')));
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
