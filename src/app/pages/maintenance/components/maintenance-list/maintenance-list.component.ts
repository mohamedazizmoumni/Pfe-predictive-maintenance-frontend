import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Maintenance } from '../../../../core/models/sentinel.models';
import { MaintenancePagination } from '../../../../core/services/maintenance.service';

interface FilterOption {
  label: string;
  value?: string;
  hint?: string;
}

@Component({
  selector: 'app-maintenance-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './maintenance-list.component.html',
  styleUrl: './maintenance-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceListComponent {
  @Input() tasks: Maintenance[] | null = [];
  @Input() pagination: MaintenancePagination | null = null;
  @Input() isLoading: boolean | null = false;
  @Input() error: string | null = null;
  @Input() activeStatus?: string | null;
  @Input() activePriority?: string | null;
  @Input() selectedTaskId: string | null = null;
  @Input() canCreate = true;

  @Output() filtersChange = new EventEmitter<{ status?: string; priority?: string }>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() refreshRequested = new EventEmitter<void>();
  @Output() selectTask = new EventEmitter<string>();
  @Output() createRequested = new EventEmitter<void>();

  statusFilters: FilterOption[] = [
    { label: 'All', value: undefined, hint: 'Every state' },
    { label: 'Scheduled', value: 'SCHEDULED', hint: 'Queued' },
    { label: 'In Progress', value: 'IN_PROGRESS', hint: 'Active crews' },
    { label: 'Completed', value: 'COMPLETED', hint: 'Closed tickets' },
    { label: 'Approved', value: 'APPROVED', hint: 'Validated' },
    { label: 'Cancelled', value: 'CANCELLED', hint: 'Archived' },
  ];

  priorityFilters: FilterOption[] = [
    { label: 'All', value: undefined },
    { label: 'Critical', value: 'CRITICAL' },
    { label: 'High', value: 'HIGH' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'Low', value: 'LOW' },
  ];

  trackById(_: number, task: Maintenance): string {
    return task.id;
  }

  onStatusFilterChange(value?: string): void {
    this.filtersChange.emit({
      status: value,
      priority: this.activePriority || undefined,
    });
  }

  onPriorityFilterChange(value?: string): void {
    this.filtersChange.emit({
      status: this.activeStatus || undefined,
      priority: value,
    });
  }

  onPageChange(direction: 'prev' | 'next'): void {
    if (!this.pagination) {
      return;
    }

    const nextPage =
      direction === 'prev'
        ? Math.max(0, this.pagination.currentPage - 1)
        : Math.min(this.pagination.totalPages - 1, this.pagination.currentPage + 1);

    if (nextPage === this.pagination.currentPage) {
      return;
    }

    this.pageChange.emit(nextPage);
  }

  handleSelect(taskId: string): void {
    this.selectTask.emit(taskId);
  }

  getStatusChipClass(status: Maintenance['status']): string {
    return `status-chip status-${status.toLowerCase()}`;
  }

  getPriorityClass(priority: Maintenance['priority']): string {
    return `priority-chip priority-${priority.toLowerCase()}`;
  }
}
