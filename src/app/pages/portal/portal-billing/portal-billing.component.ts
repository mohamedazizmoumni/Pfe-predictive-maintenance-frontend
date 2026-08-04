import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortalService } from '../../../core/services/portal.service';
import { InvoiceResponse } from '../../../core/models/sentinel.models';

@Component({
  selector: 'app-portal-billing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portal-billing.component.html',
  styleUrl: './portal-billing.component.scss',
})
export class PortalBillingComponent implements OnInit {
  invoices: InvoiceResponse[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private portalService: PortalService) {}

  ngOnInit(): void {
    this.portalService.getMyInvoices().subscribe({
      next: (invoices) => { this.invoices = invoices; this.isLoading = false; },
      error: () => { this.error = 'Could not load your invoices.'; this.isLoading = false; },
    });
  }

  statusClass(status: string): string {
    return 'status-' + status.toLowerCase();
  }

  get totalUnpaid(): number {
    return this.invoices
      .filter(i => i.status === 'UNPAID' || i.status === 'OVERDUE')
      .reduce((sum, i) => sum + i.amount, 0);
  }
}
