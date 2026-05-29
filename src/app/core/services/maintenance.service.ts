import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { Maintenance, CreateMaintenanceRequest, CreateTaskRequest } from '../models/sentinel.models';
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

  private readonly STORAGE_KEY = 'maintenance_tasks_cache';
  private readonly PAGINATION_KEY = 'maintenance_pagination_cache';

  maintenance$ = this.maintenanceSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();
  currentMaintenance$ = this.currentMaintenanceSubject.asObservable();
  pagination$ = this.paginationSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadFromCache();
  }

  /**
   * Load tasks from localStorage cache on service initialization
   */
  private loadFromCache(): void {
    try {
      const cachedTasks = localStorage.getItem(this.STORAGE_KEY);
      const cachedPagination = localStorage.getItem(this.PAGINATION_KEY);

      if (cachedTasks) {
        const tasks = JSON.parse(cachedTasks);
        console.log('📦 Loaded tasks from cache:', tasks.length);
        this.maintenanceSubject.next(tasks);
      }

      if (cachedPagination) {
        const pagination = JSON.parse(cachedPagination);
        console.log('📄 Loaded pagination from cache');
        this.paginationSubject.next(pagination);
      }
    } catch (error) {
      console.error('❌ Error loading from cache:', error);
    }
  }

  /**
   * Save tasks to localStorage cache
   */
  private saveToCache(tasks: Maintenance[], pagination: MaintenancePagination): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasks));
      localStorage.setItem(this.PAGINATION_KEY, JSON.stringify(pagination));
      console.log('💾 Tasks saved to cache:', tasks.length);
    } catch (error) {
      console.error('❌ Error saving to cache:', error);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.PAGINATION_KEY);
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }

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
          const pagination = {
            totalElements: response.totalElements,
            totalPages: response.totalPages,
            currentPage: response.currentPage,
            pageSize: size,
          };
          
          this.maintenanceSubject.next(response.content);
          this.paginationSubject.next(pagination);
          
          // Save to cache
          this.saveToCache(response.content, pagination);
          
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
   * Create task using backend task contract and trigger assignment email flow
   */
  createTask(request: CreateTaskRequest): Observable<unknown> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post<unknown>(apiEndpoint('/api/v1/tasks'), request)
      .pipe(
        tap(() => {
          this.refreshCurrentQuery();
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || error.error?.error || 'Failed to create task';
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

    console.log('🔄 Updating maintenance status:', { id, status });

    // Send the status update with proper format
    const updatePayload = { status };

    return this.http
      .put<Maintenance>(apiEndpoint(`/v1/maintenance/${id}`), updatePayload)
      .pipe(
        tap((maintenance) => {
          console.log('✅ Maintenance status updated:', { id, status, maintenance });
          this.currentMaintenanceSubject.next(maintenance);
          this.refreshCurrentQuery();
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          console.error('❌ Error updating maintenance status:', { id, status, error });
          const errorMessage =
            error.error?.message || error.error?.error || 'Failed to update maintenance status';
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

  /**
   * Get ALL maintenance tasks (for debugging)
   */
  getAllMaintenanceTasks(page: number = 0, size: number = 100): Observable<MaintenanceResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    console.log('🔍 getAllMaintenanceTasks called');

    return this.http
      .get<MaintenanceResponse>(apiEndpoint('/v1/maintenance'), { params })
      .pipe(
        tap((response) => {
          console.log('✅ getAllMaintenanceTasks response:', response);
          console.log('📊 Tasks with assignedTechnicianId values:');
          response.content.forEach((task: any, idx: number) => {
            console.log(`  [${idx}] ID: ${task.id}, assignedTechnicianId: ${task.assignedTechnicianId}, status: ${task.status}`);
          });
        }),
        catchError((error) => {
          console.error('❌ getAllMaintenanceTasks error:', error);
          return of({
            content: [],
            totalElements: 0,
            totalPages: 0,
            currentPage: 0,
          } as MaintenanceResponse);
        })
      );
  }

  /**
   * Get maintenance tasks assigned to a specific technician
   * Supports both numeric ID and username as identifier
   */
  getTechnicianTasks(technicianId: string, page: number = 0, size: number = 100): Observable<MaintenanceResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('assignedTechnicianId', technicianId);

    console.log('🔍 getTechnicianTasks called with:', { technicianId, page, size });

    return this.http
      .get<MaintenanceResponse>(apiEndpoint('/v1/maintenance'), { params })
      .pipe(
        tap((response) => {
          console.log('✅ getTechnicianTasks response:', response);
          const pagination = {
            totalElements: response.totalElements,
            totalPages: response.totalPages,
            currentPage: response.currentPage,
            pageSize: size,
          };
          
          this.maintenanceSubject.next(response.content);
          this.paginationSubject.next(pagination);
          
          // Save to cache
          this.saveToCache(response.content, pagination);
        }),
        catchError((error) => {
          console.error('❌ getTechnicianTasks error:', error);
          const errorMessage =
            error.error?.message || 'Failed to load technician tasks';
          this.errorSubject.next(errorMessage);
          // Return empty response instead of null to maintain type safety
          return of({
            content: [],
            totalElements: 0,
            totalPages: 0,
            currentPage: 0,
          } as MaintenanceResponse);
        })
      );
  }
}
