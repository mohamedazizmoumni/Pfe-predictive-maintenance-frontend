import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { RapportService } from '../../core/services/rapport.service';
import { ReportService } from '../../core/services/report.service';
import { AuthService } from '../../core/services/auth.service';
import { rolesCollectionHasAny } from '../../core/utils/role.utils';
import { MaintenanceRapportResponse } from '../../core/models/sentinel.models';

type ApprovalTab = 'manager' | 'finance';
type ReviewMode = 'approve' | 'reject';

@Component({
  selector: 'app-rapport-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rapport-approvals.component.html',
  styleUrl: './rapport-approvals.component.scss',
})
export class RapportApprovalsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  isManager = false;
  isFinanceManager = false;
  activeTab: ApprovalTab = 'manager';

  isLoading = false;
  error: string | null = null;
  successMessage: string | null = null;

  managerRapports: MaintenanceRapportResponse[] = [];
  financeRapports: MaintenanceRapportResponse[] = [];

  reviewingRapport: MaintenanceRapportResponse | null = null;
  reviewMode: ReviewMode = 'approve';
  rejectionReason = '';
  reviewNote = '';
  isReviewing = false;

  constructor(
    private rapportService: RapportService,
    private reportService: ReportService,
    private authService: AuthService,
  ) {}

  downloadReport(rapport: MaintenanceRapportResponse): void {
    this.reportService.downloadMaintenanceInterventionReport(rapport.id);
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.isManager = rolesCollectionHasAny(user?.roles, ['MANAGER', 'ADMIN', 'SUPER_ADMIN']);
    this.isFinanceManager = rolesCollectionHasAny(user?.roles, ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN']);
    this.activeTab = this.isFinanceManager && !this.isManager ? 'finance' : 'manager';

    this.rapportService.error$.pipe(takeUntil(this.destroy$)).subscribe(e => this.error = e);

    this.loadAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAll(): void {
    this.isLoading = true;
    let pending = 0;
    const done = () => { if (--pending <= 0) this.isLoading = false; };

    if (this.isManager) {
      pending++;
      this.rapportService.getPendingManagerApprovals().pipe(takeUntil(this.destroy$)).subscribe({
        next: list => { this.managerRapports = list; done(); },
        error: () => done(),
      });
    }
    if (this.isFinanceManager) {
      pending++;
      this.rapportService.getPendingFinanceApprovals().pipe(takeUntil(this.destroy$)).subscribe({
        next: list => { this.financeRapports = list; done(); },
        error: () => done(),
      });
    }
    if (pending === 0) this.isLoading = false;
  }

  setTab(tab: ApprovalTab): void {
    this.activeTab = tab;
  }

  openReview(rapport: MaintenanceRapportResponse, mode: ReviewMode): void {
    this.reviewingRapport = rapport;
    this.reviewMode = mode;
    this.rejectionReason = '';
    this.reviewNote = '';
    this.successMessage = null;
  }

  closeReview(): void {
    this.reviewingRapport = null;
    this.rejectionReason = '';
    this.reviewNote = '';
  }

  /** True once approving a rapport with failed checklist items requires an explicit note (backend rule #29). */
  get requiresReviewNote(): boolean {
    return this.reviewMode === 'approve' && !!this.reviewingRapport?.hasFailedChecklistItems;
  }

  handleReview(): void {
    if (!this.reviewingRapport) return;
    if (this.reviewMode === 'reject' && !this.rejectionReason.trim()) return;
    if (this.requiresReviewNote && !this.reviewNote.trim()) return;

    this.isReviewing = true;
    const id = this.reviewingRapport.id;
    const request = {
      approved: this.reviewMode === 'approve',
      rejectionReason: this.rejectionReason || undefined,
      reviewNote: this.reviewNote || undefined,
    };

    const op$ = this.activeTab === 'manager'
      ? this.rapportService.managerApproval(id, request)
      : this.rapportService.financeApproval(id, request);

    op$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isReviewing = false;
        this.successMessage = this.reviewMode === 'approve'
          ? (this.activeTab === 'manager' ? 'Rapport approved and forwarded to finance.' : 'Rapport approved.')
          : 'Rapport rejected.';
        this.closeReview();
        this.loadAll();
        // Keep the sidebar badge in sync — a manager approval also moves a
        // rapport into the finance queue, so both stages may have changed.
        this.rapportService.refreshPendingCount(this.isManager, this.isFinanceManager);
      },
      error: () => { this.isReviewing = false; },
    });
  }

  totalCost(rapport: MaintenanceRapportResponse): number {
    return rapport.totalCost ?? 0;
  }

  dismissError(): void { this.rapportService.clearError(); }
  dismissSuccess(): void { this.successMessage = null; }

  trackById(_: number, item: MaintenanceRapportResponse): number { return item.id; }
}
