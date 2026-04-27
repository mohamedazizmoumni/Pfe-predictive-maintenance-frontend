import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, interval, of, Subject } from 'rxjs';
import { catchError, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { Machine, Sensor } from '../../core/models/sentinel.models';
import { EquipmentService } from '../../core/services/equipment.service';
import { PredictiveApiService } from '../../core/services/predictive-api.service';
import {
  MachineFailureReport,
  MachineSimulatedReading,
  SensorDataPoint,
} from '../../core/models/predictive.models';

interface LiveSample {
  timestamp: string;
  temperature: number;
  risk: number;
  utilization: number;
}

interface SensorCard {
  code: string;
  type: string;
  unit: string;
  value: number | null;
  status: string;
  isAnomaly: boolean;
}

interface MarketCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  x: number;
  wickTop: number;
  wickBottom: number;
  bodyTop: number;
  bodyHeight: number;
  bodyWidth: number;
  up: boolean;
}

interface MarketImpulseBar {
  x: number;
  y: number;
  width: number;
  height: number;
  up: boolean;
}

interface ThresholdBand {
  label: 'safe' | 'warning' | 'critical';
  min: number;
  max: number;
}

interface ThresholdBandRect {
  label: 'safe' | 'warning' | 'critical';
  y: number;
  height: number;
}

@Component({
  selector: 'app-machine-visualization',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './machine-visualization.component.html',
  styleUrl: './machine-visualization.component.scss',
})
export class MachineVisualizationComponent implements OnInit, OnDestroy {
  marketMetric: 'temperature' | 'utilization' | 'risk' = 'temperature';
  marketZoom: '1m' | '5m' | '15m' = '5m';
  hoveredCandleIndex: number | null = null;
  crosshairX: number | null = null;
  crosshairY: number | null = null;

  machine: Machine | null = null;
  machineId = '';

  isLoading = true;
  errorMessage = '';
  lastUpdated: string | null = null;

  sensors: SensorCard[] = [];
  latestReading: MachineSimulatedReading | null = null;
  latestReport: MachineFailureReport | null = null;

  temperatureNow = 0;
  utilizationNow = 0;
  riskNow = 0;

  history: LiveSample[] = [];

  readonly marketChartWidth = 700;
  readonly marketChartTop = 14;
  readonly marketChartBottom = 210;
  readonly marketChartBaseY = 266;

  private readonly maxSamples = 320;
  private readonly destroy$ = new Subject<void>();
  private pollingSub: Subscription | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly equipmentService: EquipmentService,
    private readonly predictiveApi: PredictiveApiService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.errorMessage = 'Machine ID is missing.';
        this.isLoading = false;
        return;
      }

      this.machineId = id;
      this.history = [];
      this.startRealtimeFeed();
    });
  }

  ngOnDestroy(): void {
    this.pollingSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshNow(): void {
    if (!this.machineId) {
      return;
    }
    this.loadRealtimeSnapshot(true);
  }

  downloadRapport(): void {
    const machineLabel = this.machine?.name || this.machine?.serialNumber || this.machineId;
    const lines = [
      `Machine Rapport - ${machineLabel}`,
      `Generated At: ${new Date().toISOString()}`,
      '',
      `Model: ${this.machine?.model || 'N/A'}`,
      `Manufacturer: ${this.machine?.manufacturer || 'N/A'}`,
      `Location: ${this.machine?.location || 'N/A'}`,
      `Status: ${this.machine?.status || 'N/A'}`,
      '',
      `Temperature: ${this.temperatureNow.toFixed(1)} C`,
      `Utilisation: ${this.utilizationNow.toFixed(1)} %`,
      `Risk: ${(this.riskNow * 100).toFixed(1)} %`,
      '',
      'Sensors:',
      ...this.sensors.map(
        (sensor) =>
          `- ${sensor.code} (${sensor.type}): ${sensor.value === null ? 'N/A' : sensor.value.toFixed(2)} ${sensor.unit} | ${sensor.status}${sensor.isAnomaly ? ' | ANOMALY' : ''}`
      ),
      '',
      'Recommended action:',
      this.latestReport?.recommendedAction || 'No recommendation available.',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `machine-${this.machineId}-rapport.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  get temperatureChartPoints(): string {
    return this.toPolylinePoints(this.history.map((sample) => sample.temperature), 260, 86);
  }

  get utilizationChartPoints(): string {
    return this.toPolylinePoints(this.history.map((sample) => sample.utilization), 260, 86);
  }

  get riskChartPoints(): string {
    const values = this.history.map((sample) => sample.risk * 100);
    return this.toPolylinePoints(values, 260, 86);
  }

  get riskNowPercent(): number {
    return this.riskNow * 100;
  }

  get reportRiskPercent(): number {
    return this.normalizeRiskToRatio(this.latestReport?.risk ?? this.riskNow) * 100;
  }

  get statusClass(): string {
    const status = (this.machine?.status || 'OFFLINE').toLowerCase();
    return `status-pill ${status}`;
  }

  setMarketMetric(metric: 'temperature' | 'utilization' | 'risk'): void {
    this.marketMetric = metric;
    this.onMarketMouseLeave();
  }

  setMarketZoom(zoom: '1m' | '5m' | '15m'): void {
    this.marketZoom = zoom;
    this.onMarketMouseLeave();
  }

  onMarketMouseMove(event: MouseEvent): void {
    const candles = this.marketCandles;
    if (candles.length === 0) {
      this.onMarketMouseLeave();
      return;
    }

    const { currentTarget } = event;
    if (!(currentTarget instanceof SVGGraphicsElement)) {
      this.onMarketMouseLeave();
      return;
    }

    const box = currentTarget.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) {
      this.onMarketMouseLeave();
      return;
    }

    const relativeX = ((event.clientX - box.left) / box.width) * this.marketChartWidth;
    const clampedX = Math.min(this.marketChartWidth, Math.max(0, relativeX));
    const slotWidth = this.marketChartWidth / Math.max(candles.length, 1);
    const candleIndex = Math.min(candles.length - 1, Math.max(0, Math.floor(clampedX / slotWidth)));
    const candle = candles[candleIndex];

    this.hoveredCandleIndex = candleIndex;
    this.crosshairX = candle.x;
    this.crosshairY = this.toMarketY(candle.close);
  }

  onMarketMouseLeave(): void {
    this.hoveredCandleIndex = null;
    this.crosshairX = null;
    this.crosshairY = null;
  }

  get marketChartTitle(): string {
    if (this.marketMetric === 'temperature') {
      return 'Temperature Price Action';
    }

    if (this.marketMetric === 'utilization') {
      return 'Utilization Price Action';
    }

    return 'Risk Price Action';
  }

  get marketMetricUnit(): string {
    if (this.marketMetric === 'temperature') {
      return 'C';
    }

    return '%';
  }

  get marketCloseValue(): number {
    const values = this.marketSeriesValues;
    return values.length > 0 ? values[values.length - 1] : 0;
  }

  get hoveredCandle(): MarketCandle | null {
    if (this.hoveredCandleIndex === null) {
      return null;
    }

    const candles = this.marketCandles;
    return candles[this.hoveredCandleIndex] ?? null;
  }

  get tooltipX(): number {
    const x = this.crosshairX ?? 0;
    const tooltipWidth = 154;
    if (x > this.marketChartWidth - tooltipWidth - 10) {
      return x - tooltipWidth - 8;
    }

    return x + 8;
  }

  get tooltipY(): number {
    const y = this.crosshairY ?? this.marketChartTop;
    const top = this.marketChartTop + 4;
    const bottom = this.marketChartBottom - 86;
    return Math.min(bottom, Math.max(top, y - 60));
  }

  get thresholdBands(): ThresholdBand[] {
    if (this.marketMetric === 'temperature') {
      return [
        { label: 'safe', min: 0, max: 75 },
        { label: 'warning', min: 75, max: 95 },
        { label: 'critical', min: 95, max: 160 },
      ];
    }

    if (this.marketMetric === 'utilization') {
      return [
        { label: 'safe', min: 0, max: 70 },
        { label: 'warning', min: 70, max: 85 },
        { label: 'critical', min: 85, max: 100 },
      ];
    }

    return [
      { label: 'safe', min: 0, max: 60 },
      { label: 'warning', min: 60, max: 80 },
      { label: 'critical', min: 80, max: 100 },
    ];
  }

  get thresholdBandRects(): ThresholdBandRect[] {
    return this.thresholdBands.map((band) => {
      const yTop = this.toMarketY(band.max);
      const yBottom = this.toMarketY(band.min);

      return {
        label: band.label,
        y: yTop,
        height: Math.max(0, yBottom - yTop),
      };
    });
  }

  get marketChangePercent(): number {
    const values = this.marketSeriesValues;
    if (values.length < 2) {
      return 0;
    }

    const previous = values[values.length - 2];
    const current = values[values.length - 1];
    if (!Number.isFinite(previous) || Math.abs(previous) < 0.0001) {
      return 0;
    }

    return ((current - previous) / Math.abs(previous)) * 100;
  }

  get marketTrendClass(): string {
    return this.marketChangePercent >= 0 ? 'trend trend--up' : 'trend trend--down';
  }

  get marketPathLine(): string {
    const values = this.marketSeriesValues;
    if (values.length < 2) {
      return '';
    }

    const step = this.marketChartWidth / Math.max(values.length - 1, 1);

    return values
      .map((value, index) => {
        const x = index * step;
        const y = this.toMarketY(value);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }

  get marketEmaPath(): string {
    const values = this.marketSeriesValues;
    if (values.length < 2) {
      return '';
    }

    const alpha = 0.28;
    const ema: number[] = [];
    values.forEach((value, index) => {
      if (index === 0) {
        ema.push(value);
        return;
      }

      const previous = ema[index - 1];
      ema.push(alpha * value + (1 - alpha) * previous);
    });

    const step = this.marketChartWidth / Math.max(ema.length - 1, 1);
    return ema
      .map((value, index) => {
        const x = index * step;
        const y = this.toMarketY(value);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }

  get marketAreaPath(): string {
    const values = this.marketSeriesValues;
    if (values.length < 2) {
      return '';
    }

    const step = this.marketChartWidth / Math.max(values.length - 1, 1);

    const points = values.map((value, index) => {
      const x = index * step;
      const y = this.toMarketY(value);
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    });

    return `M ${points[0]} ${points.slice(1).map((point) => `L ${point}`).join(' ')} L ${this.marketChartWidth} ${this.marketChartBottom} L 0 ${this.marketChartBottom} Z`;
  }

  get marketCandles(): MarketCandle[] {
    const values = this.marketSeriesValues;
    const samples = this.marketWindowSamples;
    if (values.length < 2 || samples.length < 2) {
      return [];
    }

    const count = values.length - 1;
    const slot = this.marketChartWidth / Math.max(count, 1);
    const bodyWidth = Math.max(4, Math.min(14, slot * 0.6));

    const candles: MarketCandle[] = [];

    for (let index = 1; index < values.length; index += 1) {
      const open = values[index - 1];
      const close = values[index];
      const direction = close - open;
      const noiseSeed = Math.sin(index * 1.73 + close * 0.01);
      const wickPad = Math.max(
        Math.abs(direction) * 0.7,
        this.marketMetric === 'temperature' ? 0.9 : 0.35
      );
      const high = Math.min(this.marketMetricMax, Math.max(open, close) + wickPad + Math.abs(noiseSeed) * wickPad * 0.45);
      const low = Math.max(this.marketMetricMin, Math.min(open, close) - wickPad - Math.abs(noiseSeed) * wickPad * 0.45);

      const centerX = (index - 0.5) * slot;
      const openY = this.toMarketY(open);
      const closeY = this.toMarketY(close);
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(closeY - openY));

      candles.push({
        timestamp: samples[index].timestamp,
        open,
        high,
        low,
        close,
        x: centerX,
        wickTop: this.toMarketY(high),
        wickBottom: this.toMarketY(low),
        bodyTop,
        bodyHeight,
        bodyWidth,
        up: close >= open,
      });
    }

    return candles;
  }

  get marketImpulseBars(): MarketImpulseBar[] {
    const values = this.marketSeriesValues;
    if (values.length < 2) {
      return [];
    }

    const maxBarHeight = 48;
    const count = values.length - 1;
    const slot = this.marketChartWidth / Math.max(count, 1);
    const barWidth = Math.max(3, Math.min(10, slot * 0.52));
    const deltas = values.slice(1).map((value, index) => value - values[index]);
    const maxAbsDelta = Math.max(...deltas.map((delta) => Math.abs(delta)), 0.0001);

    return deltas.map((delta, index) => {
      const normalizedHeight = (Math.abs(delta) / maxAbsDelta) * maxBarHeight;
      const height = Math.max(2, normalizedHeight);
      const centerX = (index + 0.5) * slot;

      return {
        x: centerX - barWidth / 2,
        y: this.marketChartBaseY - height,
        width: barWidth,
        height,
        up: delta >= 0,
      };
    });
  }

  private startRealtimeFeed(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.pollingSub?.unsubscribe();
    this.pollingSub = interval(1200)
      .pipe(
        startWith(0),
        switchMap(() => this.loadRealtimeSnapshot()),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private loadRealtimeSnapshot(forceLoading = false) {
    if (forceLoading) {
      this.isLoading = true;
    }

    const numericMachineId = Number(this.machineId);
    const canUsePredictiveMachineId = Number.isFinite(numericMachineId);

    return forkJoin({
      machine: this.equipmentService
        .getMachine(this.machineId)
        .pipe(catchError(() => of(null))),
      sensors: this.equipmentService
        .getSensors(this.machineId)
        .pipe(catchError(() => of([] as Sensor[]))),
      readings: canUsePredictiveMachineId
        ? this.predictiveApi
            .getSimulatedReadings()
            .pipe(catchError(() => of([] as MachineSimulatedReading[])))
        : of([] as MachineSimulatedReading[]),
      sensorData: canUsePredictiveMachineId
        ? this.predictiveApi
            .getSensorData({
              machineId: numericMachineId,
              page: 0,
              size: 20,
              sort: 'timestamp,desc',
            })
            .pipe(catchError(() => of({ content: [] as SensorDataPoint[] } as any)))
        : of({ content: [] as SensorDataPoint[] } as any),
      reports: canUsePredictiveMachineId
        ? this.predictiveApi
            .getFailureReports({
              machineId: numericMachineId,
              page: 0,
              size: 1,
              sort: 'createdAt,desc',
            })
            .pipe(catchError(() => of({ content: [] as MachineFailureReport[] } as any)))
        : of({ content: [] as MachineFailureReport[] } as any),
    }).pipe(
      switchMap((response) => {
        if (!response.machine) {
          this.errorMessage = 'Machine not found or backend unavailable.';
          this.isLoading = false;
          return of(null);
        }

        this.machine = response.machine;
        this.latestReading = this.extractLatestReading(response.readings, numericMachineId);
        this.latestReport = response.reports.content?.[0] || null;

        const sensorDataPoints = (response.sensorData.content || []) as SensorDataPoint[];
        this.sensors = this.buildSensorCards(response.sensors, sensorDataPoints, this.latestReading);

        const previous = this.history[this.history.length - 1];
        const rawTemperature = this.resolveTemperature(this.latestReading, sensorDataPoints);
        const rawRisk = this.normalizeRiskToRatio(this.latestReading?.risk ?? this.latestReport?.risk ?? 0);
        const rawUtilization = this.resolveUtilization(this.machine, this.latestReading);

        this.temperatureNow = this.smoothDynamicValue(rawTemperature, previous?.temperature, {
          min: 0,
          max: 200,
          epsilon: 0.6,
          driftAmplitude: 1.8,
        });
        this.riskNow = this.smoothDynamicValue(rawRisk, previous?.risk, {
          min: 0,
          max: 1,
          epsilon: 0.001,
          driftAmplitude: 0.02,
        });
        this.utilizationNow = this.smoothDynamicValue(rawUtilization, previous?.utilization, {
          min: 0,
          max: 100,
          epsilon: 0.05,
          driftAmplitude: 1.5,
        });

        this.pushReactiveSamples({
          timestamp: new Date().toISOString(),
          temperature: this.temperatureNow,
          risk: this.riskNow,
          utilization: this.utilizationNow,
        });

        this.lastUpdated = new Date().toISOString();
        this.errorMessage = '';
        this.isLoading = false;

        return of(null);
      }),
      catchError(() => {
        this.errorMessage = 'Failed to load machine live data.';
        this.isLoading = false;
        return of(null);
      })
    );
  }

  private extractLatestReading(
    readings: MachineSimulatedReading[],
    numericMachineId: number
  ): MachineSimulatedReading | null {
    if (!Number.isFinite(numericMachineId)) {
      return null;
    }

    return (
      readings
        .filter((item) => item.machineId === numericMachineId)
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0] || null
    );
  }

  private buildSensorCards(
    sensors: Sensor[],
    sensorData: SensorDataPoint[],
    reading: MachineSimulatedReading | null
  ): SensorCard[] {
    const cards = new Map<string, SensorCard>();

    sensors.forEach((sensor) => {
      cards.set(sensor.code, {
        code: sensor.code,
        type: sensor.sensorType || 'UNKNOWN',
        unit: sensor.unit || '',
        value: sensor.lastReading ?? null,
        status: sensor.status || 'UNKNOWN',
        isAnomaly: false,
      });
    });

    sensorData.forEach((point) => {
      const key = point.sensorCode || point.sensorName || `SENSOR-${point.id}`;
      const existing = cards.get(key);

      cards.set(key, {
        code: key,
        type: point.sensorType || existing?.type || 'UNKNOWN',
        unit: point.unit || existing?.unit || '',
        value: point.value,
        status: existing?.status || 'ACTIVE',
        isAnomaly: point.isAnomaly,
      });
    });

    if (reading?.sensorValues) {
      Object.entries(reading.sensorValues).forEach(([code, value]) => {
        const existing = cards.get(code);
        cards.set(code, {
          code,
          type: existing?.type || this.guessSensorType(code),
          unit: existing?.unit || this.guessSensorUnit(code),
          value,
          status: existing?.status || 'ACTIVE',
          isAnomaly: existing?.isAnomaly || false,
        });
      });
    }

    return Array.from(cards.values()).slice(0, 12);
  }

  private resolveTemperature(
    reading: MachineSimulatedReading | null,
    points: SensorDataPoint[]
  ): number {
    if (reading?.sensorValues) {
      const tempValue =
        reading.sensorValues['temperature'] ??
        reading.sensorValues['TEMPERATURE'] ??
        reading.sensorValues['temp'] ??
        reading.sensorValues['TEMP'];

      if (typeof tempValue === 'number') {
        return tempValue;
      }
    }

    const temperaturePoint = points.find((point) => {
      const code = (point.sensorCode || '').toLowerCase();
      const type = (point.sensorType || '').toLowerCase();
      return code.includes('temp') || type.includes('temp');
    });

    if (temperaturePoint) {
      return temperaturePoint.value;
    }

    return 0;
  }

  private resolveUtilization(machine: Machine, reading: MachineSimulatedReading | null): number {
    const fromUsage = typeof reading?.usageHours === 'number'
      ? Math.min(100, Math.max(0, (reading.usageHours % 24) * (100 / 24)))
      : null;

    if (fromUsage !== null) {
      return fromUsage;
    }

    const baseByStatus: Record<string, number> = {
      OPERATIONAL: 86,
      MAINTENANCE: 42,
      OFFLINE: 12,
      DECOMMISSIONED: 4,
    };

    return baseByStatus[machine.status] ?? 35;
  }

  private normalizeRiskToRatio(value: number): number {
    const numeric = Number.isFinite(value) ? value : 0;
    const ratio = numeric > 1 ? numeric / 100 : numeric;
    return Math.min(1, Math.max(0, ratio));
  }

  private get marketWindowSamples(): LiveSample[] {
    if (this.history.length === 0) {
      return [];
    }

    const minutesByZoom: Record<'1m' | '5m' | '15m', number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
    };

    const lookbackMinutes = minutesByZoom[this.marketZoom];
    const newestTimestamp = Date.parse(this.history[this.history.length - 1].timestamp);
    if (!Number.isFinite(newestTimestamp)) {
      return this.history;
    }

    const cutoff = newestTimestamp - lookbackMinutes * 60 * 1000;
    const filtered = this.history.filter((sample) => {
      const timestamp = Date.parse(sample.timestamp);
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });

    if (filtered.length >= 2) {
      return filtered;
    }

    return this.history.slice(-Math.min(this.history.length, 30));
  }

  private get marketSeriesValues(): number[] {
    if (this.marketMetric === 'temperature') {
      return this.marketWindowSamples.map((sample) => sample.temperature);
    }

    if (this.marketMetric === 'utilization') {
      return this.marketWindowSamples.map((sample) => sample.utilization);
    }

    return this.marketWindowSamples.map((sample) => sample.risk * 100);
  }

  private get marketMetricMax(): number {
    return this.marketMetricBounds.max;
  }

  private get marketMetricMin(): number {
    return this.marketMetricBounds.min;
  }

  private get marketMetricBounds(): { min: number; max: number } {
    const values = this.marketSeriesValues.filter((value) => Number.isFinite(value));

    const defaults =
      this.marketMetric === 'temperature'
        ? { min: 0, max: 200 }
        : { min: 0, max: 100 };

    if (values.length < 2) {
      return defaults;
    }

    const observedMin = Math.min(...values);
    const observedMax = Math.max(...values);

    if (!Number.isFinite(observedMin) || !Number.isFinite(observedMax)) {
      return defaults;
    }

    const minSpanByMetric: Record<'temperature' | 'utilization' | 'risk', number> = {
      temperature: 10,
      utilization: 8,
      risk: 6,
    };

    const hardMaxByMetric: Record<'temperature' | 'utilization' | 'risk', number> = {
      temperature: 220,
      utilization: 100,
      risk: 100,
    };

    const minSpan = minSpanByMetric[this.marketMetric];
    const span = Math.max(minSpan, observedMax - observedMin);
    const padding = Math.max(span * 0.22, minSpan * 0.25);

    let min = observedMin - padding;
    let max = observedMax + padding;

    min = Math.max(0, min);
    max = Math.min(hardMaxByMetric[this.marketMetric], max);

    if (max - min < minSpan) {
      const center = (max + min) / 2;
      min = Math.max(0, center - minSpan / 2);
      max = Math.min(hardMaxByMetric[this.marketMetric], center + minSpan / 2);
    }

    if (max <= min) {
      return defaults;
    }

    return { min, max };
  }

  private toMarketY(value: number): number {
    const clamped = Math.max(this.marketMetricMin, Math.min(this.marketMetricMax, value));
    const range = this.marketMetricMax - this.marketMetricMin || 1;
    const normalized = (clamped - this.marketMetricMin) / range;
    return this.marketChartBottom - normalized * (this.marketChartBottom - this.marketChartTop);
  }

  private smoothDynamicValue(
    next: number,
    previous: number | undefined,
    options: { min: number; max: number; epsilon: number; driftAmplitude: number }
  ): number {
    const clampedNext = Math.min(options.max, Math.max(options.min, next));

    if (previous === undefined) {
      return clampedNext;
    }

    if (Math.abs(clampedNext - previous) > options.epsilon) {
      return Math.min(options.max, Math.max(options.min, previous * 0.4 + clampedNext * 0.6));
    }

    const drift = (Math.random() - 0.5) * options.driftAmplitude;
    return Math.min(options.max, Math.max(options.min, previous + drift));
  }

  private pushSample(sample: LiveSample): void {
    this.history = [...this.history, sample].slice(-this.maxSamples);
  }

  private pushReactiveSamples(target: LiveSample): void {
    const previous = this.history[this.history.length - 1];
    if (!previous) {
      this.pushSample(target);
      return;
    }

    const bridgePoints = 2;
    for (let index = 1; index <= bridgePoints; index += 1) {
      const ratio = index / (bridgePoints + 1);
      const pulse = (Math.random() - 0.5) * (1 - ratio);

      this.pushSample({
        timestamp: new Date(Date.now() - (bridgePoints - index + 1) * 180).toISOString(),
        temperature: this.clampMetric(
          previous.temperature + (target.temperature - previous.temperature) * ratio + pulse * 3.2,
          0,
          220
        ),
        utilization: this.clampMetric(
          previous.utilization + (target.utilization - previous.utilization) * ratio + pulse * 3,
          0,
          100
        ),
        risk: this.clampMetric(
          previous.risk + (target.risk - previous.risk) * ratio + pulse * 0.018,
          0,
          1
        ),
      });
    }

    this.pushSample(target);
  }

  private clampMetric(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private toPolylinePoints(values: number[], width: number, height: number): string {
    if (values.length === 0) {
      return '';
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  private guessSensorType(code: string): string {
    const c = code.toLowerCase();
    if (c.includes('temp')) {
      return 'TEMPERATURE';
    }
    if (c.includes('vib')) {
      return 'VIBRATION';
    }
    if (c.includes('press')) {
      return 'PRESSURE';
    }
    if (c.includes('power')) {
      return 'POWER';
    }
    return 'GENERIC';
  }

  private guessSensorUnit(code: string): string {
    const c = code.toLowerCase();
    if (c.includes('temp')) {
      return 'C';
    }
    if (c.includes('vib')) {
      return 'mm/s';
    }
    if (c.includes('press')) {
      return 'bar';
    }
    if (c.includes('power')) {
      return 'kW';
    }
    return '';
  }
}
