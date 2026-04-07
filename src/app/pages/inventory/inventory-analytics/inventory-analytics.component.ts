import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryStats } from '../../../core/models/sentinel.models';

@Component({
  selector: 'app-inventory-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventory-analytics.component.html',
  styleUrls: ['./inventory-analytics.component.scss']
})
export class InventoryAnalyticsComponent {
  stats: InventoryStats | null = null;
  loading = false;
  error: string | null = null;

  constructor(private inventoryService: InventoryService) {
    this.fetchAnalytics();
  }

  fetchAnalytics() {
    this.loading = true;
    this.inventoryService.getInventoryStats().subscribe({
      next: (data: InventoryStats) => {
        this.stats = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load analytics.';
        this.loading = false;
      }
    });
  }

  // Derived statistics for charts
  get healthyPartsCount(): number {
    if (!this.stats) {
      return 0;
    }
    const { totalPartsTracked, lowStockPartsCount, outOfStockPartsCount } = this.stats;
    const healthy = totalPartsTracked - lowStockPartsCount - outOfStockPartsCount;
    return healthy > 0 ? healthy : 0;
  }

  get stockHealthPercentages(): { healthy: number; low: number; out: number } {
    if (!this.stats || this.stats.totalPartsTracked === 0) {
      return { healthy: 0, low: 0, out: 0 };
    }
    const total = this.stats.totalPartsTracked;
    const low = this.stats.lowStockPartsCount;
    const out = this.stats.outOfStockPartsCount;
    const healthy = this.healthyPartsCount;

    const toPercent = (value: number) => Math.round((value / total) * 100);

    return {
      healthy: toPercent(healthy),
      low: toPercent(low),
      out: toPercent(out)
    };
  }

  get stockHealthPieBackground(): string {
    const perc = this.stockHealthPercentages;
    const h = perc.healthy;
    const l = perc.low;
    const o = perc.out;

    // Build a conic-gradient pie chart (healthy → low → out)
    const hEnd = h;
    const lEnd = h + l;
    const oEnd = h + l + o;

    return `conic-gradient(#4ade80 0 ${hEnd}%, #facc15 ${hEnd}% ${lEnd}%, #f97373 ${lEnd}% ${oEnd}%, #e5e7eb ${oEnd}% 100%)`;
  }

  get turnoverBucket(): 'low' | 'target' | 'high' | null {
    if (!this.stats || this.stats.turnoverRate == null) {
      return null;
    }
    const t = this.stats.turnoverRate;
    if (t < 2) {
      return 'low';
    }
    if (t <= 6) {
      return 'target';
    }
    return 'high';
  }

  // Normalized position (0–100%) of the current turnover within a 0–10 range
  get turnoverPositionPercent(): number {
    if (!this.stats || this.stats.turnoverRate == null) {
      return 0;
    }
    const min = 0;
    const max = 10;
    let value = this.stats.turnoverRate;
    if (value < min) {
      value = min;
    }
    if (value > max) {
      value = max;
    }
    return ((value - min) / (max - min)) * 100;
  }
}
