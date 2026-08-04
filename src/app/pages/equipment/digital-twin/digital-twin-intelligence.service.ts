import { Injectable } from '@angular/core';
import { Machine } from '../../../core/models/sentinel.models';
import { MachineTelemetry } from '../../../core/services/machine-websocket.service';
import { seededFloat, seededInt, seededPick } from '../../../core/utils/seeded-random';
import {
  AiPrediction,
  ComponentTone,
  HealthSubscore,
  MachineArchetype,
  MachineHealthRing,
  MaintenanceHistoryEntry,
  MaintenanceOverlayItem,
  SensorKind,
  SensorPoint,
  SignalStatus,
  TelemetryOrbitCard,
  TrendDirection,
  TwinComponentDetail,
  TwinComponentKey,
  TwinTimelineEvent,
} from './digital-twin.types';

/**
 * Minimal shape needed from the component's rolling telemetry history —
 * structurally compatible with MachineVisualizationComponent's own
 * TelemetrySnapshot[], so no mapping/casting is required at the call site.
 */
export interface TelemetryHistoryPoint {
  temperature: number;
  vibration: number;
  pressure?: number;
  powerConsumption?: number;
  rotationSpeed?: number;
}

interface AlertLike {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
}

/**
 * Data brain for the Machine Visualization digital twin.
 *
 * Real backend fields (MachineTelemetry) are used directly wherever they
 * exist — including several fields the old UI received but never rendered
 * (bearingWear, remainingUsefulLife, riskScore, lubricationLevel, current,
 * voltage). Where no backend field exists at all (humidity, flow rate, a
 * distinct bearing-temperature reading, etc.) values are derived with a
 * seeded PRNG keyed on the machine's serial number, so numbers stay stable
 * across reloads instead of flickering — the same policy already agreed for
 * Inventory Analytics. Every derived reading is tagged `isReal: false` so a
 * future real sensor feed can be swapped in without touching consumers.
 */
@Injectable({ providedIn: 'root' })
export class DigitalTwinIntelligenceService {
  // ── Archetype selection ──────────────────────────────────────

  archetypeFor(machine: Machine | null): MachineArchetype {
    const sub = (machine?.subCategory || '').toUpperCase();
    if (sub === 'CNC_MACHINE' || sub === 'LASER_CUTTER') return 'cnc';
    if (sub === 'PRESS_MACHINE') return 'press';
    if (sub === 'INDUSTRIAL_ROBOT') return 'robot';
    if (sub === 'CONVEYOR_BELT' || sub === 'CONVEYOR_SYSTEM') return 'conveyor';
    return 'generic';
  }

  archetypeLabel(archetype: MachineArchetype): string {
    switch (archetype) {
      case 'cnc': return 'CNC Machine';
      case 'press': return 'Hydraulic Press';
      case 'robot': return 'Industrial Robot';
      case 'conveyor': return 'Conveyor / Packaging Line';
      default: return 'Industrial Unit';
    }
  }

  // ── Sensor overlay ───────────────────────────────────────────

  private readonly sensorMeta: Record<SensorKind, { label: string; unit: string; range: [number, number] }> = {
    temperature: { label: 'Temperature', unit: '°C', range: [35, 75] },
    vibration: { label: 'Vibration', unit: 'mm/s', range: [0, 4.5] },
    pressure: { label: 'Pressure', unit: 'bar', range: [2, 8] },
    rpm: { label: 'Motor RPM', unit: 'rpm', range: [400, 1800] },
    power: { label: 'Power', unit: 'kW', range: [40, 140] },
    current: { label: 'Current', unit: 'A', range: [8, 32] },
    voltage: { label: 'Voltage', unit: 'V', range: [380, 420] },
    humidity: { label: 'Humidity', unit: '%', range: [30, 60] },
    oilLevel: { label: 'Oil Level', unit: '%', range: [55, 100] },
    bearingTemperature: { label: 'Bearing Temperature', unit: '°C', range: [30, 68] },
    hydraulicPressure: { label: 'Hydraulic Pressure', unit: 'bar', range: [120, 180] },
    airPressure: { label: 'Air Pressure', unit: 'bar', range: [5, 8] },
    flowRate: { label: 'Flow Rate', unit: 'L/min', range: [10, 45] },
  };

  private readonly archetypeSensorLayout: Record<MachineArchetype, { kind: SensorKind; x: number; y: number }[]> = {
    cnc: [
      { kind: 'rpm', x: 54, y: 22 },
      { kind: 'temperature', x: 30, y: 40 },
      { kind: 'vibration', x: 66, y: 46 },
      { kind: 'current', x: 80, y: 32 },
      { kind: 'power', x: 20, y: 66 },
      { kind: 'flowRate', x: 58, y: 80 },
    ],
    press: [
      { kind: 'hydraulicPressure', x: 50, y: 18 },
      { kind: 'temperature', x: 26, y: 42 },
      { kind: 'vibration', x: 74, y: 44 },
      { kind: 'oilLevel', x: 78, y: 66 },
      { kind: 'power', x: 22, y: 68 },
      { kind: 'rpm', x: 50, y: 86 },
    ],
    robot: [
      { kind: 'temperature', x: 48, y: 16 },
      { kind: 'vibration', x: 62, y: 36 },
      { kind: 'current', x: 30, y: 46 },
      { kind: 'voltage', x: 74, y: 58 },
      { kind: 'power', x: 26, y: 74 },
      { kind: 'rpm', x: 60, y: 82 },
    ],
    conveyor: [
      { kind: 'rpm', x: 22, y: 34 },
      { kind: 'temperature', x: 48, y: 24 },
      { kind: 'vibration', x: 72, y: 34 },
      { kind: 'power', x: 18, y: 62 },
      { kind: 'flowRate', x: 52, y: 68 },
      { kind: 'airPressure', x: 80, y: 60 },
    ],
    generic: [
      { kind: 'temperature', x: 36, y: 30 },
      { kind: 'pressure', x: 64, y: 28 },
      { kind: 'vibration', x: 50, y: 50 },
      { kind: 'power', x: 24, y: 68 },
      { kind: 'flowRate', x: 76, y: 66 },
      { kind: 'humidity', x: 50, y: 84 },
    ],
  };

  buildSensors(machine: Machine | null, telemetry: MachineTelemetry | null, history: TelemetryHistoryPoint[]): SensorPoint[] {
    const archetype = this.archetypeFor(machine);
    const layout = this.archetypeSensorLayout[archetype];
    const seedBase = machine?.serialNumber || 'machine';
    const nowLabel = telemetry?.timestamp ? this.formatTime(telemetry.timestamp) : 'just now';

    return layout.map(({ kind, x, y }) => {
      const meta = this.sensorMeta[kind];
      const seed = `${seedBase}:${kind}`;
      const { value, isReal } = this.resolveSensorValue(kind, telemetry, seed);
      const realHistory = this.realHistoryFor(kind, history);
      const spark = realHistory && realHistory.length >= 2 ? realHistory : this.syntheticHistory(seed, value, Math.max(Math.abs(value) * 0.08, 0.6));
      const { trend, pct } = this.trendOf(spark);
      const decimals = kind === 'vibration' ? 2 : kind === 'voltage' || kind === 'rpm' || kind === 'power' ? 0 : 1;

      return {
        id: `${archetype}-${kind}`,
        kind,
        label: meta.label,
        x,
        y,
        value: Number(value.toFixed(decimals)),
        unit: meta.unit,
        normalRange: meta.range,
        status: this.statusOf(value, meta.range),
        trend,
        trendPercent: Math.round(pct * 10) / 10,
        lastUpdateLabel: nowLabel,
        sparkline: spark,
        isReal,
      };
    });
  }

  private resolveSensorValue(kind: SensorKind, t: MachineTelemetry | null, seed: string): { value: number; isReal: boolean } {
    switch (kind) {
      case 'temperature':
        return t ? { value: t.temperature, isReal: true } : { value: seededFloat(seed, 42, 58, 1), isReal: false };
      case 'vibration':
        return t ? { value: t.vibration, isReal: true } : { value: seededFloat(seed, 1, 3, 2), isReal: false };
      case 'pressure':
        return t?.pressure != null ? { value: t.pressure, isReal: true } : { value: seededFloat(seed, 3, 6, 1), isReal: false };
      case 'rpm':
        return t?.rotationSpeed != null ? { value: t.rotationSpeed, isReal: true } : { value: seededInt(seed, 500, 1200), isReal: false };
      case 'power':
        return t?.powerConsumption != null ? { value: t.powerConsumption, isReal: true } : { value: seededInt(seed, 60, 110), isReal: false };
      case 'current':
        return t?.current != null ? { value: t.current, isReal: true } : { value: seededFloat(seed, 12, 24, 1), isReal: false };
      case 'voltage':
        return t?.voltage != null ? { value: t.voltage, isReal: true } : { value: seededInt(seed, 395, 410), isReal: false };
      case 'humidity':
        return { value: seededFloat(seed, 35, 55, 0), isReal: false };
      case 'oilLevel':
        return t?.lubricationLevel != null ? { value: t.lubricationLevel, isReal: true } : { value: seededInt(seed, 60, 95), isReal: false };
      case 'bearingTemperature':
        return t ? { value: Number((t.temperature + seededFloat(seed, -3, 5, 1)).toFixed(1)), isReal: false } : { value: seededFloat(seed, 35, 55, 1), isReal: false };
      case 'hydraulicPressure':
        return t?.pressure != null ? { value: t.pressure, isReal: true } : { value: seededInt(seed, 130, 170), isReal: false };
      case 'airPressure':
        return t?.pressure != null ? { value: t.pressure, isReal: true } : { value: seededFloat(seed, 5.5, 7.5, 1), isReal: false };
      case 'flowRate':
        return { value: seededInt(seed, 15, 40), isReal: false };
    }
  }

  private realHistoryFor(kind: SensorKind, history: TelemetryHistoryPoint[]): number[] | null {
    if (!history.length) return null;
    const ordered = [...history].reverse();
    switch (kind) {
      case 'temperature':
        return ordered.map((h) => h.temperature);
      case 'vibration':
        return ordered.map((h) => h.vibration);
      case 'pressure':
      case 'hydraulicPressure':
      case 'airPressure':
        return ordered.every((h) => h.pressure != null) ? ordered.map((h) => h.pressure as number) : null;
      case 'power':
        return ordered.every((h) => h.powerConsumption != null) ? ordered.map((h) => h.powerConsumption as number) : null;
      case 'rpm':
        return ordered.every((h) => h.rotationSpeed != null) ? ordered.map((h) => h.rotationSpeed as number) : null;
      default:
        return null;
    }
  }

  // ── Health ring ──────────────────────────────────────────────

  buildHealthRing(input: { mechanical: number; electrical: number; hydraulic: number; thermal: number; software: number }): MachineHealthRing {
    const overall = Math.round(
      input.mechanical * 0.3 + input.electrical * 0.2 + input.hydraulic * 0.2 + input.thermal * 0.15 + input.software * 0.15
    );
    const clamped = Math.max(0, Math.min(100, overall));
    const tone: ComponentTone = clamped >= 80 ? 'green' : clamped >= 60 ? 'blue' : clamped >= 40 ? 'amber' : 'red';
    const statusLabel = clamped >= 80 ? 'Healthy' : clamped >= 60 ? 'Good' : clamped >= 40 ? 'Watch' : 'Critical';

    const mk = (key: HealthSubscore['key'], label: string, value: number, subTone: ComponentTone): HealthSubscore => ({
      key,
      label,
      value: Math.max(0, Math.min(100, Math.round(value))),
      tone: subTone,
    });

    return {
      overall: clamped,
      statusLabel,
      tone,
      subscores: [
        mk('mechanical', 'Mechanical', input.mechanical, 'green'),
        mk('electrical', 'Electrical', input.electrical, 'blue'),
        mk('hydraulic', 'Hydraulic', input.hydraulic, 'amber'),
        mk('thermal', 'Thermal', input.thermal, 'red'),
        mk('software', 'Software', input.software, 'purple'),
      ],
    };
  }

  // ── Floating telemetry cards ─────────────────────────────────

  buildTelemetryCards(input: {
    temperature: number;
    rpm: number;
    power: number;
    load: number;
    pressure: number;
    efficiency: number;
    oee: number;
    runtimeHours: number;
  }): TelemetryOrbitCard[] {
    return [
      { id: 'temp', label: 'Temperature', value: input.temperature.toFixed(1), unit: '°C', icon: 'Thermometer', tone: input.temperature > 75 ? 'red' : 'blue', anchorX: 28, anchorY: 14 },
      { id: 'rpm', label: 'RPM', value: Math.round(input.rpm).toString(), unit: 'rpm', icon: 'Gauge', tone: 'purple', anchorX: 72, anchorY: 14 },
      { id: 'power', label: 'Power', value: Math.round(input.power).toString(), unit: 'kW', icon: 'Zap', tone: 'amber', anchorX: 88, anchorY: 42 },
      { id: 'load', label: 'Load', value: Math.round(input.load).toString(), unit: '%', icon: 'Activity', tone: 'blue', anchorX: 88, anchorY: 70 },
      { id: 'pressure', label: 'Pressure', value: input.pressure.toFixed(1), unit: 'bar', icon: 'Gauge', tone: 'green', anchorX: 72, anchorY: 90 },
      { id: 'efficiency', label: 'Efficiency', value: Math.round(input.efficiency).toString(), unit: '%', icon: 'TrendingUp', tone: 'green', anchorX: 28, anchorY: 90 },
      { id: 'oee', label: 'OEE', value: Math.round(input.oee).toString(), unit: '%', icon: 'CircleGauge', tone: 'blue', anchorX: 12, anchorY: 70 },
      { id: 'runtime', label: 'Runtime', value: Math.round(input.runtimeHours).toString(), unit: 'h', icon: 'Clock', tone: 'purple', anchorX: 12, anchorY: 42 },
    ];
  }

  // ── Component detail / click-to-highlight ───────────────────

  private readonly archetypeComponents: Record<MachineArchetype, TwinComponentKey[]> = {
    cnc: ['spindle', 'motor', 'controlPanel', 'coolingFan', 'frame'],
    press: ['hydraulicPump', 'motor', 'bearing', 'controlPanel', 'frame'],
    robot: ['motor', 'controlPanel', 'bearing', 'frame'],
    conveyor: ['conveyorBelt', 'motor', 'controlPanel', 'frame'],
    generic: ['motor', 'bearing', 'controlPanel', 'frame'],
  };

  private readonly componentMeta: Record<TwinComponentKey, { label: string; icon: string }> = {
    motor: { label: 'Motor', icon: 'CircleGauge' },
    spindle: { label: 'Spindle', icon: 'Disc3' },
    bearing: { label: 'Bearing', icon: 'CircleDot' },
    hydraulicPump: { label: 'Hydraulic Pump', icon: 'Droplets' },
    controlPanel: { label: 'Control Panel', icon: 'Cpu' },
    coolingFan: { label: 'Cooling Fan', icon: 'Fan' },
    conveyorBelt: { label: 'Conveyor Belt', icon: 'MoveHorizontal' },
    frame: { label: 'Frame', icon: 'Box' },
  };

  private readonly componentLayout: Record<MachineArchetype, Partial<Record<TwinComponentKey, { x: number; y: number }>>> = {
    cnc: { spindle: { x: 52, y: 26 }, motor: { x: 22, y: 64 }, controlPanel: { x: 82, y: 38 }, coolingFan: { x: 64, y: 74 }, frame: { x: 50, y: 90 } },
    press: { hydraulicPump: { x: 50, y: 20 }, motor: { x: 20, y: 56 }, bearing: { x: 70, y: 56 }, controlPanel: { x: 82, y: 28 }, frame: { x: 50, y: 92 } },
    robot: { motor: { x: 50, y: 28 }, bearing: { x: 44, y: 50 }, controlPanel: { x: 80, y: 66 }, frame: { x: 50, y: 92 } },
    conveyor: { conveyorBelt: { x: 50, y: 46 }, motor: { x: 12, y: 56 }, controlPanel: { x: 88, y: 34 }, frame: { x: 50, y: 90 } },
    generic: { motor: { x: 28, y: 56 }, bearing: { x: 66, y: 44 }, controlPanel: { x: 82, y: 28 }, frame: { x: 50, y: 90 } },
  };

  buildComponentDetails(
    machine: Machine | null,
    telemetry: MachineTelemetry | null,
    extras: { health: number; failureProbability: number; bearingConfidence: number; rpm: number; power: number }
  ): TwinComponentDetail[] {
    const archetype = this.archetypeFor(machine);
    const keys = this.archetypeComponents[archetype];
    const layout = this.componentLayout[archetype];
    const seedBase = machine?.serialNumber || 'machine';

    return keys.map((key) => {
      const meta = this.componentMeta[key];
      const pos = layout[key] || { x: 50, y: 50 };
      const seed = `${seedBase}:${key}`;
      const jitter = seededInt(seed, -6, 6);

      const health = Math.max(5, Math.min(100, Math.round(extras.health + jitter)));
      const status: SignalStatus = health < 45 ? 'critical' : health < 70 ? 'warning' : 'normal';
      const tone: ComponentTone = status === 'critical' ? 'red' : status === 'warning' ? 'amber' : 'green';
      const rul = Math.max(6, Math.round((100 - extras.failureProbability) * 8 + jitter * 4));
      const anomalyScore = Math.max(0, Math.min(100, Math.round(extras.failureProbability * 0.8 + (100 - extras.bearingConfidence) * 0.2)));

      return {
        key,
        label: meta.label,
        icon: meta.icon,
        x: pos.x,
        y: pos.y,
        status,
        tone,
        currentTemp: Number(((telemetry?.temperature ?? seededFloat(seed, 40, 60, 1)) + jitter * 0.4).toFixed(1)),
        rpm: Math.max(0, Math.round(extras.rpm + jitter * 5)),
        power: Math.max(0, Math.round(extras.power + jitter)),
        health,
        predictedRulHours: rul,
        maintenanceHistory: this.maintenanceHistoryFor(seed, machine),
        anomalyScore,
        aiRecommendation: this.recommendationFor(key, status),
      };
    });
  }

  private readonly maintenanceDescriptions = [
    'Routine inspection completed',
    'Lubrication service performed',
    'Sensor calibration verified',
    'Alignment adjusted',
    'Filter replaced',
    'Vibration analysis performed',
  ];

  private maintenanceHistoryFor(seed: string, machine: Machine | null): MaintenanceHistoryEntry[] {
    const base = machine?.lastMaintenanceDate ? new Date(machine.lastMaintenanceDate) : new Date();
    const entries: MaintenanceHistoryEntry[] = [];
    for (let i = 0; i < 3; i++) {
      const daysBack = seededInt(`${seed}:hist${i}`, 15, 60) * (i + 1);
      const date = new Date(base.getTime() - daysBack * 86400000);
      entries.push({ date: date.toLocaleDateString(), description: seededPick(`${seed}:desc${i}`, this.maintenanceDescriptions) });
    }
    return entries;
  }

  private recommendationFor(key: TwinComponentKey, status: SignalStatus): string {
    const label = this.componentMeta[key].label.toLowerCase();
    if (status === 'critical') return `Schedule immediate inspection of the ${label} — degradation trend exceeds the safe threshold.`;
    if (status === 'warning') return `Monitor the ${label} closely and plan preventive maintenance within the next cycle.`;
    return `${this.componentMeta[key].label} is operating within normal parameters. No action required.`;
  }

  // ── Maintenance overlay ──────────────────────────────────────

  buildMaintenanceOverlay(componentDetails: TwinComponentDetail[]): MaintenanceOverlayItem[] {
    return componentDetails.map((c) => ({
      key: c.key,
      label: c.label,
      icon: c.icon,
      status: c.status === 'normal' ? 'healthy' : c.status,
      statusLabel: this.overlayLabelFor(c.key, c.status),
      x: c.x,
      y: c.y,
    }));
  }

  private overlayLabelFor(key: TwinComponentKey, status: SignalStatus): string {
    if (status === 'normal') return 'Healthy';
    if (status === 'critical') return 'Critical';
    switch (key) {
      case 'bearing': return 'Lubrication Needed';
      case 'hydraulicPump': return 'Service Due';
      case 'coolingFan': return 'Clean / Inspect';
      case 'conveyorBelt': return 'Tension Check';
      default: return 'Replace Soon';
    }
  }

  // ── AI predictions ───────────────────────────────────────────

  buildAiPrediction(machine: Machine | null, telemetry: MachineTelemetry | null, extras: { failureProbability: number }): AiPrediction {
    const seed = machine?.serialNumber || 'machine';

    const bearingWearProbability =
      telemetry?.bearingWear != null
        ? Math.round(telemetry.bearingWear)
        : Math.max(4, Math.min(97, Math.round(extras.failureProbability * 0.9 + seededInt(`${seed}:bw`, -4, 4))));

    const remainingUsefulLifeHours =
      telemetry?.remainingUsefulLife != null
        ? Math.round(telemetry.remainingUsefulLife)
        : Math.max(8, Math.round((100 - extras.failureProbability) * 9 + seededInt(`${seed}:rul`, -20, 20)));

    const recommendedWithinDays = remainingUsefulLifeHours < 48 ? 1 : remainingUsefulLifeHours < 120 ? 3 : remainingUsefulLifeHours < 240 ? 7 : 14;
    const predictedDowntimeAvoidedHours = Math.max(2, Math.round(bearingWearProbability * 0.22 + seededInt(`${seed}:dt`, 2, 10)));
    const confidence = telemetry ? Math.max(78, Math.min(99, 92 + seededInt(`${seed}:conf`, -6, 6))) : 74;
    const estimatedSavingsTnd = Math.round((predictedDowntimeAvoidedHours * 380 + bearingWearProbability * 22) / 10) * 10;

    const narrative =
      extras.failureProbability >= 65
        ? 'Elevated wear signature detected. Early intervention is projected to prevent an unplanned stoppage.'
        : extras.failureProbability >= 35
        ? 'Wear indicators are trending upward. A scheduled maintenance window is recommended.'
        : 'Telemetry is stable. The current maintenance plan remains optimal.';

    return {
      bearingWearProbability,
      remainingUsefulLifeHours,
      recommendedWithinDays,
      predictedDowntimeAvoidedHours,
      confidence,
      estimatedSavingsTnd,
      narrative,
      usingRealSignal: telemetry?.bearingWear != null || telemetry?.remainingUsefulLife != null,
    };
  }

  // ── Event timeline ───────────────────────────────────────────

  buildTimeline(telemetry: MachineTelemetry | null, alerts: AlertLike[], aiPrediction: AiPrediction): TwinTimelineEvent[] {
    const events: TwinTimelineEvent[] = [];
    const now = Date.now();
    const at = (minutesAgo: number) => new Date(now - minutesAgo * 60000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    events.push({ id: 'start', timeLabel: at(95), title: 'Production started', description: 'Shift cycle began — telemetry streaming nominal.', kind: 'start' });

    if (telemetry && telemetry.temperature > 68) {
      events.push({ id: 'temp', timeLabel: at(61), title: 'Temperature increased', description: `Thermal reading climbed to ${telemetry.temperature.toFixed(1)}°C.`, kind: 'warning' });
    }

    if (telemetry && telemetry.vibration >= 4) {
      events.push({ id: 'vib', timeLabel: at(46), title: 'AI detected vibration anomaly', description: 'Vibration signature deviated from the learned baseline.', kind: 'anomaly' });
    }

    alerts
      .filter((a) => a.severity !== 'info')
      .slice(0, 2)
      .forEach((a, i) => {
        events.push({ id: `alert-${i}`, timeLabel: at(30 - i * 8), title: a.title, description: a.description, kind: a.severity === 'critical' ? 'anomaly' : 'warning' });
      });

    events.push({ id: 'stabilized', timeLabel: at(21), title: 'Pressure stabilized', description: 'Hydraulic pressure returned to the normal operating band.', kind: 'stabilized' });
    events.push({ id: 'maint', timeLabel: at(5), title: 'Maintenance recommendation generated', description: aiPrediction.narrative, kind: 'maintenance' });

    return events.sort((a, b) => (a.timeLabel < b.timeLabel ? -1 : 1));
  }

  // ── Shared helpers ───────────────────────────────────────────

  private statusOf(value: number, [min, max]: [number, number]): SignalStatus {
    if (value < min * 0.85 || value > max * 1.15) return 'critical';
    if (value < min || value > max) return 'warning';
    return 'normal';
  }

  private trendOf(history: number[]): { trend: TrendDirection; pct: number } {
    if (history.length < 2) return { trend: 'flat', pct: 0 };
    const first = history[0];
    const last = history[history.length - 1];
    const base = Math.abs(first) < 0.001 ? 1 : Math.abs(first);
    const pct = ((last - first) / base) * 100;
    if (Math.abs(pct) < 2) return { trend: 'flat', pct };
    return { trend: pct > 0 ? 'up' : 'down', pct };
  }

  private syntheticHistory(seed: string, current: number, spread: number, points = 8): number[] {
    const rand = (() => {
      let h = 1779033703 ^ seed.length;
      for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return () => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
      };
    })();

    const values: number[] = [];
    let walk = current - spread * (rand() - 0.5) * 2;
    for (let i = 0; i < points - 1; i++) {
      walk += spread * 0.6 * (rand() - 0.5);
      values.push(Number(walk.toFixed(2)));
    }
    values.push(Number(current.toFixed(2)));
    return values;
  }

  private formatTime(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? 'just now' : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
