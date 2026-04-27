import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Machine, Sensor, CreateMachineRequest } from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';

export interface MachinesResponse {
  content: Machine[];
  totalElements: number;
  totalPages: number;
  currentPage?: number;
  number?: number;
}

@Injectable({
  providedIn: 'root',
})
export class EquipmentService {
  private readonly machinesUrl = apiEndpoint('/machines');
  private machinesSubject = new BehaviorSubject<Machine[]>([]);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private currentMachineSubject = new BehaviorSubject<Machine | null>(null);

  machines$ = this.machinesSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();
  currentMachine$ = this.currentMachineSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Load all machines with optional pagination and filtering
   */
  loadMachines(page: number = 0, size: number = 10, status?: string): void {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (status) {
      params = params.set('status', status);
    }

    this.http
      .get<MachinesResponse | Machine[]>(this.machinesUrl, { params })
      .pipe(
        tap((response) => {
          const machines = Array.isArray(response) ? response : response.content ?? [];
          this.machinesSubject.next(machines);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to load machines';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Get a specific machine by ID
   */
  getMachine(id: string): Observable<Machine> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .get<Machine>(apiEndpoint(`/machines/${id}`))
      .pipe(
        tap((machine) => {
          this.currentMachineSubject.next(machine);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to load machine';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Create a new machine
   * Uses /api/v1/costs/machines per the updated backend contract.
   */
  createMachine(request: CreateMachineRequest): Observable<Machine> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post<Machine>(apiEndpoint('/costs/machines'), request)
      .pipe(
        tap((machine) => {
          const machines = this.machinesSubject.value;
          this.machinesSubject.next([...machines, machine]);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to create machine';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Update an existing machine
   * Uses /api/v1/costs/machines/{id} per the updated backend contract.
   */
  updateMachine(id: string, request: Partial<CreateMachineRequest>): Observable<Machine> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .put<Machine>(apiEndpoint(`/costs/machines/${id}`), request)
      .pipe(
        tap((machine) => {
          const machines = this.machinesSubject.value.map((m) =>
            m.id === id ? machine : m
          );
          this.machinesSubject.next(machines);
          this.currentMachineSubject.next(machine);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to update machine';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Delete a machine
   * Uses /api/v1/costs/machines/{id} per the updated backend contract.
   */
  deleteMachine(id: string): Observable<void> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .delete<void>(apiEndpoint(`/costs/machines/${id}`))
      .pipe(
        tap(() => {
          const machines = this.machinesSubject.value.filter((m) => m.id !== id);
          this.machinesSubject.next(machines);
          if (this.currentMachineSubject.value?.id === id) {
            this.currentMachineSubject.next(null);
          }
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to delete machine';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Get sensors for a specific machine
   */
  getSensors(machineId: string): Observable<Sensor[]> {
    return this.http
      .get<Record<string, unknown>>(apiEndpoint(`/machines/${machineId}/telemetry/schema`))
      .pipe(
        map((schema) => {
          const keys = Object.keys(schema ?? {});
          return keys.map((key, index) => ({
            id: `${machineId}-${key}-${index}`,
            code: key,
            machineId,
            sensorType: 'TELEMETRY',
            unit: '',
            status: 'ACTIVE' as const,
          }));
        }),
        tap(() => {
          this.errorSubject.next(null);
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to load sensors';
          this.errorSubject.next(errorMessage);
          throw error;
        })
      );
  }

  /**
   * Add a sensor to a machine
   */
  addSensor(machineId: string, sensor: Omit<Sensor, 'id'>): Observable<Sensor> {
    return this.http
      .post<Sensor>(apiEndpoint(`/machines/${machineId}/sensors`), sensor)
      .pipe(
        catchError((error) => {
          this.errorSubject.next(error.error?.message || 'Failed to add sensor');
          throw error;
        })
      );
  }

  /**
   * Update a sensor
   */
  updateSensor(machineId: string, sensorId: string, sensor: Partial<Sensor>): Observable<Sensor> {
    return this.http
      .put<Sensor>(apiEndpoint(`/machines/${machineId}/sensors/${sensorId}`), sensor)
      .pipe(
        catchError((error) => {
          this.errorSubject.next(error.error?.message || 'Failed to update sensor');
          throw error;
        })
      );
  }

  /**
   * Get real-time machine status.
   * The /predictions/latest endpoint does not exist in the current backend contract.
   * Returns an empty observable so callers degrade gracefully.
   */
  getMachineStatus(machineId: string): Observable<any> {
    return of(null);
  }
}