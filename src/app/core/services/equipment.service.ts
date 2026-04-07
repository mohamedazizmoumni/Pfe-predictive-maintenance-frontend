import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { Machine, Sensor, CreateMachineRequest } from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';

export interface MachinesResponse {
  content: Machine[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
}

@Injectable({
  providedIn: 'root',
})
export class EquipmentService {
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
      .get<MachinesResponse>(apiEndpoint('/v1/machines'), { params })
      .pipe(
        tap((response) => {
          this.machinesSubject.next(response.content);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to load machines';
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
      .get<Machine>(apiEndpoint(`/v1/machines/${id}`))
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
   */
  createMachine(request: CreateMachineRequest): Observable<Machine> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post<Machine>(apiEndpoint('/v1/machines'), request)
      .pipe(
        tap((machine) => {
          const machines = this.machinesSubject.value;
          this.machinesSubject.next([...machines, machine]);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage =
            error.error?.message || 'Failed to create machine';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Update an existing machine
   */
  updateMachine(id: string, request: Partial<CreateMachineRequest>): Observable<Machine> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .put<Machine>(apiEndpoint(`/v1/machines/${id}`), request)
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
          const errorMessage =
            error.error?.message || 'Failed to update machine';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Delete a machine
   */
  deleteMachine(id: string): Observable<void> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .delete<void>(apiEndpoint(`/v1/machines/${id}`))
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
          const errorMessage =
            error.error?.message || 'Failed to delete machine';
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
      .get<Sensor[]>(apiEndpoint(`/v1/machines/${machineId}/sensors`))
      .pipe(
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
      .post<Sensor>(apiEndpoint(`/v1/machines/${machineId}/sensors`), sensor)
      .pipe(
        tap(() => {
          // Refresh current machine to update sensors list
          this.getMachine(machineId).subscribe();
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to add sensor';
          this.errorSubject.next(errorMessage);
          throw error;
        })
      );
  }

  /**
   * Update a sensor
   */
  updateSensor(machineId: string, sensorId: string, sensor: Partial<Sensor>): Observable<Sensor> {
    return this.http
      .put<Sensor>(
        apiEndpoint(`/v1/machines/${machineId}/sensors/${sensorId}`),
        sensor
      )
      .pipe(
        tap(() => {
          this.getMachine(machineId).subscribe();
        }),
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to update sensor';
          this.errorSubject.next(errorMessage);
          throw error;
        })
      );
  }

  /**
   * Get real-time machine status
   */
  getMachineStatus(machineId: string): Observable<any> {
    return this.http.get<any>(
      apiEndpoint(`/v1/machines/${machineId}/status`)
    );
  }
}
