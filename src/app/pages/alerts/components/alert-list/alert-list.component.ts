import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertResponse,
  AlertSeverity,
  AlertStatus,
  Page,
} from '../../../../core/models/sentinel.models';
import { AlertListFilters } from '../../alert.types';

interface FilterOption<T> {
  label: string;
  value?: T;
  hint?: string;
}

@Component({
  selector: 'app-alert-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-list.component.html',
  styleUrl: './alert-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertListComponent implements OnChanges {
  @Input() alerts: AlertResponse[] | null = [];
  @Input() page: Page<AlertResponse> | null = null;
  @Input() isLoading: boolean | null = false;
  @Input() error: string | null = null;
  @Input() filters: AlertListFilters | null = null;
  @Input() selectedAlertId: number | null = null;
  @Input() canCreate = true;

  @Output() filtersChange = new EventEmitter<AlertListFilters>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() refreshRequested = new EventEmitter<void>();
  @Output() selectAlert = new EventEmitter<number>();
  @Output() createRequested = new EventEmitter<void>();

  readonly severityOptions: FilterOption<AlertSeverity>[] = [
    { label: 'All', value: undefined },
    { label: 'Info', value: AlertSeverity.INFO },
    { label: 'Warning', value: AlertSeverity.WARNING },
    { label: 'Critical', value: AlertSeverity.CRITICAL },
  ];

  readonly statusOptions: FilterOption<AlertStatus>[] = [
    { label: 'All states', value: undefined },
    { label: 'New', value: AlertStatus.NEW, hint: 'Unassigned incidents' },
    { label: 'Acknowledged', value: AlertStatus.ACKNOWLEDGED, hint: 'Triaged' },
    { label: 'Escalated', value: AlertStatus.ESCALATED, hint: 'Handed off' },
    { label: 'Closed', value: AlertStatus.CLOSED, hint: 'Resolved' },
  ];

  assignedSearch = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters']) {
      this.assignedSearch = this.filters?.assignedTo || '';
    }
  }

  trackByAlertId(_: number, alert: AlertResponse): number {
    return alert.id;
  }

  setStatusFilter(status?: AlertStatus): void {
    this.emitFilters({
      ...this.filters,
      status,
    });
  }

  setSeverityFilter(severity?: AlertSeverity): void {
    this.emitFilters({
      ...this.filters,
      severity,
    });
  }

  toggleUnviewed(): void {
    const viewedOnly = !(this.filters?.viewedOnly ?? false);
    this.emitFilters({
      ...this.filters,
      viewedOnly,
    });
  }

  applyAssignedSearch(value: string): void {
    this.assignedSearch = value;
    this.emitFilters({
      ...this.filters,
      assignedTo: value.trim() || undefined,
    });
  }

  applySearchTerm(value: string): void {
    this.emitFilters({
      ...this.filters,
      search: value.trim() || undefined,
    });
  }

  clearFilters(): void {
    this.assignedSearch = '';
    this.emitFilters({});
  }

  onPageChange(direction: 'prev' | 'next'): void {
    if (!this.page) {
      return;
    }

    const current = this.page.number;
    const nextPage =
      direction === 'prev'
        ? Math.max(0, current - 1)
        : Math.min(this.page.totalPages - 1, current + 1);

    if (nextPage === current) {
      return;
    }

    this.pageChange.emit(nextPage);
  }

  getSeverityBadgeClass(severity: AlertSeverity): string {
    return `severity-badge severity-${severity.toLowerCase()}`;
  }

  getStatusChipClass(status: AlertStatus): string {
    return `status-chip status-${status.toLowerCase()}`;
  }

  handleSelect(alert: AlertResponse): void {
    this.selectAlert.emit(alert.id);
  }

  emitFilters(filters: AlertListFilters): void {
    this.filtersChange.emit(filters);
  }
}
