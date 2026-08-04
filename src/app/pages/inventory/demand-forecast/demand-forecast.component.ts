import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupplierService } from '../../../core/services/supplier.service';
import { DemandForecastEntry } from '../../../core/models/sentinel.models';

@Component({
  selector: 'app-demand-forecast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './demand-forecast.component.html',
  styleUrl: './demand-forecast.component.scss',
})
export class DemandForecastComponent implements OnInit {
  entries: DemandForecastEntry[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private supplierService: SupplierService) {}

  ngOnInit(): void {
    this.supplierService.getDemandForecast().subscribe({
      next: (entries) => { this.entries = entries; this.isLoading = false; },
      error: () => { this.error = 'Could not load the demand forecast.'; this.isLoading = false; },
    });
  }

  urgencyClass(days: number | null): string {
    if (days == null) return 'urgency-unknown';
    if (days <= 14) return 'urgency-critical';
    if (days <= 30) return 'urgency-warn';
    return 'urgency-ok';
  }

  formatDays(days: number | null): string {
    return days == null ? 'No consumption trend' : `${Math.round(days)} days`;
  }
}
