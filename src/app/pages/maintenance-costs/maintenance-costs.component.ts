import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaintenanceRapportResponse } from '../../core/models/sentinel.models';

@Component({
  selector: 'app-maintenance-costs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './maintenance-costs.component.html',
  styleUrl: './maintenance-costs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceCostsComponent implements OnInit {
  readonly pendingRapports = signal<MaintenanceRapportResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {}

  ngOnInit(): void {
    this.loadPendingRapports();
  }

  loadPendingRapports(): void {
    this.loading.set(true);
    this.error.set('Finance service not implemented. This feature requires backend integration.');
    this.loading.set(false);
    
    // TODO: Implement finance service call when backend is ready
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
      default:
        return 'default';
    }
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

  trackByRapportId(index: number, rapport: MaintenanceRapportResponse): number {
    return rapport.id;
  }
}
