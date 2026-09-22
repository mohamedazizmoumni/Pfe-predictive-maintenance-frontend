import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RecommendationService } from '../../core/services/recommendation.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { Page, RecommendationStatus, SavedRecommendationResponse } from '../../core/models/sentinel.models';
import { normalizeRoleName } from '../../core/utils/role.utils';
import { RecommendationCardComponent, RecommendationDecision } from '../../components/recommendation-card/recommendation-card.component';

type StatusFilter = 'ALL' | RecommendationStatus;

const PAGE_SIZE = 12;

const FILTER_LABELS: Record<StatusFilter, string> = {
  ALL: 'All',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/**
 * Priority 8: the missing list/history view for the recommendation
 * generate-and-save/approve/reject workflow the backend already exposes
 * (Priority 0.1/2). RecommendationPageComponent only ever showed one
 * machine's latest recommendation - this is the fleet-wide, filterable,
 * paginated list, reusing the same RecommendationCardComponent and
 * RecommendationService the single-machine page already uses.
 */
@Component({
  selector: 'app-recommendation-history',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule, RecommendationCardComponent],
  templateUrl: './recommendation-history.component.html',
  styleUrl: './recommendation-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationHistoryComponent implements OnInit {
  recommendations: SavedRecommendationResponse[] = [];
  activeFilter: StatusFilter = 'ALL';
  page = 0;
  totalPages = 0;
  totalElements = 0;
  isLoading = false;
  private technicianMachineIds: Set<number> | null = null;

  readonly filters: StatusFilter[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

  constructor(
    private recommendationService: RecommendationService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private maintenanceService: MaintenanceService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    const isTechnician = user?.roles?.some(role => normalizeRoleName(role.name) === 'TECHNICIAN');

    if (!isTechnician) {
      this.load();
      return;
    }

    if (!user?.id) {
      this.notificationService.error('Unable to identify the technician account.');
      return;
    }

    this.isLoading = true;
    this.maintenanceService.getTechnicianTasks(user.id, 0, 100).subscribe({
      next: response => {
        this.technicianMachineIds = new Set((response.content || []).map(task => Number(task.machineId)));
        this.load();
      },
      error: () => {
        this.isLoading = false;
        this.notificationService.error('Unable to load your assigned machines.');
        this.cdr.markForCheck();
      },
    });
  }

  filterLabel(filter: StatusFilter): string {
    return FILTER_LABELS[filter];
  }

  setFilter(filter: StatusFilter): void {
    if (filter === this.activeFilter) {
      return;
    }
    this.activeFilter = filter;
    this.page = 0;
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.page) {
      return;
    }
    this.page = page;
    this.load();
  }

  onApprove(decision: RecommendationDecision): void {
    this.recommendationService.approve(decision.id, { note: decision.note }).subscribe({
      next: (updated) => {
        this.replaceInList(updated);
        this.notificationService.success(
          updated.resultingMaintenanceId
            ? `Approved. Maintenance task #${updated.resultingMaintenanceId} created.`
            : 'Approved for monitoring - no maintenance task needed yet.'
        );
      },
      error: (error: Error) => this.notificationService.error(error.message || 'Unable to approve recommendation.'),
    });
  }

  onReject(decision: RecommendationDecision): void {
    this.recommendationService.reject(decision.id, { note: decision.note }).subscribe({
      next: (updated) => {
        this.replaceInList(updated);
        this.notificationService.success('Recommendation rejected.');
      },
      error: (error: Error) => this.notificationService.error(error.message || 'Unable to reject recommendation.'),
    });
  }

  onViewMaintenanceTask(maintenanceId: number): void {
    this.router.navigate(['/maintenance', maintenanceId]);
  }

  trackById(_: number, item: SavedRecommendationResponse): number {
    return item.id;
  }

  private load(): void {
    this.isLoading = true;
    const status = this.activeFilter === 'ALL' ? undefined : this.activeFilter;
    const requestPage = this.technicianMachineIds ? 0 : this.page;
    const requestSize = this.technicianMachineIds ? 1000 : PAGE_SIZE;
    this.recommendationService.history(status, requestPage, requestSize).subscribe({
      next: (result: Page<SavedRecommendationResponse>) => {
        const visibleRecommendations = this.technicianMachineIds
          ? result.content.filter(recommendation => this.technicianMachineIds!.has(Number(recommendation.machineId)))
          : result.content;
        this.totalElements = this.technicianMachineIds ? visibleRecommendations.length : result.totalElements;
        this.totalPages = this.technicianMachineIds
          ? Math.ceil(this.totalElements / PAGE_SIZE)
          : result.totalPages;
        this.recommendations = this.technicianMachineIds
          ? visibleRecommendations.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE)
          : visibleRecommendations;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error: Error) => {
        this.isLoading = false;
        this.notificationService.error(error.message || 'Unable to load recommendation history.');
        this.cdr.markForCheck();
      },
    });
  }

  /** A decided item filtered by status must leave the list once its status no longer matches the active filter. */
  private replaceInList(updated: SavedRecommendationResponse): void {
    const index = this.recommendations.findIndex((r) => r.id === updated.id);
    if (index === -1) {
      return;
    }
    if (this.activeFilter !== 'ALL' && updated.status !== this.activeFilter) {
      this.recommendations = this.recommendations.filter((r) => r.id !== updated.id);
      this.totalElements = Math.max(0, this.totalElements - 1);
    } else {
      this.recommendations = [
        ...this.recommendations.slice(0, index),
        updated,
        ...this.recommendations.slice(index + 1),
      ];
    }
    this.cdr.markForCheck();
  }
}
