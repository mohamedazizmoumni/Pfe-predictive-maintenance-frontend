import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinanceDashboardResponse, BudgetResponse, MaintenanceRapportResponse } from '../../core/models/sentinel.models';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent implements OnInit {
  readonly dashboard = signal<FinanceDashboardResponse | null>(null);
  readonly budgets = signal<BudgetResponse[]>([]);
  readonly pendingManagerApprovals = signal<MaintenanceRapportResponse[]>([]);
  readonly pendingFinanceApprovals = signal<MaintenanceRapportResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {}

  ngOnInit(): void {
    this.loadReportData();
  }

  loadReportData(): void {
    this.loading.set(true);
    this.error.set('Finance service not implemented. This feature requires backend integration.');
    this.loading.set(false);
    
    // TODO: Implement finance service calls when backend is ready
    // this.financeService.getDashboard().subscribe(...)
    // this.financeService.getBudgets().subscribe(...)
    // this.financeService.getPendingManagerApprovals().subscribe(...)
    // this.financeService.getPendingFinanceApprovals().subscribe(...)
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  formatHours(hours: number): string {
    return `${hours.toFixed(1)}h`;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'PENDING_FINANCE_APPROVAL':
        return 'info';
      case 'PENDING_MANAGER_APPROVAL':
        return 'warning';
      case 'REJECTED':
        return 'danger';
      default:
        return 'default';
    }
  }

  getBudgetPercentage(budget: BudgetResponse): number {
    return budget.allocatedAmount > 0 ? (budget.spentAmount / budget.allocatedAmount) * 100 : 0;
  }

  getBudgetClass(percentage: number): string {
    if (percentage >= 100) return 'budget-critical';
    if (percentage >= 85) return 'budget-warning';
    return 'budget-ok';
  }

  getTotalLaborCost(rapports: MaintenanceRapportResponse[]): number {
    return rapports.reduce((sum, r) => sum + (r.laborCost || 0), 0);
  }

  getTotalPartsCost(rapports: MaintenanceRapportResponse[]): number {
    return rapports.reduce((sum, r) => sum + (r.partsCost || 0), 0);
  }

  getTotalCost(rapports: MaintenanceRapportResponse[]): number {
    return rapports.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  }

  trackByBudgetId(index: number, budget: BudgetResponse): number {
    return budget.id;
  }

  trackByRapportId(index: number, rapport: MaintenanceRapportResponse): number {
    return rapport.id;
  }
}
