import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Prediction, MLModel } from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';

export interface PredictionsResponse {
  content: Prediction[];
  totalElements: number;
  totalPages: number;
  currentPage?: number;
  number?: number;
}

@Injectable({
  providedIn: 'root',
})
export class PredictionService {
  private predictionsSubject = new BehaviorSubject<Prediction[]>([]);
  private modelsSubject = new BehaviorSubject<MLModel[]>([]);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  predictions$ = this.predictionsSubject.asObservable();
  models$ = this.modelsSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Load recent predictions for a specific machine.
   */
  loadPredictions(page: number = 0, size: number = 10, machineId?: string): void {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    if (!machineId) {
      this.predictionsSubject.next([]);
      this.isLoadingSubject.next(false);
      this.errorSubject.next('A machineId is required to load predictions with the current backend contract.');
      return;
    }

    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    this.http
      .get<PredictionsResponse | Prediction[]>(
        apiEndpoint(`/machines/${machineId}/predictions`),
        { params }
      )
      .pipe(
        tap((response) => {
          const payload = Array.isArray(response) ? { content: response } : response;
          this.predictionsSubject.next(payload.content ?? []);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to load predictions';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Get predictions for a specific machine (paginated).
   */
  getMachinePredictions(
    machineId: string,
    page: number = 0,
    size: number = 10
  ): Observable<PredictionsResponse> {
    return this.http
      .get<PredictionsResponse | Prediction[]>(
        apiEndpoint(`/machines/${machineId}/predictions`),
        {
          params: new HttpParams()
            .set('page', page.toString())
            .set('size', size.toString()),
        }
      )
      .pipe(
        map((response) => {
          if (Array.isArray(response)) {
            return {
              content: response,
              totalElements: response.length,
              totalPages: response.length > 0 ? 1 : 0,
              number: page,
              currentPage: page,
            };
          }
          return {
            content: response.content ?? [],
            totalElements: response.totalElements ?? (response.content?.length ?? 0),
            totalPages:
              response.totalPages ??
              ((response.content?.length ?? 0) > 0 ? 1 : 0),
            number: response.number ?? page,
            currentPage: response.currentPage ?? response.number ?? page,
          };
        }),
        tap((response) => {
          this.predictionsSubject.next(response.content);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to load predictions';
          this.errorSubject.next(errorMessage);
          throw error;
        })
      );
  }

  /**
   * Trigger a new prediction for a machine.
   * NOTE: /machines/{id}/predictions/latest does not exist in the backend contract.
   * This now returns an empty observable so callers degrade gracefully.
   * Replace with a real POST endpoint when the backend adds one.
   */
  triggerPrediction(machineId: string): Observable<Prediction> {
    this.errorSubject.next(
      'Trigger prediction endpoint is not available in the current backend contract.'
    );
    this.isLoadingSubject.next(false);
    return of(null as unknown as Prediction);
  }

  /**
   * Trigger predictions for all machines (not yet available).
   */
  triggerAllPredictions(): Observable<Prediction[]> {
    return throwError(
      () => new Error('Run-all predictions endpoint is not available in the current backend contract.')
    );
  }

  /**
   * Load available ML models (not yet available).
   */
  loadModels(): void {
    this.modelsSubject.next([]);
  }

  /**
   * Upload or register a new ML model (not yet available).
   */
  uploadModel(modelData: FormData): Observable<MLModel> {
    return throwError(
      () => new Error('Model upload endpoint is not available in the current backend contract.')
    );
  }

  /**
   * Activate or deactivate a model (not yet available).
   */
  updateModelStatus(
    modelId: string,
    status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  ): Observable<MLModel> {
    return throwError(
      () => new Error('Model status endpoint is not available in the current backend contract.')
    );
  }

  activateModel(modelId: string): Observable<MLModel> {
    return this.updateModelStatus(modelId, 'ACTIVE');
  }

  deactivateModel(modelId: string): Observable<MLModel> {
    return this.updateModelStatus(modelId, 'INACTIVE');
  }
}