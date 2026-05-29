import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
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

  fetchAnalytics(): void {
    this.loading = true;
    this.error = null;

    // Load parts and reorders in parallel first so the stats computation
    // has both caches populated (pendingOrdersCount needs reorders).
    forkJoin([
      this.inventoryService.getParts(0, 10000),
      this.inventoryService.getReorders(0, 10000),
    ]).subscribe({
      next: () => {
        // Both caches are now warm — getInventoryStats() reads them synchronously.
        this.inventoryService.getInventoryStats().subscribe({
          next: (data: InventoryStats) => {
            this.stats = data;
            this.loading = false;
          },
          error: () => {
            this.error = 'Failed to compute analytics.';
            this.loading = false;
          }
        });
      },
      error: () => {
        // Partial failure: still try to compute with whatever was loaded
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
    });
  }

  // ---- Derived statistics (unchanged) ----

  get healthyPartsCount(): number {
    if (!this.stats) return 0;
    const { totalPartsTracked, lowStockPartsCount, outOfStockPartsCount } = this.stats;
    const healthy = totalPartsTracked - lowStockPartsCount - outOfStockPartsCount;
    return healthy > 0 ? healthy : 0;
  }

  get stockHealthPercentages(): { healthy: number; low: number; out: number } {
    if (!this.stats || this.stats.totalPartsTracked === 0) {
      return { healthy: 0, low: 0, out: 0 };
    }
    const total = this.stats.totalPartsTracked;
    const toPercent = (value: number) => Math.round((value / total) * 100);
    return {
      healthy: toPercent(this.healthyPartsCount),
      low: toPercent(this.stats.lowStockPartsCount),
      out: toPercent(this.stats.outOfStockPartsCount),
    };
  }

  get stockHealthPieBackground(): string {
    const { healthy: h, low: l, out: o } = this.stockHealthPercentages;
    const hEnd = h;
    const lEnd = h + l;
    const oEnd = h + l + o;
    return `conic-gradient(#4ade80 0 ${hEnd}%, #facc15 ${hEnd}% ${lEnd}%, #f97373 ${lEnd}% ${oEnd}%, #e5e7eb ${oEnd}% 100%)`;
  }

  get turnoverBucket(): 'low' | 'target' | 'high' | null {
    if (!this.stats || this.stats.turnoverRate == null) return null;
    const t = this.stats.turnoverRate;
    if (t < 2) return 'low';
    if (t <= 6) return 'target';
    return 'high';
  }

  get turnoverPositionPercent(): number {
    if (!this.stats || this.stats.turnoverRate == null) return 0;
    const clamped = Math.min(Math.max(this.stats.turnoverRate, 0), 10);
    return (clamped / 10) * 100;
  }
}