import { AfterViewInit, Component, ElementRef, Inject, NgZone, OnInit, OnDestroy, PLATFORM_ID, ViewChild, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { jsPDF } from 'jspdf';
import { Chart } from 'chart.js/auto';
import type { ChartConfiguration } from 'chart.js';
import { EquipmentService } from '../../core/services/equipment.service';
import { FinanceService } from '../../core/services/finance.service';
import { ExpenseReportResponse, Machine, Maintenance } from '../../core/models/sentinel.models';
import { MachineWebSocketService, MachineTelemetry, EnvironmentReading } from '../../core/services/machine-websocket.service';
import { MaintenanceService, MaintenanceResponse } from '../../core/services/maintenance.service';
import { ThemeService } from '../../core/services/theme.service';
import { xScale, yScale, legendColor, tooltipTheme } from '../../shared/charts/chart-theme';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, filter, map, takeUntil } from 'rxjs/operators';
import { DigitalTwinIntelligenceService } from './digital-twin/digital-twin-intelligence.service';
import {
  AiPrediction,
  AnatomyMode,
  CameraViewMode,
  ComponentTone,
  MachineArchetype,
  MachineHealthRing,
  MaintenanceOverlayItem,
  SensorPoint,
  TelemetryOrbitCard,
  TwinComponentDetail,
  TwinComponentKey,
  TwinTimelineEvent,
} from './digital-twin/digital-twin.types';
import { MachineIllustrationComponent } from './digital-twin/components/machine-illustration/machine-illustration.component';
import { SensorOverlayComponent } from './digital-twin/components/sensor-overlay.component';
import { HealthRingComponent } from './digital-twin/components/health-ring.component';
import { TelemetryOrbitCardsComponent } from './digital-twin/components/telemetry-orbit-cards.component';
import { ComponentDetailPanelComponent } from './digital-twin/components/component-detail-panel.component';
import { TwinControlsComponent } from './digital-twin/components/twin-controls.component';
import { AiPredictionsPanelComponent } from './digital-twin/components/ai-predictions-panel.component';
import { TwinEventTimelineComponent } from './digital-twin/components/twin-event-timeline.component';
import { CollapsibleSectionComponent } from './digital-twin/components/collapsible-section.component';
import { MachineCommentsComponent } from './digital-twin/components/machine-comments.component';
import { MachineTimelineComponent } from './digital-twin/components/machine-timeline.component';
import { MachineQrCodeComponent } from './digital-twin/components/machine-qr-code.component';
import { PredictionExplanationComponent } from './digital-twin/components/prediction-explanation.component';

interface TelemetrySnapshot {
  timestamp: string;
  temperature: number;
  vibration: number;
  health: number;
  utilization: number;
  oee: number;
  performance: number;
  pressure: number;
  powerConsumption: number;
  rotationSpeed: number;
}

type TelemetryMetricKey = keyof Pick<TelemetrySnapshot, 'temperature' | 'vibration' | 'health' | 'utilization' | 'oee' | 'performance' | 'rotationSpeed'>;

interface AlertInsight {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  ageLabel: string;
}

interface MaintenanceQueueItem {
  title: string;
  schedule: string;
  priority: 'high' | 'medium' | 'low';
}

interface HealthComponentItem {
  label: string;
  value: number;
  tone: 'green' | 'blue' | 'amber' | 'purple';
}

@Component({
  selector: 'app-machine-visualization',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    MachineIllustrationComponent,
    SensorOverlayComponent,
    HealthRingComponent,
    TelemetryOrbitCardsComponent,
    ComponentDetailPanelComponent,
    TwinControlsComponent,
    AiPredictionsPanelComponent,
    TwinEventTimelineComponent,
    CollapsibleSectionComponent,
    MachineCommentsComponent,
    MachineTimelineComponent,
    MachineQrCodeComponent,
    PredictionExplanationComponent,
  ],
  templateUrl: './machine-visualization.component.html',
  styleUrl: './machine-visualization.component.scss',
})
export class MachineVisualizationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('temperatureCanvas') private temperatureCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('vibrationCanvas') private vibrationCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('efficiencyCanvas') private efficiencyCanvasRef?: ElementRef<HTMLCanvasElement>;

  private temperatureChart?: Chart;
  private vibrationChart?: Chart;
  private efficiencyChart?: Chart;
  private readonly isBrowser: boolean;

  machine: Machine | null = null;
  isLoading = true;
  errorMessage: string | null = null;
  /** True when the backend returned 403 — the technician isn't assigned to this machine. */
  accessDenied = false;

  // Real-time metrics - ONLY updated from backend WebSocket
  temperature = 0;
  vibration = 0;
  health = 0;
  utilization = 0;
  oee = 0;
  performance = 0;
  pressure = 0;
  powerConsumption = 0;
  rotationSpeed = 0;
  ambientTemperature = 0;
  loadFactor = 0;
  operatingHoursLive = 0;
  lastUpdated: Date = new Date();

  // Real environmental sensor readings (e.g. ESP32 + DHT11), independent of
  // the simulated telemetry stream above — null until a reading exists.
  envTemperature: number | null = null;
  envHumidity: number | null = null;
  envRiskLevel: EnvironmentReading['riskLevel'] | null = null;
  envRecommendations: string[] = [];
  envLastUpdated: Date | null = null;

  telemetryHistory: TelemetrySnapshot[] = [];
  private readonly sparklineWidth = 260;
  private readonly sparklineHeight = 72;
  private readonly telemetryHistoryCap = 60;

  /** How many recent live samples to chart — this session's real buffer, not a fabricated historical range. */
  readonly telemetryWindowOptions: { label: string; value: number }[] = [
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: 'All', value: 0 },
  ];
  selectedTelemetryWindow = 10;

  /** First-seen timestamp (ms) per active alert condition, so "Xm ago" reflects real elapsed time instead of hardcoded strings. */
  private alertFirstSeenAt: Record<string, number> = {};
  
  // WebSocket connection status
  isConnected = false;
  isGeneratingRapport = false;
  
  private destroy$ = new Subject<void>();
  private machineId: string | null = null;
  // Finance tab state
  selectedTab: 'overview' | 'finance' = 'overview';
  machineExpenses: ExpenseReportResponse[] = [];
  machineExpensesLoading = false;
  machineExpensesError: string | null = null;
  financeTabLoaded = false;

  // ── Digital twin state ───────────────────────────────────
  /** Full raw telemetry payload — the many derived fields above only keep a
   *  handful of flattened numbers, but the twin service needs the complete
   *  backend shape (current, voltage, bearingWear, remainingUsefulLife...). */
  latestTelemetry: MachineTelemetry | null = null;
  anatomyMode: AnatomyMode = 'physical';
  cameraMode: CameraViewMode = 'digitalTwin';
  heatmapOn = false;
  highlightedComponent: TwinComponentKey | null = null;

  constructor(
    private route: ActivatedRoute,
    private equipmentService: EquipmentService,
    private wsService: MachineWebSocketService,
    private cdr: ChangeDetectorRef
    , private financeService: FinanceService
    , private maintenanceService: MaintenanceService
    , private twinService: DigitalTwinIntelligenceService
    , private themeService: ThemeService
    , private ngZone: NgZone
    , @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Chart.js configs bake colors into plain JS objects, not CSS — they need to
    // be rebuilt (not just re-painted via stylesheet) whenever the app theme
    // toggles, so axis/grid/legend text and line colors stay legible in both modes.
    effect(() => {
      this.themeService.theme();
      if (this.isBrowser && (this.temperatureChart || this.vibrationChart || this.efficiencyChart)) {
        this.destroyTrendCharts();
        this.initTrendCharts();
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.machineId = params.get('id');
      if (this.machineId) {
        this.loadMachine(this.machineId);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initTrendCharts();
  }

  selectTab(tab: 'overview' | 'finance'): void {
    this.selectedTab = tab;
    if (tab === 'finance') {
      this.loadMachineExpenses();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsService.unsubscribeFromEnvironment();
    this.wsService.disconnect();
    this.destroyTrendCharts();
  }

  private destroyTrendCharts(): void {
    this.temperatureChart?.destroy();
    this.vibrationChart?.destroy();
    this.efficiencyChart?.destroy();
    this.temperatureChart = undefined;
    this.vibrationChart = undefined;
    this.efficiencyChart = undefined;
  }

  private loadMachine(machineId: string): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.accessDenied = false;

    this.equipmentService
      .getMachine(machineId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (machine) => {
          this.machine = machine;
          this.isLoading = false;
          this.connectToWebSocket();
        },
        error: (error) => {
          this.isLoading = false;

          if (error?.status === 403) {
            this.accessDenied = true;
            this.errorMessage =
              error?.error?.message || 'You are not assigned to this machine.';
          } else {
            this.errorMessage = 'Failed to load machine details';
          }
        },
      });
  }

  /**
   * Connect to WebSocket and subscribe to real-time machine telemetry from backend.
   * NO fake data generation - all values come from backend.
   */
  private connectToWebSocket(): void {
    // Connect to WebSocket server
    this.wsService.connect();
    
    // Monitor connection status
    this.wsService.connected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.isConnected = connected;
        this.updateAlertTracking();
      });
    
    // Subscribe to telemetry updates from backend
    this.wsService.telemetry$
      .pipe(
        takeUntil(this.destroy$),
        filter((telemetry): telemetry is MachineTelemetry => telemetry !== null),
        filter(telemetry => telemetry.machineId === Number(this.machineId))
      )
      .subscribe(telemetry => {
        this.latestTelemetry = telemetry;

        // Update metrics directly from backend data
        // NO modification, NO simulation, NO fake data
        this.temperature = telemetry.temperature;
        this.vibration = telemetry.vibration;
        this.health = telemetry.health;
        this.pressure = telemetry.pressure ?? this.pressure;
        this.powerConsumption = telemetry.powerConsumption ?? this.powerConsumption;
        this.rotationSpeed = telemetry.rotationSpeed ?? this.rotationSpeed;
        this.ambientTemperature = telemetry.ambientTemperature ?? this.ambientTemperature;
        this.loadFactor = telemetry.loadFactor ?? this.loadFactor;
        this.operatingHoursLive = telemetry.operatingHours ?? this.operatingHoursLive;

        // Map backend fields to UI properties — backend uses different field names.
        // Utilization: Backend sends "efficiency" (0-100 scale)
        if (telemetry.efficiency !== undefined) {
          this.utilization = telemetry.efficiency;
        }

        // OEE: Backend sends "efficiencyScore" (0-100 scale)
        if (telemetry.efficiencyScore !== undefined) {
          this.oee = telemetry.efficiencyScore;
        }

        // Performance: Backend sends "rotationSpeed" (RPM), converted to a 0-100 scale (max 1000 RPM)
        if (telemetry.rotationSpeed !== undefined) {
          this.performance = Math.min((telemetry.rotationSpeed / 1000) * 100, 100);
        }

        this.lastUpdated = new Date(telemetry.timestamp);

        this.updateAlertTracking();
        // Manually trigger change detection to ensure UI updates
        this.recordTelemetrySnapshot(telemetry);
        this.refreshTrendCharts();
        this.cdr.detectChanges();
      });

    this.connectToEnvironmentStream();
  }

  /**
   * Real environmental sensor readings (e.g. ESP32 + DHT11), fetched once via
   * REST for the current value, then kept live over the per-machine
   * /topic/machines/{id}/environment WebSocket topic. Fully independent of
   * the simulated telemetry stream above.
   */
  private connectToEnvironmentStream(): void {
    if (!this.machineId) {
      return;
    }

    this.equipmentService
      .getLatestEnvironment(this.machineId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((reading) => {
        if (reading) {
          this.applyEnvironmentReading(reading);
        }
      });

    this.wsService.subscribeToEnvironment(Number(this.machineId));
    this.wsService.environment$
      .pipe(
        takeUntil(this.destroy$),
        filter((reading): reading is EnvironmentReading => reading !== null),
        filter((reading) => reading.machineId === Number(this.machineId))
      )
      .subscribe((reading) => {
        this.applyEnvironmentReading(reading);
        this.cdr.detectChanges();
      });
  }

  private applyEnvironmentReading(reading: EnvironmentReading): void {
    this.envTemperature = reading.temperature;
    this.envHumidity = reading.humidity;
    this.envRiskLevel = reading.riskLevel;
    this.envRecommendations = reading.recommendations ?? [];
    this.envLastUpdated = new Date(reading.timestamp);
  }

  get machineTotalApprovedSpend(): number {
    return this.machineExpenses.filter(e => e.status === 'APPROVED').reduce((s, e) => s + (e.amount || 0), 0);
  }

  get hydraulicPressure(): number {
    if (this.pressure > 0) {
      return this.pressure;
    }

    return Number((2.2 + (this.utilization / 100) * 1.8 + this.vibration * 0.05).toFixed(1));
  }

  get energyConsumption(): number {
    if (this.powerConsumption > 0) {
      return this.powerConsumption;
    }

    return Math.round(90 + this.performance * 0.7 + this.utilization * 0.3);
  }

  get rpmSpeed(): number {
    if (this.rotationSpeed > 0) {
      return this.rotationSpeed;
    }

    return Math.round(this.performance * 32);
  }

  get operatingHoursValue(): number {
    return this.operatingHoursLive || this.machine?.operatingHours || 0;
  }

  get healthStatusLabel(): string {
    if (this.health >= 80) {
      return 'Excellent';
    }

    if (this.health >= 65) {
      return 'Good';
    }

    if (this.health >= 45) {
      return 'Watch';
    }

    return 'Critical';
  }

  get healthComponents(): HealthComponentItem[] {
    const mechanical = Math.max(0, Math.min(100, Math.round(this.health)));
    const electrical = Math.max(0, Math.min(100, Math.round((this.utilization * 0.6) + (this.oee * 0.4))));
    const hydraulic = Math.max(0, Math.min(100, Math.round(100 - Math.abs(this.hydraulicPressure - 140) * 2.4)));
    const control = Math.max(0, Math.min(100, Math.round((this.oee * 0.55) + (this.performance * 0.45))));

    return [
      { label: 'Mechanical', value: mechanical, tone: 'green' },
      { label: 'Electrical', value: electrical, tone: 'blue' },
      { label: 'Hydraulic', value: hydraulic, tone: 'amber' },
      { label: 'Control System', value: control, tone: 'purple' },
    ];
  }

  get operationState(): string {
    if (!this.isConnected) {
      return 'OFFLINE';
    }

    if (this.health >= 65) {
      return 'RUNNING';
    }

    if (this.health >= 40) {
      return 'DEGRADED';
    }

    return 'AT RISK';
  }

  get maintenanceRiskLevel(): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (!this.isConnected || this.temperature >= 85 || this.vibration >= 7 || this.health < 35) {
      return 'HIGH';
    }

    if (this.temperature >= 72 || this.vibration >= 4 || this.health < 60) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  get failureProbability(): number {
    const probability =
      100 - this.health * 0.7 +
      this.vibration * 3.8 +
      Math.max(0, this.temperature - 45) * 0.55;

    return Math.min(99, Math.max(1, Math.round(probability)));
  }

  get downtimeTodayHours(): number {
    const value = (100 - this.utilization) / 18;
    return Number(Math.max(0.2, value).toFixed(1));
  }

  get shiftOutput(): number {
    return Math.max(0, Math.round(this.performance * 24));
  }

  get activeAlerts(): AlertInsight[] {
    const alerts: AlertInsight[] = [];

    if (!this.isConnected) {
      alerts.push({
        severity: 'critical',
        title: 'Telemetry Stream Interrupted',
        description: 'No real-time packets are currently arriving from the machine.',
        ageLabel: this.formatAgeLabel('disconnected'),
      });
    }

    if (this.temperature >= 80) {
      alerts.push({
        severity: 'critical',
        title: 'High Temperature Detected',
        description: 'Thermal readings are above the recommended safe envelope.',
        ageLabel: this.formatAgeLabel('highTemp'),
      });
    } else if (this.temperature >= 68) {
      alerts.push({
        severity: 'warning',
        title: 'Temperature Drift',
        description: 'Thermal baseline is trending upward and should be observed.',
        ageLabel: this.formatAgeLabel('tempDrift'),
      });
    }

    if (this.vibration >= 5) {
      alerts.push({
        severity: 'warning',
        title: 'Abnormal Vibration',
        description: 'Mechanical imbalance is likely and bearing inspection is advised.',
        ageLabel: this.formatAgeLabel('vibration'),
      });
    }

    if (this.maintenanceRiskLevel !== 'LOW') {
      alerts.push({
        severity: 'info',
        title: 'Maintenance Planned',
        description: 'A preventive intervention should be scheduled in the next cycle.',
        ageLabel: this.formatAgeLabel('maintenancePlanned'),
      });
    }

    if (!alerts.length) {
      alerts.push({
        severity: 'info',
        title: 'System Stable',
        description: 'All major telemetry indicators are inside normal operating range.',
        ageLabel: 'now',
      });
    }

    return alerts.slice(0, 4);
  }

  /**
   * Called once per telemetry tick (and on connect/disconnect) to record when each
   * alert condition first became true this session. activeAlerts() only reads from
   * this map — it never mutates state itself, since it's evaluated as a getter.
   */
  private updateAlertTracking(): void {
    const now = Date.now();
    const conditions: Record<string, boolean> = {
      disconnected: !this.isConnected,
      highTemp: this.temperature >= 80,
      tempDrift: this.temperature < 80 && this.temperature >= 68,
      vibration: this.vibration >= 5,
      maintenancePlanned: this.maintenanceRiskLevel !== 'LOW',
    };

    for (const [key, active] of Object.entries(conditions)) {
      if (active) {
        if (!this.alertFirstSeenAt[key]) {
          this.alertFirstSeenAt[key] = now;
        }
      } else {
        delete this.alertFirstSeenAt[key];
      }
    }
  }

  private formatAgeLabel(conditionKey: string): string {
    const since = this.alertFirstSeenAt[conditionKey];
    if (!since) {
      return 'now';
    }

    const diffMin = Math.floor((Date.now() - since) / 60000);
    if (diffMin < 1) {
      return 'just now';
    }
    if (diffMin < 60) {
      return `${diffMin}m ago`;
    }
    return `${Math.floor(diffMin / 60)}h ago`;
  }

  /** Location/zone shown in the command header — real machine data, not a placeholder. */
  get zoneLabel(): string {
    if (!this.machine) {
      return 'Location unassigned';
    }
    return [this.machine.location, this.machine.category].filter(Boolean).join(' · ') || 'Location unassigned';
  }

  setTelemetryWindow(value: number): void {
    this.selectedTelemetryWindow = value;
    this.refreshTrendCharts();
  }

  /** The slice of telemetryHistory actually being charted — keeps the axis labels honest with the selected window. */
  get visibleTelemetryHistory(): TelemetrySnapshot[] {
    return this.selectedTelemetryWindow > 0
      ? this.telemetryHistory.slice(0, this.selectedTelemetryWindow)
      : this.telemetryHistory;
  }

  // ════════════════════════════════════════════════════════
  // TELEMETRY TREND CHARTS
  // Three live Chart.js small-multiples instead of one chart
  // overlaying four differently-scaled metrics on a single axis
  // (temperature °C, vibration mm/s, and two 0–100 percentages
  // were previously all independently re-normalized onto one
  // 0–180 viewBox, which made a 1°C wobble look as dramatic as
  // a 50-point OEE swing). Utilization and OEE share one chart
  // because they're both 0–100% — a legitimate same-axis pairing.
  // ════════════════════════════════════════════════════════

  private get chronologicalHistory(): TelemetrySnapshot[] {
    return [...this.visibleTelemetryHistory].reverse();
  }

  private formatChartTime(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private getChartPalette(isDark: boolean): { danger: string; amber: string; cyan: string; blue: string } {
    return isDark
      ? { danger: '#ef4444', amber: '#f59e0b', cyan: '#199e70', blue: '#3987e5' }
      : { danger: '#dc2626', amber: '#d97706', cyan: '#1baf7a', blue: '#2a78d6' };
  }

  private hexToRgba(hex: string, alpha: number): string {
    const value = hex.replace('#', '');
    const r = parseInt(value.substring(0, 2), 16);
    const g = parseInt(value.substring(2, 4), 16);
    const b = parseInt(value.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private buildLineDataset(color: string, data: number[], label?: string) {
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: this.hexToRgba(color, 0.14),
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: color,
      borderWidth: 2,
    };
  }

  private buildTrendOptions(isDark: boolean, withLegend: boolean, yBounds?: { min: number; max: number }): ChartConfiguration<any>['options'] {
    const x = xScale(isDark);
    const y = yScale(isDark);
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: withLegend
          ? { display: true, position: 'top', align: 'end', labels: { color: legendColor(isDark), boxWidth: 10, font: { size: 11 } } }
          : { display: false },
        tooltip: tooltipTheme(isDark),
      },
      scales: {
        x: { ...x, ticks: { ...x.ticks, maxTicksLimit: 6 } },
        y: yBounds ? { ...y, min: yBounds.min, max: yBounds.max } : y,
      },
    };
  }

  // Chart.js runs its own animation loop on requestAnimationFrame. If that loop
  // runs inside Angular's zone, zone.js treats every single animation frame (of
  // three simultaneous chart animations) as an async task that must be followed
  // by a full change-detection pass over this whole (getter-heavy) template —
  // which is what was freezing the page on live telemetry. Everything chart-
  // related is created/updated/destroyed outside the zone so Chart.js can paint
  // on its own without kicking off Angular change detection at 60fps.

  private initTrendCharts(): void {
    if (!this.isBrowser) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      const isDark = this.themeService.theme() === 'dark';
      const palette = this.getChartPalette(isDark);
      const points = this.chronologicalHistory;
      const labels = points.map((p) => this.formatChartTime(p.timestamp));

      if (this.temperatureCanvasRef) {
        this.temperatureChart = new Chart(this.temperatureCanvasRef.nativeElement, {
          type: 'line',
          data: { labels, datasets: [this.buildLineDataset(palette.danger, points.map((p) => p.temperature))] },
          options: this.buildTrendOptions(isDark, false),
        });
      }

      if (this.vibrationCanvasRef) {
        this.vibrationChart = new Chart(this.vibrationCanvasRef.nativeElement, {
          type: 'line',
          data: { labels, datasets: [this.buildLineDataset(palette.amber, points.map((p) => p.vibration))] },
          options: this.buildTrendOptions(isDark, false),
        });
      }

      if (this.efficiencyCanvasRef) {
        this.efficiencyChart = new Chart(this.efficiencyCanvasRef.nativeElement, {
          type: 'line',
          data: {
            labels,
            datasets: [
              this.buildLineDataset(palette.cyan, points.map((p) => p.utilization), 'Utilization %'),
              this.buildLineDataset(palette.blue, points.map((p) => p.oee), 'OEE %'),
            ],
          },
          options: this.buildTrendOptions(isDark, true, { min: 0, max: 100 }),
        });
      }
    });
  }

  /** Called on every telemetry tick and whenever the sample window changes — pushes new data with a smooth animated transition instead of re-creating the charts. */
  private refreshTrendCharts(): void {
    if (!this.isBrowser) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      const points = this.chronologicalHistory;
      const labels = points.map((p) => this.formatChartTime(p.timestamp));

      if (this.temperatureChart) {
        this.temperatureChart.data.labels = labels;
        this.temperatureChart.data.datasets[0].data = points.map((p) => p.temperature);
        this.temperatureChart.update();
      }

      if (this.vibrationChart) {
        this.vibrationChart.data.labels = labels;
        this.vibrationChart.data.datasets[0].data = points.map((p) => p.vibration);
        this.vibrationChart.update();
      }

      if (this.efficiencyChart) {
        this.efficiencyChart.data.labels = labels;
        this.efficiencyChart.data.datasets[0].data = points.map((p) => p.utilization);
        this.efficiencyChart.data.datasets[1].data = points.map((p) => p.oee);
        this.efficiencyChart.update();
      }
    });
  }

  get maintenanceQueue(): MaintenanceQueueItem[] {
    const queue: MaintenanceQueueItem[] = [];

    if (this.vibration >= 5 || this.failureProbability >= 65) {
      queue.push({ title: 'Bearing Replacement', schedule: 'Tomorrow · 09:00', priority: 'high' });
    }

    if (this.temperature >= 70 || this.maintenanceRiskLevel !== 'LOW') {
      queue.push({ title: 'Lubrication Check', schedule: 'In 2 days', priority: 'medium' });
    }

    queue.push({ title: 'Thermal Calibration', schedule: 'In 4 days', priority: 'low' });

    return queue.slice(0, 4);
  }

  get bearingConfidence(): number {
    return Math.max(52, Math.min(96, Math.round(100 - this.failureProbability * 0.55)));
  }

  get thermalConfidence(): number {
    return Math.max(46, Math.min(95, Math.round(100 - Math.max(0, this.temperature - 45) * 1.35)));
  }

  getTrendPercent(metric: TelemetryMetricKey): number {
    const series = this.getMetricSeries(metric);

    if (series.length < 2) {
      return 0;
    }

    const latest = series[series.length - 1];
    const baseline = series[0] === 0 ? 1 : series[0];
    return ((latest - baseline) / Math.abs(baseline)) * 100;
  }

  formatTrend(metric: TelemetryMetricKey): string {
    const trend = this.getTrendPercent(metric);
    const sign = trend >= 0 ? '+' : '';
    return `${sign}${trend.toFixed(1)}% vs last hour`;
  }

  formatTrendWithUnit(metric: TelemetryMetricKey, unit: string): string {
    const series = this.getMetricSeries(metric);

    if (series.length < 2) {
      return 'Awaiting more telemetry';
    }

    const delta = series[series.length - 1] - series[0];
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)} ${unit} vs last hour`;
  }

  formatLiveValue(value: number | null | undefined, digits = 1, suffix = ''): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }

    return `${value.toFixed(digits)}${suffix}`;
  }

  getDonutBackground(value: number, color: string = 'var(--color-success)'): string {
    const clamped = Math.max(0, Math.min(100, value));
    const angle = clamped * 3.6;

    return `conic-gradient(${color} 0deg ${angle}deg, rgba(148, 163, 184, 0.14) ${angle}deg 360deg)`;
  }

  getSparklinePoints(metric: TelemetryMetricKey): string {
    const values = this.getMetricSeries(metric);

    if (!values.length) {
      return '';
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = values.length > 1 ? this.sparklineWidth / (values.length - 1) : 0;

    return values
      .map((value, index) => {
        const x = index * stepX;
        const y = this.sparklineHeight - ((value - min) / span) * this.sparklineHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  private getMetricSeries(metric: TelemetryMetricKey): number[] {
    const windowed = this.selectedTelemetryWindow > 0
      ? this.telemetryHistory.slice(0, this.selectedTelemetryWindow)
      : this.telemetryHistory;
    const history = [...windowed].reverse().map((snapshot) => snapshot[metric]);

    if (!history.length) {
      return [this.getLiveMetricValue(metric)];
    }

    return history;
  }

  private getLiveMetricValue(metric: TelemetryMetricKey): number {
    switch (metric) {
      case 'temperature':
        return this.temperature;
      case 'vibration':
        return this.vibration;
      case 'health':
        return this.health;
      case 'utilization':
        return this.utilization;
      case 'oee':
        return this.oee;
      case 'performance':
        return this.performance;
      case 'rotationSpeed':
        return this.rotationSpeed;
      default:
        return 0;
    }
  }

  get machineExpensesByCategory(): { category: string; amount: number; count: number }[] {
    const approved = this.machineExpenses.filter(e => e.status === 'APPROVED');
    if (!approved.length) return [];
    const map: Record<string, { amount: number; count: number }> = {};
    approved.forEach(e => {
      const key = e.category || 'Uncategorized';
      map[key] = map[key] || { amount: 0, count: 0 };
      map[key].amount += e.amount || 0;
      map[key].count += 1;
    });
    return Object.entries(map).map(([category, v]) => ({ category, amount: v.amount, count: v.count }))
      .sort((a, b) => b.amount - a.amount);
  }

  loadMachineExpenses(): void {
    if (this.financeTabLoaded) return;
    const id = Number(this.machineId);
    if (!Number.isFinite(id)) return;
    this.machineExpensesLoading = true;
    this.machineExpensesError = null;
    this.financeService.getExpensesByMachine(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (list) => { this.machineExpenses = list.sort((a, b) => Date.parse(b.createdDate) - Date.parse(a.createdDate)); this.machineExpensesLoading = false; this.financeTabLoaded = true; },
      error: (err: { error?: { message?: string } }) => { this.machineExpensesError = err?.error?.message ?? 'Failed to load expenses'; this.machineExpensesLoading = false; }
    });
  }

  calculateStrokeOffset(value: number, max: number): number {
    const radius = 48;
    const circumference = 2 * Math.PI * radius;

    const percentage = Math.min(Math.max(value, 0), max) / max;

    return circumference - (percentage * circumference);
  }

  needleRotation(value: number, max: number): number {
    const clamped = Math.min(Math.max(value, 0), max);
    return (clamped / max) * 360;
  }
  // ============================================================
  // REMOVED: ALL FAKE DATA GENERATION LOGIC
  // ============================================================
  // The following methods have been REMOVED:
  // - startRealtimeUpdates() - used interval() to simulate data
  // - initializeMetrics() - used Math.random() to generate fake values
  // - updateMetricsWithSimulatedData() - used Math.random() for simulation
  // - smoothValue() - used for frontend-generated physics
  //
  // Frontend now ONLY displays backend-provided data via WebSocket.
  // Backend is the SINGLE SOURCE OF TRUTH for all machine telemetry.
  // ============================================================

  // Gauge calculation methods (UI only - no data generation)
  getGaugeRotation(value: number, max: number = 100): number {
    // Rotate from -90 to 90 degrees (180 degree arc)
    return (value / max) * 180 - 90;
  }

  getGaugePathD(value: number, max: number = 100, radius: number = 120): string {
    const percentage = Math.min(Math.max(value / max, 0), 1); // Clamp between 0 and 1
    const angle = percentage * Math.PI; // 180 degrees in radians
    const x = 125 + radius * Math.cos(angle - Math.PI / 2);
    const y = 160 + radius * Math.sin(angle - Math.PI / 2);
    const largeArc = percentage > 0.5 ? 1 : 0;

    return `M 40 160 A ${radius} ${radius} 0 ${largeArc} 1 ${x} ${y}`;
  }

  getNeedleRotation(value: number, max: number = 100): number {
    return (value / max) * 180 - 90;
  }

  refreshNow(): void {
    if (this.machineId) {
      // WebSocket connection is persistent, no need to reconnect — this only re-fetches the machine record.
      this.loadMachine(this.machineId);
    }
  }

  downloadRapport(): void {
    if (!this.machine || !this.machineId) {
      this.errorMessage = 'Machine data is still loading. Please try again in a moment.';
      return;
    }

    const numericMachineId = Number(this.machineId);
    if (!Number.isFinite(numericMachineId)) {
      this.errorMessage = 'Unable to generate the report for this machine.';
      return;
    }

    this.isGeneratingRapport = true;

    const maintenanceTasks$ = this.maintenanceService.getMachineMaintenanceTasks(this.machineId, 0, 100).pipe(
      map((response: MaintenanceResponse) => response.content ?? []),
      catchError(() => of([] as Maintenance[]))
    );

    const expenses$ = this.financeService.getExpensesByMachine(numericMachineId).pipe(
      catchError(() => of([] as ExpenseReportResponse[]))
    );

    forkJoin({
      maintenanceTasks: maintenanceTasks$,
      expenses: expenses$,
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isGeneratingRapport = false;
        })
      )
      .subscribe({
        next: ({ maintenanceTasks, expenses }) => {
          this.generateRapportPdf(maintenanceTasks, expenses);
        },

        error: (error) => {
          console.error('❌ Failed to generate machine rapport:', error);
          this.errorMessage = 'Failed to generate the machine rapport.';
        },
      });
  }

  private recordTelemetrySnapshot(telemetry: MachineTelemetry): void {
    this.telemetryHistory.unshift({
      timestamp: telemetry.timestamp,
      temperature: telemetry.temperature,
      vibration: telemetry.vibration,
      health: telemetry.health,
      utilization: this.utilization,
      oee: this.oee,
      performance: this.performance,
      pressure: this.pressure,
      powerConsumption: this.powerConsumption,
      rotationSpeed: this.rotationSpeed,
    });

    this.telemetryHistory = this.telemetryHistory.slice(0, this.telemetryHistoryCap);
  }

  private generateRapportPdf(maintenanceTasks: Maintenance[], expenses: ExpenseReportResponse[]): void {
    const { machine } = this;
    if (!machine) {
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 40;
    const right = pageWidth - 40;
    const contentWidth = right - left;
    let y = 42;

    const ensureSpace = (needed: number): void => {
      if (y + needed > pageHeight - 40) {
        doc.addPage();
        y = 42;
      }
    };

    const addDivider = (): void => {
      ensureSpace(18);
      doc.setDrawColor(203, 213, 225);
      doc.line(left, y, right, y);
      y += 16;
    };

    const addSectionTitle = (title: string): void => {
      ensureSpace(24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text(title, left, y);
      y += 16;
    };

    const addParagraph = (text: string, lineHeight = 14): void => {
      ensureSpace(18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      const lines = doc.splitTextToSize(text, contentWidth);
      doc.text(lines, left, y);
      y += lines.length * lineHeight;
    };

    const addKeyValue = (label: string, value: string): void => {
      ensureSpace(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(label, left, y);
      y += 13;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(value, contentWidth);
      doc.text(lines, left, y);
      y += lines.length * 13 + 6;
    };

    const addRow = (cells: string[], widths: number[]): void => {
      ensureSpace(18);
      const maxLines = cells.reduce((max, cell, index) => {
        const lines = doc.splitTextToSize(cell, widths[index]);
        return Math.max(max, lines.length);
      }, 1);

      let x = left;
      cells.forEach((cell, index) => {
        const lines = doc.splitTextToSize(cell, widths[index]);
        doc.text(lines, x, y);
        x += widths[index];
      });

      y += maxLines * 12 + 8;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Sentinel Machine Rapport', left, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text(`Machine ${machine.serialNumber} · Generated ${new Date().toLocaleString()}`, left, y);
    y += 18;

    addDivider();

    addSectionTitle('Machine Overview');
    addKeyValue('Serial Number', machine.serialNumber);
    addKeyValue('Name', this.normalizeReportValue(machine.name));
    addKeyValue('Model', this.normalizeReportValue(machine.model));
    addKeyValue('Manufacturer', this.normalizeReportValue(machine.manufacturer));
    addKeyValue('Location', this.normalizeReportValue(machine.location));
    addKeyValue('Category', this.normalizeReportValue(machine.category));
    addKeyValue('Subcategory', this.normalizeReportValue(machine.subCategory));
    addKeyValue('Status', this.normalizeReportValue(machine.status));
    addKeyValue('Installation Date', this.formatReportDate(machine.installationDate));
    addKeyValue('Last Maintenance', this.formatReportDate(machine.lastMaintenanceDate));
    addKeyValue('Next Maintenance', this.formatReportDate(machine.nextMaintenanceDate));
    addKeyValue('Operating Hours', machine.operatingHours !== undefined ? `${machine.operatingHours}` : 'N/A');
    addKeyValue('Risk Score', machine.riskScore !== undefined ? `${machine.riskScore}` : 'N/A');

    addDivider();

    addSectionTitle('Live Telemetry Snapshot');
    addParagraph(`Current view status: ${this.isConnected ? 'Connected to backend telemetry stream' : 'Telemetry stream is currently disconnected'}`);
    addParagraph(`Last received update: ${this.lastUpdated.toLocaleString()}`);
    addKeyValue('Temperature', `${this.temperature.toFixed(1)} °C`);
    addKeyValue('Vibration', this.vibration.toFixed(1));
    addKeyValue('Health', this.health.toFixed(1));
    addKeyValue('Utilization', `${this.utilization.toFixed(1)} %`);
    addKeyValue('OEE', `${this.oee.toFixed(1)} %`);
    addKeyValue('Performance', `${this.performance.toFixed(1)} pcs/min`);

    addDivider();

    addSectionTitle('Telemetry Changes During This Session');
    if (this.telemetryHistory.length === 0) {
      addParagraph('No live telemetry changes have been recorded yet for this session.');
    } else {
      addRow(
        ['Time', 'Temp', 'Vibration', 'Health', 'Util.', 'OEE', 'Perf.'],
        [100, 70, 70, 70, 60, 60, 60]
      );
      this.telemetryHistory.forEach((entry) => {
        addRow(
          [
            this.formatCompactTime(entry.timestamp),
            entry.temperature.toFixed(1),
            entry.vibration.toFixed(1),
            entry.health.toFixed(1),
            `${entry.utilization.toFixed(1)}%`,
            `${entry.oee.toFixed(1)}%`,
            `${entry.performance.toFixed(1)}`,
          ],
          [100, 70, 70, 70, 60, 60, 60]
        );
      });
    }

    addDivider();

    addSectionTitle('Maintenance History');
    if (maintenanceTasks.length === 0) {
      addParagraph('No maintenance tasks were found for this machine.');
    } else {
      maintenanceTasks.slice(0, 10).forEach((task) => {
        addKeyValue(
          `Task #${task.id} · ${task.type} · ${task.status}`,
          [
            `Priority: ${task.priority}`,
            `Scheduled: ${this.formatReportDate(task.scheduledDate)}`,
            task.startDate ? `Started: ${this.formatReportDate(task.startDate)}` : null,
            task.completedDate ? `Completed: ${this.formatReportDate(task.completedDate)}` : null,
            task.approvedDate ? `Approved: ${this.formatReportDate(task.approvedDate)}` : null,
            task.description ? `Description: ${task.description}` : null,
            task.notes ? `Notes: ${task.notes}` : null,
          ].filter((value): value is string => Boolean(value)).join(' · ')
        );
      });
    }

    addDivider();

    addSectionTitle('Expense History');
    if (expenses.length === 0) {
      addParagraph('No expense reports are linked to this machine.');
    } else {
      addRow(['Date', 'Title', 'Category', 'Amount', 'Status'], [90, 210, 90, 70, 70]);
      expenses.slice(0, 10).forEach((expense) => {
        addRow(
          [
            this.formatCompactDate(expense.createdDate),
            expense.title,
            expense.category,
            `${expense.amount.toFixed(2)} TND`,
            expense.status,
          ],
          [90, 210, 90, 70, 70]
        );
      });
    }

    addDivider();

    addSectionTitle('Report Summary');
    const approvedSpend = expenses.filter((expense) => expense.status === 'APPROVED').reduce((sum, expense) => sum + expense.amount, 0);
    addParagraph(`Telemetry updates captured: ${this.telemetryHistory.length}`);
    addParagraph(`Maintenance records included: ${maintenanceTasks.length}`);
    addParagraph(`Expense records included: ${expenses.length}`);
    addParagraph(`Approved spend total: ${approvedSpend.toFixed(2)} TND`);
    addParagraph('This report combines live telemetry, maintenance history, and linked financial records available from the current application state.');

    const filename = `machine-rapport-${machine.serialNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
    doc.save(filename);
  }

  private normalizeReportValue(value?: string | number | null): string {
    if (value === undefined || value === null || value === '') {
      return 'N/A';
    }

    return String(value);
  }

  private formatReportDate(value?: string): string {
    if (!value) {
      return 'N/A';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  private formatCompactDate(value?: string): string {
    if (!value) {
      return 'N/A';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }

  private formatCompactTime(value?: string): string {
    if (!value) {
      return 'N/A';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString();
  }

  // ════════════════════════════════════════════════════════
  // DIGITAL TWIN — Machine Visualization
  // Real telemetry (temperature, vibration, pressure, power, current,
  // voltage, rpm, bearingWear, remainingUsefulLife when the backend sends
  // them) flows straight through DigitalTwinIntelligenceService. Only
  // fields with no backend equivalent at all (humidity, flow rate, etc.)
  // are deterministically derived — see that service's header comment.
  // ════════════════════════════════════════════════════════

  get archetype(): MachineArchetype {
    return this.twinService.archetypeFor(this.machine);
  }

  get archetypeLabel(): string {
    return this.twinService.archetypeLabel(this.archetype);
  }

  get sensors(): SensorPoint[] {
    return this.twinService.buildSensors(this.machine, this.latestTelemetry, this.telemetryHistory);
  }

  /** Anatomy tabs narrow which sensors are overlaid on the illustration — "Current Sensors" in the side panel always lists all of them. */
  get filteredSensors(): SensorPoint[] {
    const all = this.sensors;
    switch (this.anatomyMode) {
      case 'electrical':
        return all.filter((s) => ['current', 'voltage', 'power', 'rpm'].includes(s.kind));
      case 'hydraulic':
        return all.filter((s) => ['hydraulicPressure', 'pressure', 'oilLevel', 'airPressure', 'flowRate'].includes(s.kind));
      case 'thermal':
        return all.filter((s) => ['temperature', 'bearingTemperature', 'humidity'].includes(s.kind));
      case 'maintenance':
        return [];
      default:
        return all;
    }
  }

  get healthRing(): MachineHealthRing {
    const hc = this.healthComponents;
    return this.twinService.buildHealthRing({
      mechanical: hc[0]?.value ?? this.health,
      electrical: hc[1]?.value ?? 0,
      hydraulic: hc[2]?.value ?? 0,
      thermal: this.thermalConfidence,
      software: hc[3]?.value ?? 0,
    });
  }

  get telemetryCards(): TelemetryOrbitCard[] {
    return this.twinService.buildTelemetryCards({
      temperature: this.temperature,
      rpm: this.rpmSpeed,
      power: this.energyConsumption,
      load: this.loadFactor,
      pressure: this.hydraulicPressure,
      efficiency: this.utilization,
      oee: this.oee,
      runtimeHours: this.operatingHoursValue,
    });
  }

  get componentDetails(): TwinComponentDetail[] {
    return this.twinService.buildComponentDetails(this.machine, this.latestTelemetry, {
      health: this.health,
      failureProbability: this.failureProbability,
      bearingConfidence: this.bearingConfidence,
      rpm: this.rpmSpeed,
      power: this.energyConsumption,
    });
  }

  get maintenanceOverlay(): MaintenanceOverlayItem[] {
    return this.twinService.buildMaintenanceOverlay(this.componentDetails);
  }

  get aiPrediction(): AiPrediction {
    return this.twinService.buildAiPrediction(this.machine, this.latestTelemetry, {
      failureProbability: this.failureProbability,
    });
  }

  get timelineEvents(): TwinTimelineEvent[] {
    return this.twinService.buildTimeline(this.latestTelemetry, this.activeAlerts, this.aiPrediction);
  }

  get selectedComponentDetail(): TwinComponentDetail | null {
    if (!this.highlightedComponent) {
      return null;
    }
    return this.componentDetails.find((c) => c.key === this.highlightedComponent) ?? null;
  }

  get componentTonesMap(): Partial<Record<TwinComponentKey, ComponentTone>> {
    const map: Partial<Record<TwinComponentKey, ComponentTone>> = {};
    this.componentDetails.forEach((c) => (map[c.key] = c.tone));
    return map;
  }

  get componentTempsMap(): Partial<Record<TwinComponentKey, number>> {
    const map: Partial<Record<TwinComponentKey, number>> = {};
    this.componentDetails.forEach((c) => (map[c.key] = c.currentTemp));
    return map;
  }

  get effectiveHeatmap(): boolean {
    return this.heatmapOn || this.cameraMode === 'thermal';
  }

  get isMachineRunning(): boolean {
    return this.isConnected && this.operationState === 'RUNNING';
  }

  onComponentClick(key: TwinComponentKey): void {
    this.highlightedComponent = this.highlightedComponent === key ? null : key;
  }

  closeComponentDetail(): void {
    this.highlightedComponent = null;
  }

  onAnatomyModeChange(mode: AnatomyMode): void {
    this.anatomyMode = mode;
  }

  onCameraModeChange(mode: CameraViewMode): void {
    this.cameraMode = mode;
  }

  onHeatmapToggle(value: boolean): void {
    this.heatmapOn = value;
  }
}

