import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Machine, Sensor, CreateMachineRequest, MachineTechnicianDTO } from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';
import { EnvironmentReading } from './machine-websocket.service';

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
      .set('size', size.toString())
      // Cache-bust: machine visibility depends on which user is logged in, so a
      // URL-keyed browser/proxy cache must never serve a response captured under
      // a different account (e.g. a manager's full list bleeding into a
      // technician's assigned-only view after switching accounts in one tab).
      .set('_', Date.now().toString());

    if (status) {
      params = params.set('status', status);
    }

    this.http
      .get<MachinesResponse | Machine[]>(this.machinesUrl, { params, headers: this.noCacheHeaders() })
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
          // Never leave a stale/previous machine list visible after a failed reload —
          // that could show machines from a different session/role that the current
          // user no longer (or never did) have access to.
          this.machinesSubject.next([]);
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

    const params = new HttpParams().set('_', Date.now().toString());

    return this.http
      .get<Machine>(apiEndpoint(`/api/v1/machines/${id}`), { params, headers: this.noCacheHeaders() })
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
   * Get the latest real environmental reading (ESP32/DHT11) for a machine,
   * to populate the detail page before the first WebSocket message arrives.
   * Returns null if no reading has been ingested yet for this machine.
   */
  getLatestEnvironment(machineId: string | number): Observable<EnvironmentReading | null> {
    return this.http
      .get<EnvironmentReading>(apiEndpoint(`/machines/${machineId}/environment/latest`))
      .pipe(catchError(() => of(null)));
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
   * List technicians assigned to a machine (MANAGER/ADMIN/SUPER_ADMIN only).
   */
  getMachineTechnicians(machineId: number | string): Observable<MachineTechnicianDTO[]> {
    return this.http
      .get<MachineTechnicianDTO[]>(apiEndpoint(`/machines/${machineId}/technicians`))
      .pipe(
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to load assigned technicians';
          this.errorSubject.next(errorMessage);
          throw error;
        })
      );
  }

  /**
   * Assign a technician to a machine (MANAGER/ADMIN/SUPER_ADMIN only).
   */
  assignTechnician(machineId: number | string, technicianId: number): Observable<MachineTechnicianDTO> {
    return this.http
      .post<MachineTechnicianDTO>(apiEndpoint(`/machines/${machineId}/technicians`), { technicianId })
      .pipe(
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to assign technician';
          this.errorSubject.next(errorMessage);
          throw error;
        })
      );
  }

  /**
   * Unassign a technician from a machine (MANAGER/ADMIN/SUPER_ADMIN only).
   */
  unassignTechnician(machineId: number | string, technicianId: number): Observable<void> {
    return this.http
      .delete<void>(apiEndpoint(`/machines/${machineId}/technicians/${technicianId}`))
      .pipe(
        catchError((error) => {
          const errorMessage = error.error?.message || 'Failed to unassign technician';
          this.errorSubject.next(errorMessage);
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

  /** Forces every machine request to bypass any browser/proxy HTTP cache. */
  private noCacheHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    });
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