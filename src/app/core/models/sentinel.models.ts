// src/app/core/models/sentinel.models.ts

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  department?: string;
  phoneNumber?: string;
  status?: string;
  mfaEnabled?: boolean;
  roles: Role[];
  lastLoginDate?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  id?: number;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  roles?: string[];
  user?: User;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  department?: string;
}

export interface Machine {
  id: string;
  serialNumber: string;
  model: string;
  manufacturer: string;
  location: string;
  installationYear?: number;
  status: 'OPERATIONAL' | 'MAINTENANCE' | 'OFFLINE' | 'DECOMMISSIONED';
  name?: string;
  description?: string;
  operatingHours?: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  riskScore?: number;
  sensors?: Sensor[];
  createdDate?: string;
  lastModifiedDate?: string;
}

export interface CreateMachineRequest {
  serialNumber: string;
  model: string;
  manufacturer: string;
  location: string;
  installationYear?: number;
  status?: 'OPERATIONAL' | 'MAINTENANCE' | 'OFFLINE' | 'DECOMMISSIONED';
  name?: string;
  description?: string;
  operatingHours?: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  riskScore?: number;
}

export interface Sensor {
  id: string;
  code: string;
  machineId: string;
  sensorType: string;
  unit: string;
  lastReading?: number;
  lastReadingDate?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'FAULTY';
}

export interface SensorReading {
  id: string;
  sensorId: string;
  value: number;
  timestamp: string;
  isAnomaly?: boolean;
}

export interface CreateMaintenanceRequest {
  machineId: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  scheduledDate: string;
  estimatedDuration: number;
  assignedTechnicianId?: string;
  notes?: string;
}

export interface Maintenance extends CreateMaintenanceRequest {
  id: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'CANCELLED';
  startDate?: string;
  completedDate?: string;
  approvedDate?: string;
  approvedBy?: string;
  createdDate?: string;
  lastModifiedDate?: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  NEW = 'NEW',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  ESCALATED = 'ESCALATED',
  CLOSED = 'CLOSED',
}

export enum AlertCategory {
  SENSOR_ANOMALY = 'SENSOR_ANOMALY',
  PREDICTION = 'PREDICTION',
  MAINTENANCE_DUE = 'MAINTENANCE_DUE',
  MANUAL = 'MANUAL',
  THRESHOLD_BREACH = 'THRESHOLD_BREACH',
}

export interface AlertResponse {
  id: number;
  machineId: number;
  machineSerial?: string;
  machineModel?: string;
  machineLocation?: string;
  title: string;
  message?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  category?: AlertCategory;
  viewed: boolean;
  assignedTo?: string;
  assignedToDisplayName?: string;
  createdBy?: string;
  createdByDisplayName?: string;
  recommendations?: string;
  sourceReference?: string;
  acknowledgedDate?: string;
  acknowledgedBy?: string;
  escalatedDate?: string;
  escalatedBy?: string;
  escalationNotes?: string;
  closedDate?: string;
  closedBy?: string;
  resolutionNotes?: string;
  createdDate: string;
  lastUpdatedDate?: string;
}

export type Alert = AlertResponse;

export interface AlertStatsResponse {
  totalAlerts: number;
  newAlerts: number;
  acknowledgedAlerts: number;
  escalatedAlerts: number;
  closedAlerts: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  unviewedCount: number;
}

export interface CreateAlertPayload {
  machineId: number;
  title: string;
  message?: string;
  severity: AlertSeverity;
  category?: AlertCategory;
  sourceReference?: string;
  assignedTo?: string;
  recommendations?: string;
}

export interface AcknowledgeAlertPayload {
  acknowledgedDate?: string;
}

export interface EscalateAlertPayload {
  escalationNotes?: string;
  reassignTo?: string;
}

export interface CloseAlertPayload {
  resolutionNotes: string;
}

export interface AlertQueryParams {
  page?: number;
  size?: number;
  sort?: string;
  status?: AlertStatus | AlertStatus[];
  severity?: AlertSeverity | AlertSeverity[];
  assignedTo?: string;
  machineId?: number;
  category?: AlertCategory | AlertCategory[];
  viewed?: boolean;
  search?: string;
}

export interface Prediction {
  id: string | number;
  machineId: string | number;
  predictedAt?: string;
  rulValue?: number;
  confidenceLow?: number;
  confidenceHigh?: number;
  predictedFailureDate?: string;
  failureProbability: number;
  confidenceScore: number;
  recommendedActions: string;
  modelVersion: string;
  createdDate: string;
  riskLevel?: string;
  predictionDate?: string;
  predictionValue?: number;
}

export interface MLModel {
  id: string | number;
  name: string;
  version?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | string;
  metrics?: Record<string, unknown>;
}

export interface DashboardOverview {
  totalMachines: number;
  operationalMachines: number;
  maintenanceScheduled: number;
  criticalAlerts: number;
  averageHealthScore: number;
  predictedFailures: number;
  totalMachinesCount?: number;
  operationalMachinesCount?: number;
  totalSensorsCount?: number;
  uptimePercentage?: number;
  maintenanceDueCount?: number;
  openAlertsCount?: number;
}

export interface MachineStatusSummary {
  operational: number;
  maintenance: number;
  offline: number;
  decommissioned: number;
  faulty?: number;
  inactive?: number;
}

export interface ChatbotRequest {
	question: string;
}

export interface ChatbotResponse {
	answer: string;
	authorized: boolean;
	userRoles: string[];
}

export interface PredictionHealth {
  id: string;
  machineId: string;
  healthScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lastUpdate: string;
  avgConfidenceScore?: number;
  recentPredictions?: Prediction[];
  machinesAtRisk?: number;
}

export interface MaintenancePipeline {
  scheduled: number;
  inProgress: number;
  completed: number;
  approved: number;
  cancelled: number;
}

export interface InventoryItem {
  id: string;
  partNumber: string;
  partName: string;
  category: string;
  quantity: number;
  minThreshold: number;
  location: string;
  unitCost: number;
  supplier: string;
  lastRestockDate: string;
}
export interface Sensor {
  id: string;
  code: string;
  machineId: string;
  sensorType: string;
  unit: string;
  lastReading?: number;
  lastReadingDate?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'FAULTY';
  minThreshold?: number;  // ✅ Add this
  maxThreshold?: number;  // ✅ Add this
}
export interface Part {
  id: number;
  name: string;
  description: string;
  partNumber: string;
  category: string;
  cost: number;
  currentStock: number;
  minimumStock: number;
  reorderQuantity: number;
  unit: string;
  supplier: string;
  status: 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  notes: string;
  createdDate: string;
  lastModifiedDate: string;
}

export interface PartRequest {
  name: string;
  description: string;
  partNumber: string;
  category: string;
  cost: number;
  minimumStock: number;
  reorderQuantity: number;
  unit: string;
  supplier: string;
  notes: string;
}

export interface PartUpdateRequest {
  name?: string;
  description?: string;
  cost?: number;
  minimumStock?: number;
  reorderQuantity?: number;
  supplier?: string;
}

export interface InventoryUsage {
  id: number;
  partId: number;
  partName: string;
  quantityUsed: number;
  taskId: number;
  reason: string;
  usedBy: string;
  usedDate: string;
  notes: string;
}

export interface InventoryUsageRequest {
  partId: number;
  quantityUsed: number;
  taskId: number;
  reason: string;
  notes: string;
}

export interface ReorderRequest {
  id: number;
  partId: number;
  partName: string;
  quantity: number;
  approximateCost: number;
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'ORDERED';
  requestedBy: string;
  requestedDate: string;
  approvedBy: string;
  approvedDate: string;
  notes: string;
}

export interface ReorderRequestRequest {
  partId: number;
  quantity: number;
  reason: string;
  notes: string;
}

export interface ReorderApprovalRequest {
  approved: boolean;
  reason: string;
}

export interface StockOrder {
  id: number;
  reorderRequestId: number;
  partId: number;
  partName: string;
  quantity: number;
  cost: number;
  status: 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  supplierPurchaseOrder: string;
  orderedDate: string;
  expectedDeliveryDate: string;
  deliveredDate: string;
  orderedBy: string;
  notes: string;
}

export interface StockOrderRequest {
  reorderRequestId: number;
  supplierPurchaseOrder: string;
  expectedDeliveryDate: string;
  notes: string;
}

export interface StockOrderReceiptRequest {
  quantityReceived: number;
  proofOfDelivery: string;
  notes: string;
}

export interface InventoryStats {
  totalPartsTracked: number;
  lowStockPartsCount: number;
  outOfStockPartsCount: number;
  pendingOrdersCount: number;
  totalInventoryValue: number;
  turnoverRate: number;
  lastUpdated: string;
}

export interface LowStockAlert {
  partId: number;
  partName: string;
  currentStock: number;
  minimumStock: number;
  reorderQuantity: number;
  status: string;
}

export interface ReorderSummary {
  id: number;
  partName: string;
  quantity: number;
  estimatedCost: number;
  status: string;
  requestedDate: string;
}