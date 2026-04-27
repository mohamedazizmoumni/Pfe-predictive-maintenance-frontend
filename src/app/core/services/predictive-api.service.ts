import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { normalizeApiError } from '../http/api-error';
import {
  FailureReportsQuery,
  MachineFailureReport,
  MachineListItem,
  MachineSensor,
  MachineSimulatedReading,
  MlHealthResponse,
  MlModelInfoResponse,
  MlPredictRequest,
  MlPredictResponse,
  PredictiveRunNowResponse,
  PaginatedResponse,
  SensorDataPoint,
  SensorDataQuery,
} from '../models/predictive.models';
import { Machine } from '../models/sentinel.models';

@Injectable({
  providedIn: 'root',
})
export class PredictiveApiService {
  constructor(private readonly http: HttpClient) {}

  getMlHealth(): Observable<MlHealthResponse> {
    return this.http
      .get<MlHealthResponse>(apiEndpoint('/ml/health'))
      .pipe(catchError((error) => this.throwNormalized(error, 'Failed to fetch ML service health.')));
  }

  getMlModelInfo(): Observable<MlModelInfoResponse> {
    return this.http
      .get<MlModelInfoResponse>(apiEndpoint('/ml/model-info'))
      .pipe(catchError((error) => this.throwNormalized(error, 'Failed to fetch model info.')));
  }

  predict(body: MlPredictRequest): Observable<MlPredictResponse> {
    return this.http
      .post<MlPredictResponse>(apiEndpoint('/ml/predict'), body)
      .pipe(catchError((error) => this.throwNormalized(error, 'Prediction request failed.')));
  }

  getMachines(page = 0, size = 20): Observable<PaginatedResponse<MachineListItem>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size));

    return this.http
      .get<unknown>(apiEndpoint('/machines'), { params })
      .pipe(map((response) => this.toPageResponse<MachineListItem>(response)))
      .pipe(catchError((error) => this.throwNormalized(error, 'Failed to fetch machines.')));
  }

  getMachine(id: number | string): Observable<Machine> {
    return this.http
      .get<Machine>(apiEndpoint(`/machines/${id}`))
      .pipe(catchError((error) => this.throwNormalized(error, 'Failed to fetch machine details.')));
  }

  getMachineSensors(id: number | string): Observable<MachineSensor[]> {
    return this.http
      .get<Record<string, unknown>>(apiEndpoint(`/machines/${id}/telemetry/schema`))
      .pipe(
        map((schema) =>
          Object.keys(schema ?? {}).map((key, index) => ({
            id: `${id}-${key}-${index}`,
            code: key,
            sensorType: 'TELEMETRY',
            unit: '',
            status: 'ACTIVE',
          }))
        )
      )
      .pipe(catchError((error) => this.throwNormalized(error, 'Failed to fetch machine sensors.')));
  }

  getSimulatedReadings(): Observable<MachineSimulatedReading[]> {
    return this.getMachines(0, 200).pipe(
      switchMap((machinesPage) => {
        const machines = machinesPage.content ?? [];
        if (!machines.length) {
          return of([] as MachineSimulatedReading[]);
        }

        return forkJoin(
          machines.map((machine) =>
            this.http
              .get<any>(apiEndpoint(`/machines/${machine.id}/predictions/latest`))
              .pipe(
                map((prediction) => this.toSimulatedReading(machine, prediction)),
                catchError(() => of(this.toSimulatedReading(machine, null)))
              )
          )
        );
      }),
      catchError((error) => this.throwNormalized(error, 'Failed to fetch predictive readings.'))
    );
  }

  getSensorData(query: SensorDataQuery = {}): Observable<PaginatedResponse<SensorDataPoint>> {
    const { machineId } = query;
    if (machineId === undefined || machineId === null) {
      return of({
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: Number(query.page ?? 0),
        size: Number(query.size ?? 100),
      });
    }

    const params = new HttpParams()
      .set('page', String(query.page ?? 0))
      .set('size', String(query.size ?? 100));

    return this.http
      .get<PaginatedResponse<unknown> | unknown[]>(apiEndpoint(`/machines/${machineId}/predictions`), { params })
      .pipe(
        map((response) => {
          const page = this.toPageResponse(response);
          return this.mapPaginatedResponse(page, (item) => this.mapSensorDataPoint(item));
        }),
        catchError((error) => this.throwNormalized(error, 'Failed to fetch prediction history.'))
      );
  }

  getFailureReports(query: FailureReportsQuery = {}): Observable<PaginatedResponse<MachineFailureReport>> {
    const { machineId } = query;
    if (machineId === undefined || machineId === null) {
      return of({
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: Number(query.page ?? 0),
        size: Number(query.size ?? 20),
      });
    }

    return forkJoin({
      machine: this.getMachine(machineId).pipe(catchError(() => of(null))),
      latestPrediction: this.http
        .get<unknown>(apiEndpoint(`/machines/${machineId}/predictions/latest`))
        .pipe(catchError(() => of(null))),
      recommendation: this.http
        .get<unknown>(apiEndpoint(`/recommendations/machine/${machineId}`))
        .pipe(catchError(() => of(null))),
    }).pipe(
      map(({ machine, latestPrediction, recommendation }) => {
        const report = this.buildFailureReport(machineId, machine, latestPrediction, recommendation);
        const content = report ? [report] : [];
        return {
          content,
          totalElements: content.length,
          totalPages: content.length > 0 ? 1 : 0,
          number: Number(query.page ?? 0),
          size: Number(query.size ?? 20),
        };
      }),
      catchError((error) => this.throwNormalized(error, 'Failed to fetch failure reports.'))
    );
  }

  runPredictiveNow(): Observable<PredictiveRunNowResponse> {
    return this.throwNormalized(
      { status: 501, error: { message: 'Run-now endpoint is not available in the current backend contract.' } },
      'Run predictive now is not supported by this backend version.'
    );
  }

  downloadFailureReportsPdf(machineId?: number): Observable<Blob> {
    if (machineId === undefined || machineId === null) {
      return this.throwNormalized(
        { status: 400, error: { message: 'machineId is required to export reports with the current backend contract.' } },
        'Failed to export failure reports.'
      );
    }

    return this.getFailureReports({ machineId, page: 0, size: 100 }).pipe(
      map((response) => {
        const rows = [
          ['id', 'machineId', 'machineName', 'predictedFailureDays', 'risk', 'recommendedAction', 'estimatedCost', 'createdAt'],
          ...response.content.map((item) => [
            item.id,
            item.machineId,
            item.machineName,
            item.predictedFailureDays,
            item.risk,
            item.recommendedAction,
            item.estimatedCost,
            item.createdAt,
          ]),
        ];

        const csv = rows
          .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
          .join('\n');

        return new Blob([csv], { type: 'text/csv;charset=utf-8' });
      }),
      catchError((error) => this.throwNormalized(error, 'Failed to export failure reports.'))
    );
  }

  private throwNormalized(error: unknown, fallback: string): Observable<never> {
    return throwError(() => normalizeApiError(error, fallback));
  }

  private toPageResponse<T>(response: PaginatedResponse<T> | T[] | unknown): PaginatedResponse<T> {
    if (Array.isArray(response)) {
      const content = response as T[];
      return {
        content,
        totalElements: content.length,
        totalPages: content.length ? 1 : 0,
        number: 0,
        size: content.length,
      };
    }

    const candidate = (response ?? {}) as any;
    const content = Array.isArray(candidate.content) ? (candidate.content as T[]) : [];

    return {
      content,
      totalElements: Number(candidate.totalElements ?? content.length),
      totalPages: Number(candidate.totalPages ?? (content.length ? 1 : 0)),
      number: Number(candidate.number ?? 0),
      size: Number(candidate.size ?? content.length),
    };
  }

  private mapPaginatedResponse<T>(
    response: PaginatedResponse<unknown> | null | undefined,
    mapItem: (item: unknown) => T
  ): PaginatedResponse<T> {
    const content = Array.isArray(response?.content)
      ? response.content.map((item) => mapItem(item))
      : [];

    return {
      content,
      totalElements: Number(response?.totalElements ?? content.length),
      totalPages: Number(response?.totalPages ?? 0),
      number: Number(response?.number ?? 0),
      size: Number(response?.size ?? content.length),
    };
  }

  private mapFailureReport(item: unknown): MachineFailureReport {
    const raw = (item ?? {}) as any;
    const requiredPartsRaw = Array.isArray(raw.requiredParts) ? raw.requiredParts : [];

    return {
      id: Number(raw.id ?? 0),
      machineId: Number(raw.machineId ?? 0),
      machineName: String(raw.machineName ?? ''),
      currentSensorState: String(raw.currentSensorState ?? ''),
      predictedFailureDays: Number(raw.predictedFailureDays ?? 0),
      risk: Number(raw.risk ?? 0),
      requiredParts: requiredPartsRaw.map((part: unknown) => {
        const rawPart = (part ?? {}) as any;
        return {
          partId: Number(rawPart.partId ?? 0),
          partName: String(rawPart.partName ?? ''),
          quantityNeeded: Number(rawPart.quantityNeeded ?? 0),
          currentStock: Number(rawPart.currentStock ?? 0),
          minimumStock: Number(rawPart.minimumStock ?? 0),
        };
      }),
      recommendedAction: String(raw.recommendedAction ?? ''),
      estimatedCost: Number(raw.estimatedCost ?? 0),
      createdAt: String(raw.createdAt ?? ''),
    };
  }

  private mapSensorDataPoint(item: unknown): SensorDataPoint {
    const raw = (item ?? {}) as any;
    const nestedSensor =
      raw.sensor && typeof raw.sensor === 'object' && !Array.isArray(raw.sensor)
        ? (raw.sensor as any)
        : {};

    const machineIdRaw = raw.machineId ?? raw.machine_id;
    const valueRaw = raw.value ?? raw.readingValue ?? raw.lastReading ?? raw.sensorValue;
    const anomalyRaw = raw.isAnomaly ?? raw.anomaly;

    return {
      id: (raw.id as number | string | undefined) ?? undefined,
      timestamp: String(raw.timestamp ?? raw.createdAt ?? raw.readingTime ?? ''),
      machineId: Number(machineIdRaw ?? 0),
      sensorCode: String(raw.sensorCode ?? nestedSensor.code ?? raw.code ?? 'RUL'),
      sensorName: String(raw.sensorName ?? nestedSensor.name ?? raw.name ?? 'Remaining Useful Life'),
      sensorType: String(raw.sensorType ?? nestedSensor.sensorType ?? raw.type ?? 'PREDICTION'),
      value: Number(valueRaw ?? raw.rulValue ?? raw.predictionValue ?? 0),
      unit: String(raw.unit ?? nestedSensor.unit ?? ''),
      isAnomaly: Boolean(anomalyRaw ?? false),
    };
  }

  private toSimulatedReading(machine: MachineListItem, prediction: any): MachineSimulatedReading {
    const machineId = Number(machine.id ?? 0);
    const rulValue = Number(prediction?.rulValue ?? prediction?.predictionValue ?? 0);
    const riskRatio = this.toRiskRatio(prediction?.riskLevel, prediction?.riskScore, prediction?.failureProbability);

    return {
      machineId,
      machineName: String(machine.name ?? machine.serialNumber ?? `Machine ${machineId}`),
      timestamp: String(prediction?.predictedAt ?? prediction?.createdDate ?? new Date().toISOString()),
      usageHours: Number((machine as any)?.operatingHours ?? 0),
      anomalyCount: riskRatio >= 0.7 ? 1 : 0,
      risk: riskRatio,
      predictedFailureDays: rulValue,
      sensorValues: {},
    };
  }

  private buildFailureReport(
    machineId: number,
    machine: Machine | null,
    latestPrediction: unknown,
    recommendation: unknown
  ): MachineFailureReport | null {
    if (!latestPrediction && !recommendation) {
      return null;
    }

    const prediction = (latestPrediction ?? {}) as any;
    const reco = (recommendation ?? {}) as any;

    return {
      id: Number(prediction.id ?? Date.now()),
      machineId,
      machineName: String((machine as any)?.name ?? reco.machineName ?? `Machine ${machineId}`),
      currentSensorState: prediction.inputFeaturesSummary
        ? String(prediction.inputFeaturesSummary)
        : '{}',
      predictedFailureDays: Number(prediction.rulValue ?? reco.daysUntilFailure ?? 0),
      risk: this.toRiskRatio(prediction.riskLevel, (machine as any)?.riskScore, reco.failureProbability),
      requiredParts: [],
      recommendedAction: String(reco.recommendedAction ?? reco.justification ?? 'Monitor machine status.'),
      estimatedCost: Number(reco.estimatedCost ?? 0),
      createdAt: String(prediction.createdDate ?? new Date().toISOString()),
    };
  }

  private toRiskRatio(riskLevel?: unknown, riskScore?: unknown, failureProbability?: unknown): number {
    const normalizedRiskScore = Number(riskScore);
    if (Number.isFinite(normalizedRiskScore)) {
      if (normalizedRiskScore > 1) {
        return Math.min(1, Math.max(0, normalizedRiskScore / 100));
      }
      return Math.min(1, Math.max(0, normalizedRiskScore));
    }

    const normalizedFailureProbability = Number(failureProbability);
    if (Number.isFinite(normalizedFailureProbability)) {
      return Math.min(1, Math.max(0, normalizedFailureProbability));
    }

    const key = String(riskLevel ?? '').toUpperCase();
    if (key === 'CRITICAL') {
      return 0.95;
    }
    if (key === 'HIGH') {
      return 0.8;
    }
    if (key === 'MEDIUM') {
      return 0.55;
    }
    if (key === 'LOW') {
      return 0.25;
    }

    return 0;
  }
}