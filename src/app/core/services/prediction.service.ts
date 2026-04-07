import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { Prediction, MLModel } from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';

export interface PredictionsResponse {
  content: Prediction[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
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
   * Load recent predictions
   */
  loadPredictions(page: number = 0, size: number = 10): void {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    this.http
      .get<PredictionsResponse>(apiEndpoint('/v1/predictions'), { params })
      .pipe(
        tap((response) => {
          this.predictionsSubject.next(response.content);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to load predictions';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Get predictions for a specific machine
   */
  getMachinePredictions(machineId: string, page: number = 0, size: number = 10): Observable<PredictionsResponse> {
    return this.http.get<PredictionsResponse>(
      apiEndpoint(`/v1/machines/${machineId}/predictions`),
      {
        params: new HttpParams()
          .set('page', page.toString())
          .set('size', size.toString()),
      }
    );
  }

  /**
   * Trigger a new prediction for a machine
   */
  triggerPrediction(machineId: string): Observable<Prediction> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post<Prediction>(apiEndpoint('/v1/predictions/run'), { machineId })
      .pipe(
        tap((prediction) => {
          const predictions = this.predictionsSubject.value;
          this.predictionsSubject.next([prediction, ...predictions]);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to trigger prediction';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Trigger predictions for all machines
   */
  triggerAllPredictions(): Observable<Prediction[]> {
    return this.http
      .post<Prediction[]>(apiEndpoint('/v1/predictions/run-all'), {})
      .pipe(
        tap((predictions) => {
          this.predictionsSubject.next(predictions);
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to trigger predictions';
          this.errorSubject.next(errorMessage);
          throw error;
        })
      );
  }

  /**
   * Load available ML models
   */
  loadModels(): void {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    this.http
      .get<MLModel[]>(apiEndpoint('/v1/ml-models'))
      .pipe(
        tap((models) => {
          this.modelsSubject.next(models);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to load ML models';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Upload or register a new ML model
   */
  uploadModel(modelData: FormData): Observable<MLModel> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post<MLModel>(apiEndpoint('/v1/ml-models'), modelData)
      .pipe(
        tap((model) => {
          const models = this.modelsSubject.value;
          this.modelsSubject.next([...models, model]);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to upload model';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Activate or deactivate a model
   */
  updateModelStatus(modelId: string, status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'): Observable<MLModel> {
    return this.http
      .put<MLModel>(
        apiEndpoint(`/v1/ml-models/${modelId}/status`),
        { status }
      )
      .pipe(
        tap((model) => {
          const models = this.modelsSubject.value.map((m) =>
            m.id === modelId ? model : m
          );
          this.modelsSubject.next(models);
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to update model status';
          this.errorSubject.next(errorMessage);
          throw error;
        })
      );
  }

  /**
   * Activate a model
   */
  activateModel(modelId: string): Observable<MLModel> {
    return this.updateModelStatus(modelId, 'ACTIVE');
  }

  /**
   * Deactivate a model
   */
  deactivateModel(modelId: string): Observable<MLModel> {
    return this.updateModelStatus(modelId, 'INACTIVE');
  }
}
