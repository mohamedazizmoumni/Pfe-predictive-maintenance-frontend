import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import {
  AlertResponse,
  AlertStatsResponse,
  AlertSeverity,
  AlertStatus,
  AlertStreamEvent,
  AcknowledgeAlertPayload,
  CloseAlertPayload,
  CreateAlertPayload,
  EscalateAlertPayload,
  Page,
  User,
} from '../../core/models/sentinel.models';
import { AlertApiService } from '../../core/services/alert.service';
import { EquipmentService } from '../../core/services/equipment.service';
import { AuthService } from '../../core/services/auth.service';
import { MachineWebSocketService } from '../../core/services/machine-websocket.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { normalizeRoleName } from '../../core/utils/role.utils';
import { AlertListComponent } from './components/alert-list/alert-list.component';
import { AlertDetailComponent } from './components/alert-detail/alert-detail.component';
import { AlertCreateComponent } from './components/alert-create/alert-create.component';
import { AlertActionModalComponent } from './components/alert-action-modal/alert-action-modal.component';
import { AlertListFilters, AlertActionMode } from './alert.types';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [
    CommonModule,
    AlertListComponent,
    AlertDetailComponent,
    AlertCreateComponent,
    AlertActionModalComponent,
  ],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsComponent implements OnInit, OnDestroy {
  private readonly alertsSubject = new BehaviorSubject<AlertResponse[] | null>(null);
  private readonly pageSubject = new BehaviorSubject<Page<AlertResponse> | null>(null);
  private readonly statsSubject = new BehaviorSubject<AlertStatsResponse | null>(null);
  private readonly selectedAlertSubject = new BehaviorSubject<AlertResponse | null>(null);

  readonly alerts$ = this.alertsSubject.asObservable();
  readonly page$ = this.pageSubject.asObservable();
  readonly stats$ = this.statsSubject.asObservable();
  readonly selectedAlert$ = this.selectedAlertSubject.asObservable();
  readonly machines$ = this.equipmentService.machines$;

  filters: AlertListFilters = {};
  listError: string | null = null;
  detailError: string | null = null;
  isListLoading = false;
  isDetailLoading = false;
  isCreateSubmitting = false;
  isActionSubmitting = false;

  showCreateModal = false;
  actionModalMode: AlertActionMode | null = null;

  private currentPage = 0;
  private readonly pageSize = 10;
  private pendingActionId: number | null = null;
  private currentUser: User | null = null;
  canCreateAlerts = true;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly alertApi: AlertApiService,
    private readonly equipmentService: EquipmentService,
    private readonly authService: AuthService,
    private readonly wsService: MachineWebSocketService,
    private readonly confirmDialog: ConfirmDialogService
  ) {}

  private statsInitialized = false;

  ngOnInit(): void {
    this.equipmentService.loadMachines(0, 100);

    // Wait for the real current user before the first fetch — otherwise
    // fetchAlerts()/fetchStats() would run against a null user and skip the
    // technician-scoping entirely on first load.
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.canCreateAlerts = !this.isTechnician(user);

      if (!this.statsInitialized) {
        this.statsInitialized = true;
        this.fetchAlerts();
        this.fetchStats();
      }
    });

    // Live incident feed — the backend now resolves/updates/creates alerts
    // in real time (machine degrade/recover cycles) and pushes each change
    // over /topic/alerts instead of only on a manual refresh.
    this.wsService.connect();
    this.wsService.alertEvents$
      .pipe(
        filter((event): event is AlertStreamEvent => event !== null),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => this.handleAlertEvent(event));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsService.disconnect();
  }

  private handleAlertEvent(event: AlertStreamEvent): void {
    // Refetch through the existing REST path so the current filters/
    // pagination/stats stay authoritative — the socket event is just the
    // live trigger, not a partial substitute for the full AlertResponse.
    this.fetchAlerts(this.currentPage);
    this.fetchStats();

    if (this.selectedAlertSubject.value?.id !== event.alertId) {
      return;
    }

    if (event.eventType === 'RESOLVED') {
      // The REST DTO doesn't expose resolvedDate — stamp it locally from
      // the live event so the open detail panel reflects it immediately.
      const resolved: AlertResponse = {
        ...(this.selectedAlertSubject.value as AlertResponse),
        status: AlertStatus.RESOLVED,
        resolvedDate: event.timestamp,
      };
      this.selectedAlertSubject.next(resolved);
      this.patchAlertInList(resolved);
    } else {
      this.loadAlertDetail(event.alertId);
    }
  }

  handleFiltersChange(filters: AlertListFilters): void {
    this.filters = filters;
    this.fetchAlerts(0);
  }

  handlePageChange(page: number): void {
    this.fetchAlerts(page);
  }

  handleSelectAlert(alertId: number): void {
    this.loadAlertDetail(alertId);
  }

  handleRefresh(): void {
    this.fetchAlerts();
    this.fetchStats();
  }

  openCreateModal(): void {
    if (!this.canCreateAlerts) {
      return;
    }
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  submitCreate(payload: CreateAlertPayload): void {
    if (!this.canCreateAlerts) {
      return;
    }
    this.isCreateSubmitting = true;
    this.alertApi.create(payload).subscribe({
      next: (alert) => {
        this.isCreateSubmitting = false;
        this.showCreateModal = false;
        this.fetchAlerts(0);
        this.fetchStats();
        this.loadAlertDetail(alert.id);
      },
      error: (error) => {
        this.isCreateSubmitting = false;
        this.listError = error.error?.message || 'Failed to create alert';
      },
    });
  }

  openActionModal(mode: AlertActionMode, alertId: number): void {
    this.actionModalMode = mode;
    this.pendingActionId = alertId;
  }

  closeActionModal(): void {
    this.actionModalMode = null;
    this.pendingActionId = null;
  }

  submitAction(
    payload: AcknowledgeAlertPayload | EscalateAlertPayload | CloseAlertPayload
  ): void {
    if (!this.actionModalMode || this.pendingActionId === null) {
      return;
    }

    this.isActionSubmitting = true;

    let request$;
    if (this.actionModalMode === 'acknowledge') {
      request$ = this.alertApi.acknowledge(this.pendingActionId, payload as AcknowledgeAlertPayload);
    } else if (this.actionModalMode === 'escalate') {
      request$ = this.alertApi.escalate(this.pendingActionId, payload as EscalateAlertPayload);
    } else {
      request$ = this.alertApi.close(this.pendingActionId, payload as CloseAlertPayload);
    }

    request$.subscribe({
      next: (alert) => {
        this.isActionSubmitting = false;
        this.closeActionModal();
        this.patchAlertInList(alert);
        this.selectedAlertSubject.next(alert);
        this.fetchStats();
      },
      error: (error) => {
        this.isActionSubmitting = false;
        this.detailError = error.status === 403
          ? 'You do not have permission to perform this action.'
          : (error.error?.message || 'Failed to update alert');
      },
    });
  }

  async deleteAlert(alertId: number): Promise<void> {
    const alert =
      this.selectedAlertSubject.value?.id === alertId
        ? this.selectedAlertSubject.value
        : this.alertsSubject.value?.find((a) => a.id === alertId) ?? null;

    const confirmed = await this.confirmDialog.confirmDanger(
      'Delete alert',
      alert
        ? `Delete "${alert.title}"? This cannot be undone.`
        : 'Delete this alert? This cannot be undone.'
    );
    if (!confirmed) {
      return;
    }

    this.isActionSubmitting = true;
    this.alertApi.delete(alertId).subscribe({
      next: () => {
        this.isActionSubmitting = false;
        this.closeActionModal();
        this.selectedAlertSubject.next(null);
        this.fetchAlerts(this.currentPage);
        this.fetchStats();
      },
      error: (error) => {
        this.isActionSubmitting = false;
        this.detailError = error.error?.message || 'Failed to delete alert';
      },
    });
  }

  private fetchAlerts(page: number = this.currentPage): void {
    this.isListLoading = true;
    this.listError = null;
    this.currentPage = page;

    const params = this.buildQueryParams(page);

    this.alertApi.list(params).subscribe({
      next: (response) => {
        this.isListLoading = false;
        const visibleAlerts = this.isTechnician(this.currentUser)
          ? this.filterAssignedAlerts(response.content, this.currentUser)
          : response.content;
        this.alertsSubject.next(visibleAlerts);
        this.pageSubject.next(response);
        if (visibleAlerts.length && !this.selectedAlertSubject.value) {
          this.loadAlertDetail(visibleAlerts[0].id);
        }
      },
      error: (error) => {
        this.isListLoading = false;
        this.listError = error.status === 403
          ? 'You do not have access to alerts. Contact an administrator.'
          : (error.error?.message || 'Failed to load alerts');
      },
    });
  }

  private loadAlertDetail(alertId: number): void {
    this.isDetailLoading = true;
    this.detailError = null;
    this.alertApi.get(alertId).subscribe({
      next: (alert) => {
        this.isDetailLoading = false;
        this.selectedAlertSubject.next(alert);
        this.patchAlertInList(alert);
      },
      error: (error) => {
        this.isDetailLoading = false;
        this.detailError = error.error?.message || 'Failed to load alert detail';
      },
    });
  }

  private fetchStats(): void {
    if (this.isTechnician(this.currentUser)) {
      // The global /alerts/stats endpoint is system-wide (all technicians, all
      // machines) — showing it here would contradict a technician's own, much
      // smaller feed. Compute their real numbers from their own assigned alerts.
      this.fetchTechnicianStats();
      return;
    }

    this.alertApi.stats().subscribe({
      next: (stats) => this.statsSubject.next(stats),
      error: () => {},
    });
  }

  private fetchTechnicianStats(): void {
    const technicianAssignedTo = this.currentUser?.username || this.currentUser?.email;

    if (!technicianAssignedTo) {
      this.statsSubject.next(this.computeStatsFromAlerts([]));
      return;
    }

    this.alertApi.list({ assignedTo: technicianAssignedTo, page: 0, size: 500 }).subscribe({
      next: (response) => {
        const ownAlerts = this.filterAssignedAlerts(response.content, this.currentUser);
        this.statsSubject.next(this.computeStatsFromAlerts(ownAlerts));
      },
      error: () => this.statsSubject.next(this.computeStatsFromAlerts([])),
    });
  }

  private computeStatsFromAlerts(alerts: AlertResponse[]): AlertStatsResponse {
    return {
      totalAlerts: alerts.length,
      newAlerts: alerts.filter((a) => a.status === AlertStatus.NEW).length,
      acknowledgedAlerts: alerts.filter((a) => a.status === AlertStatus.ACKNOWLEDGED).length,
      escalatedAlerts: alerts.filter((a) => a.status === AlertStatus.ESCALATED).length,
      closedAlerts: alerts.filter((a) => a.status === AlertStatus.CLOSED).length,
      resolvedAlerts: alerts.filter((a) => a.status === AlertStatus.RESOLVED).length,
      criticalCount: alerts.filter((a) => a.severity === AlertSeverity.CRITICAL).length,
      warningCount: alerts.filter((a) => a.severity === AlertSeverity.WARNING).length,
      infoCount: alerts.filter((a) => a.severity === AlertSeverity.INFO).length,
      unviewedCount: alerts.filter((a) => !a.viewed).length,
    };
  }

  private patchAlertInList(alert: AlertResponse): void {
    const current = this.alertsSubject.value;
    if (!current) {
      return;
    }
    const updated = current.map((existing) =>
      existing.id === alert.id ? { ...existing, ...alert } : existing
    );
    this.alertsSubject.next(updated);
  }

  private buildQueryParams(page: number): {
    page: number;
    size: number;
    status?: AlertStatus;
    severity?: AlertSeverity;
    assignedTo?: string;
    search?: string;
    viewed?: boolean;
  } {
    const technicianAssignedTo = this.isTechnician(this.currentUser)
      ? (this.currentUser?.username || this.currentUser?.email)
      : undefined;

    return {
      page,
      size: this.pageSize,
      status: this.filters.status,
      severity: this.filters.severity,
      assignedTo: technicianAssignedTo || this.filters.assignedTo,
      search: this.filters.search,
      viewed: this.filters.viewedOnly ? false : undefined,
    };
  }

  private isTechnician(user: User | null): boolean {
    if (!user?.roles) {
      return false;
    }
    return user.roles.some((role) => normalizeRoleName(role.name) === 'TECHNICIAN');
  }

  private filterAssignedAlerts(alerts: AlertResponse[], user: User | null): AlertResponse[] {
    if (!user) {
      return alerts;
    }
    const userId = user.id;
    const username = user.username;
    const email = user.email;
    const userDisplayName = user.displayName;
    return alerts.filter((alert) => {
      const assigned = alert.assignedTo;
      const alertDisplayName = alert.assignedToDisplayName;
      return (
        assigned === userId ||
        assigned === username ||
        assigned === email ||
        alertDisplayName === username ||
        alertDisplayName === userDisplayName
      );
    });
  }
}
