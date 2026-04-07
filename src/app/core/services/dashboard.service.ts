import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import {
  DashboardOverview,
  MachineStatusSummary,
  PredictionHealth,
  MaintenancePipeline,
} from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private overviewSubject = new BehaviorSubject<DashboardOverview | null>(null);
  private machineStatusSubject = new BehaviorSubject<MachineStatusSummary | null>(null);
  private predictionHealthSubject = new BehaviorSubject<PredictionHealth | null>(null);
  private maintenancePipelineSubject = new BehaviorSubject<MaintenancePipeline | null>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  overview$ = this.overviewSubject.asObservable();
  machineStatus$ = this.machineStatusSubject.asObservable();
  predictionHealth$ = this.predictionHealthSubject.asObservable();
  maintenancePipeline$ = this.maintenancePipelineSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Load all dashboard data together
   */
  loadDashboard(): void {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    forkJoin({
      overview: this.http.get<DashboardOverview>(
        apiEndpoint('/v1/dashboard/overview')
      ),
      machineStatus: this.http.get<MachineStatusSummary>(
        apiEndpoint('/v1/dashboard/machines')
      ),
      predictionHealth: this.http.get<PredictionHealth>(
        apiEndpoint('/v1/dashboard/predictions')
      ),
      maintenancePipeline: this.http.get<MaintenancePipeline>(
        apiEndpoint('/v1/dashboard/maintenance')
      ),
    })
      .pipe(
        tap((result) => {
          this.overviewSubject.next(result.overview);
          this.machineStatusSubject.next(result.machineStatus);
          this.predictionHealthSubject.next(result.predictionHealth);
          this.maintenancePipelineSubject.next(result.maintenancePipeline);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to load dashboard';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Get overview KPIs
   */
  getOverview(): Observable<DashboardOverview> {
    return this.http
      .get<DashboardOverview>(apiEndpoint('/v1/dashboard/overview'))
      .pipe(
        tap((overview) => this.overviewSubject.next(overview)),
        catchError((error) => {
          throw error;
        })
      );
  }

  /**
   * Get machine status summary
   */
  getMachineStatus(): Observable<MachineStatusSummary> {
    return this.http
      .get<MachineStatusSummary>(apiEndpoint('/v1/dashboard/machines'))
      .pipe(
        tap((status) => this.machineStatusSubject.next(status)),
        catchError((error) => {
          throw error;
        })
      );
  }

  /**
   * Get prediction health metrics
   */
  getPredictionHealth(): Observable<PredictionHealth> {
    return this.http
      .get<PredictionHealth>(apiEndpoint('/v1/dashboard/predictions'))
      .pipe(
        tap((health) => this.predictionHealthSubject.next(health)),
        catchError((error) => {
          throw error;
        })
      );
  }

  /**
   * Get maintenance pipeline status
   */
  getMaintenancePipeline(): Observable<MaintenancePipeline> {
    return this.http
      .get<MaintenancePipeline>(apiEndpoint('/v1/dashboard/maintenance'))
      .pipe(
        tap((pipeline) => this.maintenancePipelineSubject.next(pipeline)),
        catchError((error) => {
          throw error;
        })
      );
  }
}
