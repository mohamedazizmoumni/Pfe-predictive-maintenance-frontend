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
  locked?: boolean;
  mfaEnabled?: boolean;
  roles: Role[];
  lastLoginDate?: string;
  profilePictureUrl?: string;
  faceEnrolled?: boolean;
  faceEnrolledAt?: string;
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
  /** Whether the user has a face registered — drives post-login flow */
  hasFace?: boolean;
  /** Face-match similarity score (0-1), only present on /auth/face-login responses */
  confidence?: number;
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
  id: number;
  serialNumber: string;
  name: string;
  description?: string;
  model: string;
  manufacturer?: string;
  location: string;
  category?: string;
  subCategory?: string;
  status?: string;
  photoUrl?: string;
  installationDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  operatingHours?: number;
  riskScore?: number;
  createdDate?: string;
}

export interface MachineTechnicianDTO {
  id: number;
  machineId: number;
  technicianId: number;
  technicianUsername: string;
  technicianDisplayName: string;
  assignedById: number;
  assignedByUsername: string;
  assignedAt: string;
}

export interface CreateMachineRequest {
  serialNumber: string;
  name: string;
  description?: string;
  model: string;
  manufacturer?: string;
  location: string;
  category?: string;
  subCategory?: string;
  installationYear?: number;
  status?: string;
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
  machineId: number;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  scheduledDate: string;
  estimatedDuration: number;
  assignedTechnicianId?: number;
  notes?: string;
  rootCause?: string;
}

export interface CreateTaskRequest {
  machineId: number;
  type?: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  scheduledDate: string;
  estimatedDuration?: number;
  assignedTechnicianId: number;
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
  /** System-triggered when a machine recovers from an active incident. */
  RESOLVED = 'RESOLVED',
  /** Reserved by the backend — not set by anything yet. */
  IN_PROGRESS = 'IN_PROGRESS',
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
  /**
   * When the backend auto-resolved this incident (machine recovered).
   * Not part of the REST DTO — only ever populated client-side from a
   * live "RESOLVED" /topic/alerts websocket event, when one is received.
   */
  resolvedDate?: string;
  createdDate: string;
  lastUpdatedDate?: string;
}

export type Alert = AlertResponse;

/**
 * Live incident event received on the /topic/alerts websocket topic.
 * One consistent shape for every event — distinguished by `eventType`.
 */
export type AlertEventType = 'CREATED' | 'UPDATED' | 'RESOLVED';

export interface AlertStreamEvent {
  alertId: number;
  machineId: number;
  machineName?: string;
  title: string;
  description?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  eventType: AlertEventType;
  timestamp: string;
  health?: number;
  anomalyProbability?: number;
  riskLevel?: string;
  recommendedAction?: string;
}

export interface AlertStatsResponse {
  totalAlerts: number;
  newAlerts: number;
  acknowledgedAlerts: number;
  escalatedAlerts: number;
  closedAlerts: number;
  /** Client-computed only (technician view) — not part of the REST DTO. */
  resolvedAlerts?: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  unviewedCount: number;
  /** Real average (createdDate -> closedDate) across closed alerts, in hours. Null when no alert has been closed yet. */
  averageResolutionTimeHours?: number | null;
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
  subCategory?: string;
  cost: number;
  currentStock: number;
  minimumStock: number;
  reorderQuantity: number;
  unit: string;
  supplier: string;
  status: string; // Backend returns string, not enum
  notes: string;
  imageUrl?: string;
  createdDate: string;
  lastModifiedDate: string;
}

export interface PartRequest {
  name: string;
  description: string;
  partNumber: string;
  currentStock: number; // ✅ Added - backend expects this
  category: string;
  subCategory?: string;
  cost: number;
  minimumStock: number;
  reorderQuantity: number;
  unit: string;
  supplier: string;
  notes: string;
  imageUrl?: string;
}

export interface PartUpdateRequest {
  name?: string;
  description?: string;
  category?: string;
  subCategory?: string;
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
  status: string; // Backend returns string
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
  requestedBy?: string; // ✅ Added - backend has this field
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
  status: string; // Backend returns string
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

// ✅ Added Category interfaces to match backend
export interface CategoryRequest {
  name: string;
}

export interface CategoryResponse {
  id: number;
  name: string;
}


// ==================== FINANCE & BUDGET MODULE ====================

// Enums
export enum MachineStatus {
  RUNNING = 'RUNNING',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  FAILED = 'FAILED',
}

export enum MaintenanceActionType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
}

export enum MaintenanceActionStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum CriticalityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum UrgencyLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum RecommendedAction {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
  MONITOR = 'MONITOR',
}

export enum BudgetAlertType {
  OVER_BUDGET = 'OVER_BUDGET',
  NEAR_LIMIT = 'NEAR_LIMIT',
  LOW_REMAINING = 'LOW_REMAINING',
}

// ==================== DEPARTMENT DTOs ====================
export interface DepartmentRequest {
  name: string;
  description?: string;
  managerId?: number;
  budgetYear?: number;
}

export interface DepartmentResponse {
  id: number;
  name: string;
  description?: string;
  managerId?: number;
  managerName?: string;
  budgetYear?: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdDate: string;
  lastModifiedDate: string;
}

// ==================== BUDGET DTOs ====================
export interface BudgetRequest {
  departmentId: number;
  fiscalYear: number;
  allocatedAmount: number;
}

export interface BudgetResponse {
  id: number;
  departmentId: number;
  departmentName: string;
  fiscalYear: number;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  utilizationPercentage: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdDate?: string;
  lastModifiedDate?: string;
  
  // Legacy properties for backward compatibility
  department?: string;
  period?: string;
}

export interface BudgetAlertResponse {
  id: number;
  budgetId: number;
  departmentName: string;
  fiscalYear: number;
  alertType: 'NEAR_LIMIT' | 'OVER_BUDGET';
  message: string;
  allocatedAmount: number;
  spentAmount: number;
  utilizationPercentage: number;
  createdDate: string;
}

// ==================== MAINTENANCE RAPPORT DTOs ====================
export enum RapportStatus {
  DRAFT = 'DRAFT',
  PENDING_MANAGER_APPROVAL = 'PENDING_MANAGER_APPROVAL',
  PENDING_FINANCE_APPROVAL = 'PENDING_FINANCE_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface RapportPartRequest {
  /** Set when this line came from an active reservation for the job — see PartReservationResponse. */
  partId?: number;
  partName: string;
  partCode?: string;
  quantity: number;
  unitCost: number;
  supplier?: string;
}

export interface RapportPartResponse {
  id: number;
  partName: string;
  partCode?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier?: string;
}

export interface ChecklistItemRequest {
  description: string;
  passed: boolean;
  notes?: string;
}

export interface ChecklistItemResponse {
  id: number;
  description: string;
  passed: boolean;
  notes?: string;
}

export interface MaintenanceRapportRequest {
  taskId?: number;
  machineId: number;
  machineName?: string;
  title: string;
  description?: string;
  workPerformed: string;
  partsReplaced?: string;
  laborHours: number;
  laborCost: number;
  parts: RapportPartRequest[];
  checklistItems: ChecklistItemRequest[];
}

export interface MaintenanceRapportResponse {
  id: number;
  taskId?: number;
  machineId: number;
  machineName?: string;
  technicianUsername: string;
  technicianName?: string;
  title: string;
  description?: string;
  workPerformed: string;
  partsReplaced?: string;
  laborHours: number;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  status: RapportStatus;
  parts: RapportPartResponse[];
  checklistItems: ChecklistItemResponse[];
  hasFailedChecklistItems: boolean;
  createdDate: string;
  lastModifiedDate?: string;
  approvedByManager?: string;
  managerApprovedDate?: string;
  approvedByFinance?: string;
  financeApprovedDate?: string;
  rejectionReason?: string;
}

export interface ApprovalRequest {
  approved: boolean;
  rejectionReason?: string;
  /** Required when approving a rapport that has hasFailedChecklistItems=true. */
  reviewNote?: string;
}

export interface AttachmentResponse {
  id: number;
  entityType: string;
  entityId: number;
  fileName: string;
  storedFileName: string;
  contentType?: string;
  fileSize?: number;
  uploadedBy: string;
  uploadedAt: string;
}

// ==================== STOCK DTOs ====================
export interface StockItemRequest {
  partName: string;
  partCode: string;
  category: string;
  quantityInStock: number;
  minimumQuantity: number;
  maximumQuantity: number;
  unitCost: number;
  supplier: string;
  leadTimeDays: number;
}

export interface StockItemResponse {
  id: number;
  partName: string;
  partCode: string;
  category: string;
  quantityInStock: number;
  minimumQuantity: number;
  maximumQuantity: number;
  unitCost: number;
  totalValue: number;
  supplier: string;
  leadTimeDays: number;
  isBelowMinimum: boolean;
  isAboveMaximum: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdDate: string;
  lastModifiedDate: string;
}

export interface StockReorderRequest {
  stockItemId: number;
  quantityRequested: number;
  expectedDeliveryDate?: string;
  notes?: string;
}

export interface StockReorderResponse {
  id: number;
  stockItemId: number;
  partName: string;
  partCode: string;
  quantityRequested: number;
  costPerUnit: number;
  totalCost: number;
  status: 'PENDING' | 'APPROVED' | 'RECEIVED';
  requestedBy: string;
  requestedDate: string;
  approvedDate?: string;
  receivedDate?: string;
  expectedDeliveryDate?: string;
  notes?: string;
}

// ==================== FINANCE DASHBOARD DTOs ====================
export interface DepartmentSpendingResponse {
  departmentId: number;
  departmentName: string;
  totalSpent: number;
  budgetAllocated: number;
  utilizationPercentage: number;
}

export interface FinanceDashboardResponse {
  totalBudgetAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  overallUtilization: number;
  departmentBudgets: BudgetResponse[];
  budgetAlerts: BudgetAlertResponse[];
  topSpendingDepartments: DepartmentSpendingResponse[];
  maintenanceRapportStats: {
    totalRapports: number;
    approvedRapports: number;
    pendingRapports: number;
    rejectedRapports: number;
    totalCost: number;
  };
  stockMetrics: {
    totalItems: number;
    itemsBelowMinimum: number;
    itemsAboveMaximum: number;
    totalStockValue: number;
  };
  recentRapports: MaintenanceRapportResponse[];
  
  // Legacy properties for backward compatibility with existing components
  totalAllocated?: number;
  budgetsByDepartment?: BudgetResponse[];
  topCostMachines?: any[];
  monthlyCosts?: any[];
  alerts?: BudgetAlertResponse[];
}

// Maintenance Parts
export interface MaintenancePart {
  id: number;
  name: string;
  referenceCode: string;
  unitCost: number;
  stockQuantity: number;
  leadTimeDays: number;
}

export interface MaintenancePartRequest {
  name: string;
  referenceCode: string;
  unitCost: number;
  stockQuantity: number;
  leadTimeDays: number;
}

// Maintenance Actions
export interface MaintenanceAction {
  id: number;
  machineId: number;
  machineName: string;
  type: MaintenanceActionType;
  estimatedDurationHours: number;
  laborCostPerHour: number;
  parts: MaintenancePart[];
  status: MaintenanceActionStatus;
  scheduledDate: string;
}

export interface MaintenanceActionRequest {
  machineId: number;
  type: MaintenanceActionType;
  estimatedDurationHours: number;
  laborCostPerHour: number;
  partIds: number[];
  scheduledDate: string;
}

// Failure Events
export interface FailureEvent {
  id: number;
  machineId: number;
  machineName: string;
  failureType: string;
  actualDowntimeHours: number;
  totalCostIncurred: number;
  occurredAt: string;
}

export interface FailureEventRequest {
  machineId: number;
  failureType: string;
  actualDowntimeHours: number;
}

// Cost Comparison
export interface CostComparisonRequest {
  machineId: number;
  actionId: number;
  estimatedFailureDowntimeHours: number;
}

export interface CostComparisonResponse {
  machineId: number;
  machineName: string;
  preventiveCost: number;
  correctiveCost: number;
  estimatedSavings: number;
  recommendation: string;
  urgencyLevel: UrgencyLevel;
  estimatedDowntimeHours: number;
}

// Maintenance Recommendations
export interface MaintenanceRecommendationRequest {
  machineId: number;
  failureProbability: number;
  daysUntilPredictedFailure: number;
  requiredPartIds?: number[];
}

export interface MaintenanceRecommendationResponse {
  machineId: number;
  machineName: string;
  urgencyLevel: UrgencyLevel;
  recommendedAction: RecommendedAction;
  justification: string;
  estimatedCost: number;
  estimatedSavings: number;
  partsAvailable: boolean;
  missingParts: string[];
  daysUntilFailure: number;
  failureProbability: number;
}

// Financial Dashboard
export interface TopCostMachine {
  machineId: number;
  machineName: string;
  totalCost: number;
  maintenanceCost: number;
  failureCost: number;
}

export interface BudgetAlert {
  department: string;
  period: string;
  alertType: BudgetAlertType;
  message: string;
  amount: number;
}

export interface MonthlyCost {
  month: string;
  maintenanceCost: number;
  failureCost: number;
  totalCost: number;
}

export interface FinancialDashboardResponse {
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  overallUtilization: number;
  topCostMachines: TopCostMachine[];
  alerts: BudgetAlert[];
  monthlyCosts: MonthlyCost[];
  budgetsByDepartment: BudgetResponse[];
}

// Maintenance Report
export interface MaintenanceDetail {
  id: number;
  machineId: number;
  machineName: string;
  type: MaintenanceActionType;
  status: MaintenanceActionStatus;
  durationHours: number;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  scheduledDate: string;
}

export interface MaintenanceReportResponse {
  totalActions: number;
  totalCost: number;
  totalLaborCost: number;
  totalPartsCost: number;
  actions: MaintenanceDetail[];
}

// Failure Report
export interface FailureDetail {
  id: number;
  machineId: number;
  machineName: string;
  failureType: string;
  downtimeHours: number;
  cost: number;
  occurredAt: string;
}

export interface FailureReportResponse {
  totalFailures: number;
  totalCost: number;
  totalDowntimeHours: number;
  failures: FailureDetail[];
}

// Failure Summary
export interface FailureSummary {
  totalFailures: number;
  totalFailureCost: number;
  averageCostPerFailure: number;
  mostCommonFailureTypes: string[];
}

// Machine in Finance Module
export interface FinanceMachine {
  id: number;
  name: string;
  location: string;
  status: MachineStatus;
  hourlyProductionValue: number;
  replacementCost: number;
  criticalityLevel: CriticalityLevel;
  age: number;
}


// ==================== SIMPLE FINANCE MODULE ====================

export enum ExpenseStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ExpenseCategory {
  MAINTENANCE = 'MAINTENANCE',
  PARTS = 'PARTS',
  LABOR = 'LABOR',
  EQUIPMENT = 'EQUIPMENT',
  OTHER = 'OTHER',
}

export interface ExpenseReportRequest {
  title: string;
  description?: string;
  amount: number;
  category: ExpenseCategory;
  machineId?: number;
  machineName?: string;
  maintenanceTaskId?: number;
  notes?: string;
}

export interface ExpenseReportResponse {
  id: number;
  title: string;
  description?: string;
  amount: number;
  category: ExpenseCategory;
  machineId?: number;
  machineName?: string;
  maintenanceTaskId?: number;
  notes?: string;
  submittedBy: string;
  submittedByName: string;
  status: ExpenseStatus;
  reviewedBy?: string;
  reviewedDate?: string;
  reviewNote?: string;
  rejectionReason?: string;
  createdDate: string;
  lastModifiedDate: string;
}

export interface ApproveExpenseRequest {
  reviewNote?: string;
}

export interface RejectExpenseRequest {
  rejectionReason: string;
}

export interface FinanceBudgetRequest {
  year: number;
  totalBudget: number;
  notes?: string;
}

export interface FinanceBudgetResponse {
  id: number;
  year: number;
  totalBudget: number;
  spentAmount: number;
  remainingBudget: number;
  utilizationPercentage: number;
  notes?: string;
  createdBy?: string;
  createdDate: string;
  lastModifiedDate: string;
}

export interface FinanceDashboardStats {
  currentYear: number;
  totalBudget: number;
  spentAmount: number;
  remainingBudget: number;
  utilizationPercentage: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingAmount: number;
  approvedAmount: number;
  expensesByCategory: Record<string, number>;
  totalExpenseReports: number;
  budgetExists: boolean;
}

export interface ExpenseSummaryResponse {
  year: number;
  month: number;
  monthName: string;
  totalApprovedAmount: number;
  totalPendingAmount: number;
  totalRejectedAmount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalExpenseCount: number;
  amountByCategory: Record<string, number>;
}

// ==================== CUSTOMER PORTAL DTOs ====================
// Everything here is deliberately plain-language on the wire (see
// PortalMachineService on the backend) — no raw risk scores, no enum names.

export interface PortalMachineSummary {
  machineId: number;
  name: string;
  serialNumber: string;
  location?: string;
  statusLabel: string;
  healthScore: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
}

export interface PortalMachineDetail {
  machineId: number;
  name: string;
  serialNumber: string;
  location?: string;
  model?: string;
  statusLabel: string;
  healthScore: number;
  installationDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  riskSummary: string;
  recommendedAction?: string;
  predictionEstimated: boolean;
  predictionUpdatedAt?: string;
}

export interface PortalMaintenanceHistoryEntry {
  id: number;
  type?: string;
  description?: string;
  statusLabel: string;
  scheduledDate?: string;
  completedDate?: string;
}

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface SupportTicketRequest {
  machineId: number;
  subject: string;
  description?: string;
}

export interface SupportTicketResponse {
  id: number;
  machineId: number;
  machineName?: string;
  customerName?: string;
  subject: string;
  description?: string;
  status: SupportTicketStatus;
  assignedTo?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
}

export interface SupportTicketUpdateRequest {
  status: SupportTicketStatus;
  resolutionNotes?: string;
}

export interface PortalMessageRequest {
  body: string;
}

export interface PortalMessageResponse {
  id: number;
  ticketId: number;
  senderUsername: string;
  fromCustomer: boolean;
  body: string;
  createdAt: string;
}

export interface WarrantyRequest {
  machineId: number;
  provider: string;
  startDate: string;
  endDate: string;
  terms?: string;
}

export interface WarrantyResponse {
  id: number;
  machineId: number;
  machineName?: string;
  provider: string;
  startDate: string;
  endDate: string;
  terms?: string;
  active: boolean;
}

export type InvoiceStatus = 'UNPAID' | 'PAID' | 'OVERDUE';

export interface InvoiceRequest {
  customerUserId: number;
  machineId?: number;
  invoiceNumber: string;
  amount: number;
  status?: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  description?: string;
}

export interface InvoiceResponse {
  id: number;
  customerUserId: number;
  machineId?: number;
  machineName?: string;
  invoiceNumber: string;
  amount: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  description?: string;
}

export interface CustomerMachineLink {
  id: number;
  userId: number;
  machineId: number;
  linkedBy?: string;
  createdAt: string;
}

export interface CustomerMachineLinkRequest {
  userId: number;
  machineId: number;
}

// ==================== AUDIT LOG (Super Admin) ====================

export interface AuditEventDto {
  id: number;
  actor: string;
  action: string;
  entityType?: string;
  entityId?: number;
  details?: string;
  createdAt: string;
}

// ==================== RELIABILITY (Manager) ====================

export interface MachineReliabilitySummary {
  machineId: number;
  machineName: string;
  mtbfHours: number | null;
  mttrHours: number | null;
  failureCount: number;
  lastFailureAt: string | null;
}

export interface FailureRecord {
  maintenanceId: number;
  machineId: number;
  machineName: string;
  type: string;
  description?: string;
  rootCause?: string;
  repairHours: number | null;
  completedDate?: string;
}

// ==================== SUPPLIERS & DEMAND FORECAST (Stock Manager) ====================

export interface SupplierRequest {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  leadTimeDays?: number;
  notes?: string;
  active?: boolean;
}

export interface SupplierResponse {
  id: number;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  leadTimeDays?: number;
  notes?: string;
  active: boolean;
  createdDate: string;
}

export interface SupplierScorecard {
  supplierId: number;
  supplierName: string;
  totalOrders: number;
  deliveredOrders: number;
  totalSpend: number;
  avgActualLeadTimeDays: number | null;
  onTimeDeliveryRate: number | null;
}

export interface DemandForecastEntry {
  partId: number;
  partName: string;
  currentStock: number;
  minimumStock: number;
  avgDailyConsumption: number | null;
  projectedDaysUntilStockout: number | null;
  belowMinimum: boolean;
}

// ==================== SCHEDULING / CAPACITY (Manager) ====================

export interface TechnicianCapacity {
  technicianId: number;
  technicianName: string;
  username: string;
  openJobCount: number;
  totalEstimatedHours: number;
}

export interface CalendarEventDto {
  id: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  eventType: string;
  assignedTo?: string;
  status?: string;
  priority?: string;
  location?: string;
  machineId?: number;
  taskId?: number;
}

// ==================== EXECUTIVE SUMMARY (Super Admin / Admin) ====================

export interface ExecutiveSummary {
  machineCount: number;
  fleetAverageHealth: number | null;
  openWorkOrders: number;
  overdueWorkOrders: number;
  pendingRapportApprovals: number;
  pendingExpenseApprovals: number;
  pendingReorderApprovals: number;
  openSupportTickets: number;
  budgetUtilizationPercentage: number | null;
  topReliabilityRisks: MachineReliabilitySummary[];
  preventiveCompletedLast30Days: number;
  correctiveCompletedLast30Days: number;
}

// ==================== WORK ORDER TEMPLATES & RECURRING MAINTENANCE ====================

export interface WorkOrderTemplateRequest {
  name: string;
  description?: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedDuration?: number;
  defaultNotes?: string;
  active?: boolean;
}

export interface WorkOrderTemplateResponse {
  id: number;
  name: string;
  description?: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedDuration?: number;
  defaultNotes?: string;
  active: boolean;
  createdDate: string;
}

export interface RecurringMaintenanceRuleRequest {
  machineId: number;
  workOrderTemplateId: number;
  intervalDays: number;
  assignedTechnicianId?: number;
  firstRunDate?: string;
  active?: boolean;
}

export interface RecurringMaintenanceRuleResponse {
  id: number;
  machineId: number;
  workOrderTemplateId: number;
  workOrderTemplateName?: string;
  intervalDays: number;
  assignedTechnicianId?: number;
  nextRunDate: string;
  lastGeneratedMaintenanceId?: number;
  active: boolean;
}

// ==================== ACTIVITY TIMELINE ====================

export interface TimelineEntry {
  timestamp: string;
  category: 'MAINTENANCE_SCHEDULED' | 'MAINTENANCE_COMPLETED' | 'AUDIT' | 'ALERT' | 'COMMENT';
  title: string;
  description?: string;
  actor?: string;
}

// ==================== COMMENTS ====================

export interface CommentRequest {
  entityType: 'MACHINE' | 'MAINTENANCE';
  entityId: number;
  body: string;
}

export interface CommentResponse {
  id: number;
  entityType: string;
  entityId: number;
  authorUsername: string;
  body: string;
  createdAt: string;
}

// ==================== USER PREFERENCES ====================

export interface NotificationPreferences {
  inAppEnabled: boolean;
  mutedRiskLevels: string[];
}

// ==================== INVENTORY RESERVATION ====================

export interface PartReservationRequest {
  partId: number;
  quantity: number;
  maintenanceId?: number;
}

export type PartReservationStatus = 'RESERVED' | 'CONSUMED' | 'RELEASED';

export interface PartReservationResponse {
  id: number;
  partId: number;
  partName?: string;
  quantityReserved: number;
  quantityConsumed?: number;
  maintenanceId?: number;
  status: PartReservationStatus;
  reservedBy: string;
  reservedAt: string;
  resolvedAt?: string;
}

// ==================== EXPLAINABLE AI ====================

export interface PredictionFactor {
  sensorName: string;
  sensorType: string;
  currentValue: number;
  normalMin: number;
  normalMax: number;
  unit?: string;
  deviationPercent: number;
  contribution: 'high' | 'medium' | 'low';
}

export interface PredictionExplanation {
  machineId: number;
  riskLevel: string;
  failureProbability?: number;
  confidenceScore?: number;
  predictedAt?: string;
  summary: string;
  topFactors: PredictionFactor[];
  hasSensorData: boolean;
}

// ==================== SAVED AI RECOMMENDATIONS (approval + history) ====================

export type RecommendationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SavedRecommendationResponse {
  id: number;
  machineId: number;
  machineName?: string;
  urgencyLevel: string;
  recommendedAction: string;
  justification?: string;
  failureProbability?: number;
  daysUntilFailure?: number;
  status: RecommendationStatus;
  generatedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  resultingMaintenanceId?: number;
}

export interface RecommendationDecisionRequest {
  note?: string;
}
