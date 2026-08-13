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

// Matches the real backend PredictionRecordDetailDTO
// (com.pfe.predictive.ml.dto.PredictionRecordDetailDTO) - note this has no
// failureProbability field, only rulValue (hours) and a bucketed riskLevel.
export interface LatestPredictionRecord {
  id: number;
  machineId: number;
  predictedAt: string;
  rulValue: number;
  confidenceLow?: number;
  confidenceHigh?: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  modelVersion: string;
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
   * Get the most recent persisted prediction record for a machine, or null
   * if none exists yet (e.g. telemetry replay hasn't produced one for this
   * machine). Backs onto the real GET /machines/{id}/predictions/latest
   * endpoint (PredictionRecordsController) — contrary to the removed note
   * that used to sit on triggerPrediction() below, this endpoint does exist.
   */
  getLatestPrediction(machineId: number): Observable<LatestPredictionRecord | null> {
    return this.http
      .get<LatestPredictionRecord | null>(apiEndpoint(`/machines/${machineId}/predictions/latest`))
      .pipe(catchError(() => of(null)));
  }

  /**
   * Trigger a new prediction for a machine.
   * NOTE: there is no POST endpoint to force a fresh prediction on demand -
   * predictions are produced by the telemetry replay pipeline, not
   * synchronously per-request. This stays a no-op until that exists.
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