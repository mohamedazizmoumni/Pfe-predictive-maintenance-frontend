// View-model types for the Machine Visualization digital twin. Kept separate
// from the backend DTOs (MachineTelemetry, Machine) so the illustration and
// overlay components depend only on this shape, not on raw wire fields.

export type MachineArchetype = 'cnc' | 'press' | 'robot' | 'conveyor' | 'generic';

export type SensorKind =
  | 'temperature'
  | 'vibration'
  | 'pressure'
  | 'rpm'
  | 'power'
  | 'current'
  | 'voltage'
  | 'humidity'
  | 'oilLevel'
  | 'bearingTemperature'
  | 'hydraulicPressure'
  | 'airPressure'
  | 'flowRate';

export type SignalStatus = 'normal' | 'warning' | 'critical';
export type TrendDirection = 'up' | 'down' | 'flat';

export interface SensorPoint {
  id: string;
  kind: SensorKind;
  label: string;
  /** Anchor position on the illustration, in percent (0-100) of the viewport. */
  x: number;
  y: number;
  value: number;
  unit: string;
  normalRange: [number, number];
  status: SignalStatus;
  trend: TrendDirection;
  trendPercent: number;
  lastUpdateLabel: string;
  sparkline: number[];
  /** Whether this reading is real telemetry vs. a plausibility-derived estimate. */
  isReal: boolean;
}

export type ComponentTone = 'green' | 'blue' | 'amber' | 'purple' | 'red';

export interface HealthSubscore {
  key: 'mechanical' | 'electrical' | 'hydraulic' | 'thermal' | 'software';
  label: string;
  value: number;
  tone: ComponentTone;
}

export interface MachineHealthRing {
  overall: number;
  statusLabel: string;
  tone: ComponentTone;
  subscores: HealthSubscore[];
}

export interface TelemetryOrbitCard {
  id: string;
  label: string;
  value: string;
  unit: string;
  icon: string;
  tone: ComponentTone;
  anchorX: number;
  anchorY: number;
}

export type TwinComponentKey =
  | 'motor'
  | 'spindle'
  | 'bearing'
  | 'hydraulicPump'
  | 'controlPanel'
  | 'coolingFan'
  | 'conveyorBelt'
  | 'frame';

export interface MaintenanceHistoryEntry {
  date: string;
  description: string;
}

export interface TwinComponentDetail {
  key: TwinComponentKey;
  label: string;
  icon: string;
  x: number;
  y: number;
  status: SignalStatus;
  tone: ComponentTone;
  currentTemp: number;
  rpm: number;
  power: number;
  health: number;
  predictedRulHours: number;
  maintenanceHistory: MaintenanceHistoryEntry[];
  anomalyScore: number;
  aiRecommendation: string;
}

export type CameraViewMode = 'physical' | 'wireframe' | 'exploded' | 'crossSection' | 'xray' | 'thermal' | 'digitalTwin';
export type AnatomyMode = 'physical' | 'electrical' | 'hydraulic' | 'thermal' | 'sensor' | 'maintenance';

export interface MaintenanceOverlayItem {
  key: TwinComponentKey;
  label: string;
  icon: string;
  status: SignalStatus | 'healthy';
  statusLabel: string;
  x: number;
  y: number;
}

export interface AiPrediction {
  bearingWearProbability: number;
  remainingUsefulLifeHours: number;
  recommendedWithinDays: number;
  predictedDowntimeAvoidedHours: number;
  confidence: number;
  estimatedSavingsTnd: number;
  narrative: string;
  usingRealSignal: boolean;
}

export type TimelineEventKind = 'start' | 'warning' | 'anomaly' | 'stabilized' | 'maintenance' | 'info';

export interface TwinTimelineEvent {
  id: string;
  timeLabel: string;
  title: string;
  description: string;
  kind: TimelineEventKind;
}
