import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { Maintenance, CreateMaintenanceRequest } from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';

export interface MaintenanceResponse {
  content: Maintenance[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
}

export interface MaintenancePagination {
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root',
})
export class MaintenanceService {
  private maintenanceSubject = new BehaviorSubject<Maintenance[]>([]);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private currentMaintenanceSubject = new BehaviorSubject<Maintenance | null>(null);
  private paginationSubject = new BehaviorSubject<MaintenancePagination>({
    totalElements: 0,
    totalPages: 0,
    currentPage: 0,
    pageSize: 10,
  });

  private lastQuery: {
    page: number;
    size: number;
    status?: string;
    priority?: string;
  } = { page: 0, size: 10 };

  maintenance$ = this.maintenanceSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();
  currentMaintenance$ = this.currentMaintenanceSubject.asObservable();
  pagination$ = this.paginationSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadMaintenanceTasks(
    page: number = 0,
    size: number = 10,
    status?: string,
    priority?: string
  ): void {
    this.lastQuery = { page, size, status, priority };
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (status) {
      params = params.set('status', status);
    }
    if (priority) {
      params = params.set('priority', priority);
    }

    this.http
      .get<MaintenanceResponse>(apiEndpoint('/v1/maintenance'), { params })
      .pipe(
        tap((response) => {
          this.maintenanceSubject.next(response.content);
          this.paginationSubject.next({
            totalElements: response.totalElements,
            totalPages: response.totalPages,
            currentPage: response.currentPage,
            pageSize: size,
          });
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to load maintenance tasks';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          return of(null);
        })
      )
      .subscribe();
  }

  refreshCurrentQuery(): void {
    const { page, size, status, priority } = this.lastQuery;
    this.loadMaintenanceTasks(page, size, status, priority);
  }

  /**
   * Get maintenance details by ID
   */
  getMaintenance(id: string): Observable<Maintenance> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .get<Maintenance>(apiEndpoint(`/v1/maintenance/${id}`))
      .pipe(
        tap((maintenance) => {
          this.currentMaintenanceSubject.next(maintenance);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to load maintenance';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Schedule a new maintenance task
   */
  scheduleMaintenance(request: CreateMaintenanceRequest): Observable<Maintenance> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post<Maintenance>(apiEndpoint('/v1/maintenance'), request)
      .pipe(
        tap((maintenance) => {
          this.currentMaintenanceSubject.next(maintenance);
          this.refreshCurrentQuery();
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to schedule maintenance';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Update maintenance status
   */
  updateMaintenanceStatus(
    id: string,
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'CANCELLED'
  ): Observable<Maintenance> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .put<Maintenance>(apiEndpoint(`/v1/maintenance/${id}`), { status })
      .pipe(
        tap((maintenance) => {
          this.currentMaintenanceSubject.next(maintenance);
          this.refreshCurrentQuery();
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to update maintenance status';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Update maintenance details
   */
  updateMaintenance(
    id: string,
    updates: Partial<CreateMaintenanceRequest>
  ): Observable<Maintenance> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .put<Maintenance>(apiEndpoint(`/v1/maintenance/${id}`), updates)
      .pipe(
        tap((maintenance) => {
          this.currentMaintenanceSubject.next(maintenance);
          this.refreshCurrentQuery();
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to update maintenance';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Cancel maintenance
   */
  cancelMaintenance(id: string): Observable<Maintenance> {
    return this.updateMaintenanceStatus(id, 'CANCELLED');
  }

  /**
   * Start maintenance
   */
  startMaintenance(id: string): Observable<Maintenance> {
    return this.updateMaintenanceStatus(id, 'IN_PROGRESS');
  }

  /**
   * Complete maintenance
   */
  completeMaintenance(id: string): Observable<Maintenance> {
    return this.updateMaintenanceStatus(id, 'COMPLETED');
  }

  /**
   * Approve maintenance
   */
  approveMaintenance(id: string): Observable<Maintenance> {
    return this.updateMaintenanceStatus(id, 'APPROVED');
  }

  /**
   * Delete maintenance task
   */
  deleteMaintenance(id: string): Observable<void> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .delete<void>(apiEndpoint(`/v1/maintenance/${id}`))
      .pipe(
        tap(() => {
          if (this.currentMaintenanceSubject.value?.id === id) {
            this.currentMaintenanceSubject.next(null);
          }
          this.refreshCurrentQuery();
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to delete maintenance';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Get maintenance tasks for a specific machine
   */
  getMachineMaintenanceTasks(machineId: string, page: number = 0, size: number = 10): Observable<MaintenanceResponse> {
    return this.http.get<MaintenanceResponse>(
      apiEndpoint(`/v1/machines/${machineId}/maintenance`),
      {
        params: new HttpParams()
          .set('page', page.toString())
          .set('size', size.toString()),
      }
    );
  }

  /**
   * Assign technician to maintenance
   */
  assignTechnician(maintenanceId: string, technicianId: string): Observable<Maintenance> {
    return this.http
      .post<Maintenance>(
        apiEndpoint(`/v1/maintenance/${maintenanceId}/assign`),
        { technicianId }
      )
      .pipe(
        tap((maintenance) => {
          this.currentMaintenanceSubject.next(maintenance);
          this.refreshCurrentQuery();
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to assign technician';
          this.errorSubject.next(errorMessage);
          throw error;
        })
      );
  }
}
