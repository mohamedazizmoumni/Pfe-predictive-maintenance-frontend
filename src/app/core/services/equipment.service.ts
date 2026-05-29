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

/** Static category → subcategory map used in the machine form. */
export const MACHINE_CATEGORIES: Record<string, string[]> = {
  MANUFACTURING: [
    'CNC_MACHINE',
    'INDUSTRIAL_ROBOT',
    'CONVEYOR_BELT',
    'PRESS_MACHINE',
    'LASER_CUTTER',
  ],
  ENERGY: [
    'TURBINE',
    'GENERATOR',
    'SOLAR_PANEL_SYSTEM',
  ],
  TRANSPORT: [
    'FORKLIFT',
    'CONVEYOR_SYSTEM',
    'AUTOMATED_GUIDED_VEHICLE',
  ],
  HVAC: [
    'AIR_COMPRESSOR',
    'CHILLER',
    'COOLING_TOWER',
  ],
  UTILITIES: [
    'PUMP',
    'BOILER',
    'WATER_TREATMENT',
  ],
};

@Injectable({
  providedIn: 'root',
})
export class EquipmentService {
  private readonly machinesUrl = apiEndpoint('/api/v1/machines');
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
  getMachine(id: number | string): Observable<Machine> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .get<Machine>(apiEndpoint(`/api/v1/machines/${id}`))
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
    * Uses /api/v1/machines per the updated backend contract.
   */
  createMachine(request: CreateMachineRequest, photo?: File | null): Observable<Machine> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    const body = photo ? this.buildMachineFormData(request, photo) : request;

    return this.http
      .post<Machine>(this.machinesUrl, body)
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
    * Uses /api/v1/machines/{id} per the updated backend contract.
   */
  updateMachine(id: number, request: Partial<CreateMachineRequest>): Observable<Machine> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .put<Machine>(apiEndpoint(`/api/v1/machines/${id}`), request)
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
    * Uses /api/v1/machines/{id} per the updated backend contract.
   */
  deleteMachine(id: number): Observable<void> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .delete<void>(apiEndpoint(`/api/v1/machines/${id}`))
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
   * Returns subcategories for a given category name.
   * Falls back to the static map if the backend does not expose a dedicated endpoint.
   */
  getSubCategories(categoryName: string): Observable<string[]> {
    const upper = categoryName?.toUpperCase() ?? '';
    const local = MACHINE_CATEGORIES[upper] ?? [];
    return of(local);
  }

  /**
   * Get real-time machine status.
   * The /predictions/latest endpoint does not exist in the current backend contract.
   * Returns an empty observable so callers degrade gracefully.
   */
  getMachineStatus(machineId: string): Observable<any> {
    return of(null);
  }

  private buildMachineFormData(request: CreateMachineRequest, photo: File): FormData {
    const formData = new FormData();
    Object.entries(request).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      formData.append(key, String(value));
    });
    formData.append('photo', photo);
    return formData;
  }
}