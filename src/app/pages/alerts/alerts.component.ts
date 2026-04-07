import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import {
  AlertResponse,
  AlertStatsResponse,
  AlertSeverity,
  AlertStatus,
  AcknowledgeAlertPayload,
  CloseAlertPayload,
  CreateAlertPayload,
  EscalateAlertPayload,
  Page,
} from '../../core/models/sentinel.models';
import { AlertApiService } from '../../core/services/alert.service';
import { EquipmentService } from '../../core/services/equipment.service';
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
export class AlertsComponent implements OnInit {
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

  constructor(
    private readonly alertApi: AlertApiService,
    private readonly equipmentService: EquipmentService
  ) {}

  ngOnInit(): void {
    this.fetchAlerts();
    this.fetchStats();
    this.equipmentService.loadMachines(0, 100);
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
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  submitCreate(payload: CreateAlertPayload): void {
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

  deleteAlert(alertId: number): void {
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
        this.alertsSubject.next(response.content);
        this.pageSubject.next(response);
        if (response.content.length && !this.selectedAlertSubject.value) {
          this.loadAlertDetail(response.content[0].id);
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
    this.alertApi.stats().subscribe({
      next: (stats) => this.statsSubject.next(stats),
      error: () => {},
    });
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
    return {
      page,
      size: this.pageSize,
      status: this.filters.status,
      severity: this.filters.severity,
      assignedTo: this.filters.assignedTo,
      search: this.filters.search,
      viewed: this.filters.viewedOnly ? false : undefined,
    };
  }
}
