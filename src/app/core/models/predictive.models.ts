export interface NormalizedApiError {
  statusCode: number;
  backendMessage: string | null;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export type JsonRecord = Record<string, unknown>;

export interface MlHealthResponse extends JsonRecord {}

export interface MlModelInfoResponse extends JsonRecord {}

export interface MlPredictRequest {
  features: number[][];
}

export interface MlPredictResponse extends JsonRecord {
  prediction?: number[];
}

export interface MachineListItem {
  id: number;
  name?: string;
  serialNumber?: string;
  model?: string;
  status?: string;
}

export interface MachineSensor {
  id: string | number;
  code: string;
  sensorType?: string;
  unit?: string;
  status?: string;
  lastReading?: number;
  lastReadingDate?: string;
}

export interface MachineSimulatedReading {
  machineId: number;
  machineName: string;
  timestamp: string;
  usageHours: number;
  anomalyCount: number;
  risk: number;
  predictedFailureDays: number;
  sensorValues: Record<string, number>;
}

export interface SensorDataPoint {
  id?: number | string;
  timestamp: string;
  machineId: number;
  sensorCode: string;
  sensorName: string;
  sensorType: string;
  value: number;
  unit: string;
  isAnomaly: boolean;
}

export interface SensorDataQuery {
  machineId?: number;
  page?: number;
  size?: number;
  sort?: string;
}

export interface FailureReportRequiredPart {
  partId: number;
  partName: string;
  quantityNeeded: number;
  currentStock: number;
  minimumStock: number;
}

export interface MachineFailureReport {
  id: number;
  machineId: number;
  machineName: string;
  currentSensorState: string;
  predictedFailureDays: number;
  risk: number;
  requiredParts: FailureReportRequiredPart[];
  recommendedAction: string;
  estimatedCost: number;
  createdAt: string;
}

export interface FailureReportsQuery {
  machineId?: number;
  page?: number;
  size?: number;
  sort?: string;
}

export interface PredictiveRunNowResponse extends JsonRecord {}

export interface MlFeaturesValidationResult {
  valid: boolean;
  normalizedFeatures: number[][];
  message: string | null;
}
