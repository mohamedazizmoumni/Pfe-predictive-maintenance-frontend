import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, fromEvent, interval, merge, of, Subject, takeUntil } from 'rxjs';
import { EquipmentService } from '../../core/services/equipment.service';
import { PredictiveApiService } from '../../core/services/predictive-api.service';
import {
  MachineFailureReport,
  MachineSimulatedReading,
  NormalizedApiError,
  PaginatedResponse,
  SensorDataPoint,
} from '../../core/models/predictive.models';
import { ToastService } from '../../core/services/toast.service';
import { AlertApiService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertCategory, AlertResponse, AlertSeverity, AlertStatus, CreateAlertPayload, Page } from '../../core/models/sentinel.models';
import { rolesCollectionHasAny } from '../../core/utils/role.utils';

type ErrorSection = 'readings' | 'sensorData' | 'reports' | 'alerts';

interface ParsedSensorState {
  entries: Array<[string, unknown]>;
  raw: string;
  parseFailed: boolean;
}

interface AutoAlertCandidate {
  reading: MachineSimulatedReading;
  severity: AlertSeverity;
  reason: string;
  fingerprint: string;
}

@Component({
  selector: 'app-predictive-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './predictive-dashboard.component.html',
  styleUrl: './predictive-dashboard.component.scss',
})
export class PredictiveDashboardComponent implements OnInit, OnDestroy {
  readonly machineFilterControl = new FormControl<string>('', { nonNullable: true });
  readonly fixedSensorRowCount = 20;

  readonly machines$ = this.equipmentService.machines$;
  readonly runNowAllowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

  isReadingsLoading = true;
  isSensorDataLoading = true;
  isReportsLoading = false;
  isAlertsLoading = false;
  isExporting = false;
  isRunningPredictive = false;
  canRunPredictive = false;
  hideRunPredictiveButton = false;

  readingsError: string | null = null;
  sensorDataError: string | null = null;
  reportsError: string | null = null;
  alertsError: string | null = null;

  lastLiveRefreshAt: Date | null = null;

  allSimulatedReadings: MachineSimulatedReading[] = [];
  simulatedReadings: MachineSimulatedReading[] = [];
  sensorDataPage: PaginatedResponse<SensorDataPoint> | null = null;
  reportsPage: PaginatedResponse<MachineFailureReport> | null = null;
  alertsPage: Page<AlertResponse> | null = null;
  selectedReport: MachineFailureReport | null = null;

  expandedReadingMachineId: number | null = null;

  reportPage = 0;
  reportSize = 20;
  sensorPage = 0;
  sensorSize = this.fixedSensorRowCount;
  reportSort = 'createdAt,desc';
  sensorSort = 'timestamp,desc';

  private readonly destroy$ = new Subject<void>();
  private readonly isBrowser = typeof document !== 'undefined';
  private isReadingsRequestInFlight = false;
  private isSensorDataRequestInFlight = false;
  private readonly toastedErrors: Partial<Record<ErrorSection, string>> = {};
  private readonly autoAlertCooldownMs = 10 * 60 * 1000;
  private readonly maxAutoAlertsPerCycle = 2;
  private readonly pendingAutoAlertMachineIds = new Set<number>();
  private readonly autoAlertHistory = new Map<number, { fingerprint: string; createdAt: number }>();
  private latestSeenAlertId: number | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly equipmentService: EquipmentService,
    private readonly predictiveApi: PredictiveApiService,
    private readonly alertApi: AlertApiService,
    private readonly authService: AuthService,
    private readonly toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.equipmentService.loadMachines(0, 100);

    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.canRunPredictive = rolesCollectionHasAny(user?.roles, this.runNowAllowedRoles);
      });

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const machineId = params.get('machineId') ?? '';
        const parsedReportPage = this.parsePositiveInteger(params.get('page'), 0, 0);
        const parsedReportSize = this.parsePositiveInteger(params.get('size'), 20, 1);
        const parsedSensorPage = this.parsePositiveInteger(params.get('sensorPage'), 0, 0);
        const parsedReportSort = params.get('sort') ?? 'createdAt,desc';
        const parsedSensorSort = params.get('sensorSort') ?? 'timestamp,desc';

        if (machineId !== this.machineFilterControl.value) {
          this.machineFilterControl.setValue(machineId, { emitEvent: false });
        }

        this.reportPage = parsedReportPage;
        this.reportSize = parsedReportSize;
        this.sensorPage = parsedSensorPage;
        this.sensorSize = this.fixedSensorRowCount;
        this.reportSort = parsedReportSort;
        this.sensorSort = parsedSensorSort;

        this.applyReadingsFilter();
        this.loadSensorData(true);
        this.loadFailureReports();
        this.loadAlerts();
      });

    this.machineFilterControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((machineId) => {
        this.updateQueryParams({
          machineId: machineId || null,
          page: 0,
          sensorPage: 0,
        });
      });

    this.startLivePolling();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  retryReadings(): void {
    this.fetchSimulatedReadings();
  }

  retrySensorData(): void {
    this.loadSensorData(true);
  }

  retryReports(): void {
    this.loadFailureReports();
  }

  retryAlerts(): void {
    this.loadAlerts();
  }

  runPredictiveNow(): void {
    if (this.isRunningPredictive || !this.shouldShowRunNowButton) {
      return;
    }

    this.isRunningPredictive = true;
    this.predictiveApi.runPredictiveNow().subscribe({
      next: () => {
        this.isRunningPredictive = false;
        this.toastService.success('Predictive cycle triggered. Refreshing dashboard data...');
        this.refreshAllWidgets();
      },
      error: (error: NormalizedApiError) => {
        this.isRunningPredictive = false;
        if (error.statusCode === 403) {
          this.hideRunPredictiveButton = true;
        }
        this.toastService.error(error.message);
      },
    });
  }

  toggleReadingDetails(machineId: number): void {
    this.expandedReadingMachineId = this.expandedReadingMachineId === machineId ? null : machineId;
  }

  selectReport(report: MachineFailureReport): void {
    this.selectedReport = report;
  }

  previousPage(): void {
    if (this.reportPage <= 0) {
      return;
    }

    this.updateQueryParams({ page: this.reportPage - 1 });
  }

  nextPage(): void {
    if (!this.reportsPage || this.reportPage + 1 >= this.reportsPage.totalPages) {
      return;
    }

    this.updateQueryParams({ page: this.reportPage + 1 });
  }

  previousSensorPage(): void {
    if (this.sensorPage <= 0) {
      return;
    }

    this.updateQueryParams({ sensorPage: this.sensorPage - 1 });
  }

  nextSensorPage(): void {
    if (!this.sensorDataPage || this.sensorPage + 1 >= this.sensorDataPage.totalPages) {
      return;
    }

    this.updateQueryParams({ sensorPage: this.sensorPage + 1 });
  }

  exportFailureReportsPdf(): void {
    this.isExporting = true;
    const machineId = this.getSelectedMachineId();

    this.predictiveApi.downloadFailureReportsPdf(machineId).subscribe({
      next: (blob) => {
        this.isExporting = false;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'failure-reports.pdf';
        anchor.click();
        URL.revokeObjectURL(url);
        this.toastService.success('Failure reports PDF exported successfully.');
      },
      error: (error: NormalizedApiError) => {
        this.isExporting = false;
        this.toastService.error(error.message);
      },
    });
  }

  getRiskClass(risk: number): string {
    const normalizedRisk = this.normalizeRiskRatio(risk);

    if (normalizedRisk >= 0.85) {
      return 'risk risk--high';
    }

    if (normalizedRisk >= 0.7) {
      return 'risk risk--medium';
    }

    return 'risk risk--low';
  }

  toRiskPercent(risk: number | null | undefined): number {
    return this.normalizeRiskRatio(risk) * 100;
  }

  get anomalyYesNo(): string {
    return 'Yes';
  }

  get shouldShowRunNowButton(): boolean {
    return this.canRunPredictive && !this.hideRunPredictiveButton;
  }

  isPredictionAlert(alert: AlertResponse): boolean {
    return alert.category === AlertCategory.PREDICTION;
  }

  getNextBestSteps(report: MachineFailureReport | null): string[] {
    if (!report?.recommendedAction?.trim()) {
      return [];
    }

    const steps = report.recommendedAction
      .split(/\r?\n|(?<=[.;])\s+/)
      .map((step) => step.trim())
      .filter((step) => step.length > 0);

    return steps.length > 0 ? steps : [report.recommendedAction.trim()];
  }

  viewAlertContext(alert: AlertResponse): void {
    if (alert.machineId !== undefined && alert.machineId !== null) {
      const machineId = String(alert.machineId);
      this.machineFilterControl.setValue(machineId);
      this.focusReportForMachine(alert.machineId);
      return;
    }

    if (!alert.sourceReference) {
      return;
    }

    const reportId = this.parseReportIdFromReference(alert.sourceReference);
    if (!reportId || !this.reportsPage) {
      return;
    }

    const found = this.reportsPage.content.find((report) => report.id === reportId);
    if (found) {
      this.selectedReport = found;
    }
  }

  parseSensorState(report: MachineFailureReport | null): ParsedSensorState {
    if (!report) {
      return {
        entries: [],
        raw: '',
        parseFailed: false,
      };
    }

    if (!report.currentSensorState?.trim()) {
      return {
        entries: [],
        raw: '',
        parseFailed: false,
      };
    }

    try {
      const parsed = JSON.parse(report.currentSensorState) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          entries: Object.entries(parsed as Record<string, unknown>),
          raw: report.currentSensorState,
          parseFailed: false,
        };
      }

      return {
        entries: [['value', parsed]],
        raw: report.currentSensorState,
        parseFailed: false,
      };
    } catch {
      return {
        entries: [],
        raw: report.currentSensorState,
        parseFailed: true,
      };
    }
  }

  trackByReading(_: number, reading: MachineSimulatedReading): number {
    return reading.machineId;
  }

  trackByReport(_: number, report: MachineFailureReport): number {
    return report.id;
  }

  trackBySensorData(_: number, dataPoint: SensorDataPoint): string {
    return String(dataPoint.id ?? `${dataPoint.machineId}-${dataPoint.sensorCode}-${dataPoint.timestamp}`);
  }

  trackBySensorDataRow(index: number, dataPoint: SensorDataPoint | null): string {
    return dataPoint
      ? this.trackBySensorData(index, dataPoint)
      : `sensor-row-placeholder-${index}`;
  }

  get sensorRowsForView(): Array<SensorDataPoint | null> {
    const currentRows = this.sensorDataPage?.content ?? [];
    const limitedRows = currentRows.slice(0, this.fixedSensorRowCount);

    if (limitedRows.length >= this.fixedSensorRowCount) {
      return limitedRows;
    }

    const placeholders = Array.from(
      { length: this.fixedSensorRowCount - limitedRows.length },
      () => null as SensorDataPoint | null
    );

    return [...limitedRows, ...placeholders];
  }

  trackByAlert(_: number, alert: AlertResponse): number {
    return alert.id;
  }

  private startLivePolling(): void {
    const visibility$ = this.isBrowser
      ? fromEvent(document, 'visibilitychange').pipe(filter(() => !document.hidden))
      : of(null);

    merge(of(0), interval(5000), visibility$)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isBrowser && document.hidden) {
          return;
        }

        this.fetchSimulatedReadings();
        this.loadSensorData();
      });
  }

  private fetchSimulatedReadings(): void {
    if (this.isReadingsRequestInFlight) {
      return;
    }

    if (this.simulatedReadings.length === 0) {
      this.isReadingsLoading = true;
    }

    this.isReadingsRequestInFlight = true;

    this.predictiveApi.getSimulatedReadings().subscribe({
      next: (readings) => {
        this.isReadingsRequestInFlight = false;
        this.isReadingsLoading = false;
        this.readingsError = null;
        this.clearSectionErrorToast('readings');
        this.lastLiveRefreshAt = new Date();
        this.allSimulatedReadings = [...readings].sort((a, b) =>
          Date.parse(b.timestamp) - Date.parse(a.timestamp)
        );
        this.applyReadingsFilter();
        this.monitorReadingsAndNotify(this.allSimulatedReadings);
      },
      error: (error: NormalizedApiError) => {
        this.isReadingsRequestInFlight = false;
        this.isReadingsLoading = false;
        this.readingsError = error.message;
        this.showSectionErrorToast('readings', error.message);
      },
    });
  }

  private loadSensorData(forceSkeleton = false): void {
    if (this.isSensorDataRequestInFlight) {
      return;
    }

    if (forceSkeleton || !this.sensorDataPage) {
      this.isSensorDataLoading = true;
    }

    this.isSensorDataRequestInFlight = true;
    this.sensorDataError = null;

    this.predictiveApi
      .getSensorData({
        machineId: this.getSelectedMachineId(),
        page: this.sensorPage,
        size: this.sensorSize,
        sort: this.sensorSort,
      })
      .subscribe({
        next: (response) => {
          this.isSensorDataRequestInFlight = false;
          this.isSensorDataLoading = false;
          this.sensorDataPage = response;
          this.clearSectionErrorToast('sensorData');
          this.lastLiveRefreshAt = new Date();
        },
        error: (error: NormalizedApiError) => {
          this.isSensorDataRequestInFlight = false;
          this.isSensorDataLoading = false;
          this.sensorDataError = error.message;
          this.showSectionErrorToast('sensorData', error.message);
        },
      });
  }

  private loadFailureReports(): void {
    this.isReportsLoading = true;
    this.reportsError = null;

    this.predictiveApi
      .getFailureReports({
        machineId: this.getSelectedMachineId(),
        page: this.reportPage,
        size: this.reportSize,
        sort: this.reportSort,
      })
      .subscribe({
        next: (response) => {
          this.isReportsLoading = false;
          this.reportsPage = response;
          this.clearSectionErrorToast('reports');

          const selectedId = this.selectedReport?.id;
          this.selectedReport = response.content.find((report) => report.id === selectedId) ?? response.content[0] ?? null;
        },
        error: (error: NormalizedApiError) => {
          this.isReportsLoading = false;
          this.reportsError = error.message;
          this.showSectionErrorToast('reports', error.message);
        },
      });
  }

  private loadAlerts(): void {
    this.isAlertsLoading = true;
    this.alertsError = null;

    this.alertApi
      .list({
        page: 0,
        size: 20,
        sort: 'createdDate,desc',
        machineId: this.getSelectedMachineId(),
      })
      .subscribe({
        next: (response) => {
          this.isAlertsLoading = false;
          this.alertsPage = response;
          this.clearSectionErrorToast('alerts');
          this.notifyOnNewAlerts(response);
        },
        error: (error: { error?: { message?: string } }) => {
          this.isAlertsLoading = false;
          const message = error.error?.message || 'Failed to load alerts.';
          this.alertsError = message;
          this.showSectionErrorToast('alerts', message);
        },
      });
  }

  private refreshAllWidgets(): void {
    this.fetchSimulatedReadings();
    this.loadSensorData();
    this.loadFailureReports();
    this.loadAlerts();
  }

  private monitorReadingsAndNotify(readings: MachineSimulatedReading[]): void {
    if (!Array.isArray(readings) || readings.length === 0) {
      return;
    }

    const candidates = readings
      .map((reading) => this.buildAutoAlertCandidate(reading))
      .filter((candidate): candidate is AutoAlertCandidate => candidate !== null)
      .sort((a, b) => {
        const severityDelta = this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity);
        if (severityDelta !== 0) {
          return severityDelta;
        }

        return b.reading.risk - a.reading.risk;
      });

    if (candidates.length === 0) {
      return;
    }

    const now = Date.now();
    let createdThisCycle = 0;

    for (const candidate of candidates) {
      if (createdThisCycle >= this.maxAutoAlertsPerCycle) {
        break;
      }

      const { machineId } = candidate.reading;
      if (this.pendingAutoAlertMachineIds.has(machineId)) {
        continue;
      }

      const previous = this.autoAlertHistory.get(machineId);
      if (
        previous &&
        previous.fingerprint === candidate.fingerprint &&
        now - previous.createdAt < this.autoAlertCooldownMs
      ) {
        continue;
      }

      this.createAutoPredictionAlert(candidate, now);
      createdThisCycle += 1;
    }
  }

  private buildAutoAlertCandidate(reading: MachineSimulatedReading): AutoAlertCandidate | null {
    const risk = this.normalizeRiskRatio(reading.risk);
    const predictedFailureDays = Number(reading.predictedFailureDays ?? Number.POSITIVE_INFINITY);
    const anomalyCount = Number(reading.anomalyCount ?? 0);

    const isCritical = risk >= 0.85 || predictedFailureDays <= 3 || anomalyCount >= 6;
    const isWarning = risk >= 0.7 || predictedFailureDays <= 7 || anomalyCount >= 3;

    if (!isCritical && !isWarning) {
      return null;
    }

    const severity = isCritical ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;
    const reasons: string[] = [];

    if (risk >= 0.85) {
      reasons.push(`risk ${(risk * 100).toFixed(1)}% >= 85%`);
    } else if (risk >= 0.7) {
      reasons.push(`risk ${(risk * 100).toFixed(1)}% >= 70%`);
    }

    if (Number.isFinite(predictedFailureDays) && predictedFailureDays <= 7) {
      reasons.push(`predicted failure in ${Math.max(0, Math.floor(predictedFailureDays))} day(s)`);
    }

    if (anomalyCount >= 3) {
      reasons.push(`anomaly count ${Math.floor(anomalyCount)}`);
    }

    const roundedRisk = Math.round(risk * 100);
    const roundedDays = Number.isFinite(predictedFailureDays) ? Math.max(0, Math.floor(predictedFailureDays)) : 999;
    const anomalyBucket = Math.max(0, Math.floor(anomalyCount / 2));

    return {
      reading,
      severity,
      reason: reasons.join('; '),
      fingerprint: `${severity}:${roundedRisk}:${roundedDays}:${anomalyBucket}`,
    };
  }

  private createAutoPredictionAlert(candidate: AutoAlertCandidate, timestampMs: number): void {
    const { machineId } = candidate.reading;
    this.pendingAutoAlertMachineIds.add(machineId);

    const payload: CreateAlertPayload = {
      machineId,
      title: `Auto predictive risk detected on ${candidate.reading.machineName}`,
      message: `Live watcher flagged this machine: ${candidate.reason}.`,
      severity: candidate.severity,
      category: AlertCategory.PREDICTION,
      sourceReference: `auto-watch:${machineId}:${candidate.reading.timestamp}`,
      recommendations: 'Review latest sensor values and schedule preventive maintenance if trend persists.',
    };

    this.alertApi.create(payload).subscribe({
      next: () => {
        this.pendingAutoAlertMachineIds.delete(machineId);
        this.autoAlertHistory.set(machineId, {
          fingerprint: candidate.fingerprint,
          createdAt: timestampMs,
        });

        if (candidate.severity === AlertSeverity.CRITICAL) {
          this.toastService.error(`Critical auto-alert created for ${candidate.reading.machineName}.`);
        } else {
          this.toastService.info(`Auto-alert created for ${candidate.reading.machineName}.`);
        }

        this.loadAlerts();
      },
      error: (error: { error?: { message?: string } }) => {
        this.pendingAutoAlertMachineIds.delete(machineId);
        const message = error.error?.message || 'Failed to create auto predictive alert.';
        this.showSectionErrorToast('alerts', message);
      },
    });
  }

  private getSeverityWeight(severity: AlertSeverity): number {
    if (severity === AlertSeverity.CRITICAL) {
      return 2;
    }

    if (severity === AlertSeverity.WARNING) {
      return 1;
    }

    return 0;
  }

  private notifyOnNewAlerts(response: Page<AlertResponse>): void {
    if (!response.content || response.content.length === 0) {
      return;
    }

    const previousLatest = this.latestSeenAlertId;
    const currentLatest = response.content[0].id;

    if (previousLatest !== null) {
      const newUnseen = response.content
        .filter((alert) => alert.id > previousLatest)
        .filter((alert) => alert.status === AlertStatus.NEW)
        .slice(0, 3);

      for (const alert of newUnseen) {
        if (alert.severity === AlertSeverity.CRITICAL) {
          this.toastService.error(`New critical alert: ${alert.title}`);
        } else {
          this.toastService.info(`New alert: ${alert.title}`);
        }
      }
    }

    this.latestSeenAlertId = previousLatest === null ? currentLatest : Math.max(previousLatest, currentLatest);
  }

  private applyReadingsFilter(): void {
    const selectedValue = this.machineFilterControl.value;
    if (!selectedValue) {
      this.simulatedReadings = this.allSimulatedReadings;
      return;
    }

    const numericMachineId = Number(selectedValue);
    if (Number.isFinite(numericMachineId)) {
      this.simulatedReadings = this.allSimulatedReadings.filter((reading) => reading.machineId === numericMachineId);
      return;
    }

    this.simulatedReadings = this.allSimulatedReadings.filter((reading) => String(reading.machineId) === selectedValue);
  }

  private focusReportForMachine(machineId: number): void {
    if (!this.reportsPage) {
      return;
    }

    const report = this.reportsPage.content.find((item) => item.machineId === machineId);
    if (report) {
      this.selectedReport = report;
    }
  }

  private parseReportIdFromReference(reference: string): number | null {
    const matched = reference.match(/\d+/);
    if (!matched) {
      return null;
    }

    const parsed = Number(matched[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private getSelectedMachineId(): number | undefined {
    const { value } = this.machineFilterControl;
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parsePositiveInteger(value: string | null, fallback: number, min: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= min ? parsed : fallback;
  }

  private updateQueryParams(params: {
    machineId?: string | null;
    page?: number;
    size?: number;
    sensorPage?: number;
    sensorSize?: number;
    sort?: string;
    sensorSort?: string;
  }): void {
    const queryParams: Params = {
      machineId: params.machineId !== undefined ? params.machineId : (this.machineFilterControl.value || null),
      page: params.page ?? this.reportPage,
      size: params.size ?? this.reportSize,
      sensorPage: params.sensorPage ?? this.sensorPage,
      sensorSize: params.sensorSize ?? this.sensorSize,
      sort: params.sort ?? this.reportSort,
      sensorSort: params.sensorSort ?? this.sensorSort,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
    });
  }

  private showSectionErrorToast(section: ErrorSection, message: string): void {
    if (!message || this.toastedErrors[section] === message) {
      return;
    }

    this.toastedErrors[section] = message;
    this.toastService.error(message);
  }

  private clearSectionErrorToast(section: ErrorSection): void {
    this.toastedErrors[section] = undefined;
  }

  private normalizeRiskRatio(risk: number | null | undefined): number {
    const numericRisk = Number(risk ?? 0);
    if (!Number.isFinite(numericRisk) || numericRisk <= 0) {
      return 0;
    }

    const asRatio = numericRisk > 1 ? numericRisk / 100 : numericRisk;
    return Math.max(0, Math.min(1, asRatio));
  }
}
