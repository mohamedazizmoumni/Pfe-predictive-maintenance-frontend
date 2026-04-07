import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { InventoryAnalyticsComponent } from './inventory-analytics/inventory-analytics.component';
import { PartsListComponent } from './parts-list/parts-list.component';
import { ReorderRequestsComponent } from './reorder-requests/reorder-requests.component';
import { StockOrdersComponent } from './stock-orders/stock-orders.component';

interface InventoryTab {
  id: 'parts' | 'reorders' | 'orders' | 'analytics';
  label: string;
  description: string;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, PartsListComponent, ReorderRequestsComponent, StockOrdersComponent, InventoryAnalyticsComponent],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent {
  tabs: InventoryTab[] = [
    { id: 'parts', label: 'Spare Parts', description: 'Current stock levels and reorder signals.' },
    { id: 'reorders', label: 'Reorder Requests', description: 'Track requested replenishments.' },
    { id: 'orders', label: 'Stock Orders', description: 'Follow purchase orders through delivery.' },
    { id: 'analytics', label: 'Analytics', description: 'Inventory KPIs and risk indicators.' }
  ];

  activeTab: InventoryTab['id'] = 'parts';

  setTab(tab: InventoryTab['id']): void {
    this.activeTab = tab;
  }

  isActive(tab: InventoryTab['id']): boolean {
    return this.activeTab === tab;
  }
}
