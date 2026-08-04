// View-model contracts for the Inventory Analytics page.
// Fields marked "derived" have no backend data source yet (see
// inventory-intelligence.service.ts header comment for the full picture) and
// are computed deterministically from real records so they stay stable
// between reloads instead of flickering like real-time telemetry.

export type StockSeverity = 'healthy' | 'low' | 'critical' | 'out';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type TrendDirection = 'up' | 'down' | 'flat';

export interface TrendPoint {
  label: string;
  timestamp: number;
  value: number;
}

export type TrendRange = '30d' | '6m' | '1y';
export type MovementGranularity = 'daily' | 'weekly' | 'monthly';

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  rawValue: number;
  icon: string;
  accent: 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'neutral';
  changeLabel?: string;
  changeDirection?: TrendDirection;
  badge?: string;
  sparkline?: number[];
  caption: string;
}

export interface DistributionSlice {
  label: string;
  value: number;
  color: string;
  severity: StockSeverity | 'reserved' | 'incoming';
}

export interface ConsumedPartRow {
  partId: number;
  partName: string;
  currentStock: number;
  consumedThisMonth: number;
  /** True when consumedThisMonth is derived from real logged usage rather than an estimate. */
  isReal: boolean;
}

export interface CategoryValueSlice {
  category: string;
  value: number;
  healthyValue: number;
  atRiskValue: number;
  count: number;
  color: string;
}

export interface MovementPoint {
  label: string;
  incoming: number;
  outgoing: number;
}

export interface ForecastPoint {
  label: string;
  historical: number | null;
  predicted: number | null;
  confidenceLow: number | null;
  confidenceHigh: number | null;
}

export interface AiInsight {
  id: string;
  icon: string;
  text: string;
  confidence: number;
  accent: 'danger' | 'warning' | 'info' | 'success';
}

export interface CriticalPartRow {
  partId: number;
  partName: string;
  partNumber: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  reserved: number;
  supplier: string;
  leadTimeDays: number;
  dailyUsage: number;
  predictedStockoutDate: string | null;
  risk: RiskLevel;
  recommendedAction: string;
  status: string;
}

export interface ReorderRecommendation {
  partId: number;
  partName: string;
  partNumber: string;
  currentStock: number;
  recommendedQuantity: number;
  supplier: string;
  costEstimate: number;
  leadTimeDays: number;
  reason: string;
  confidence: number;
}

export interface SupplierPerformanceRow {
  supplier: string;
  avgDeliveryDays: number;
  delayedOrders: number;
  totalPurchases: number;
  qualityScore: number;
  latePercent: number;
  reliabilityPercent: number;
  delayIsMeasured: boolean;
}

export interface MachineDependencyRow {
  machineId: number;
  machineName: string;
  location: string;
  partId: number;
  partName: string;
  currentAvailability: number;
  daysRemaining: number;
  risk: RiskLevel;
}

export type TimelineEventKind =
  | 'replenished'
  | 'critical'
  | 'order-approved'
  | 'ai-prediction'
  | 'supplier-delay'
  | 'audit'
  | 'general';

export interface TimelineEvent {
  id: number;
  kind: TimelineEventKind;
  title: string;
  body: string;
  timestamp: string;
  accent: 'success' | 'warning' | 'danger' | 'info' | 'ai';
}

export interface HeatmapCell {
  category: string;
  turnoverLabel: 'High turnover' | 'Low turnover' | 'Dead stock' | 'Critical stock';
  intensity: number;
  value: number;
  partCount: number;
}

export interface BottomStat {
  id: string;
  label: string;
  value: string;
  rawValue: number;
  suffix: string;
  accent: 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'neutral';
  icon: string;
}
