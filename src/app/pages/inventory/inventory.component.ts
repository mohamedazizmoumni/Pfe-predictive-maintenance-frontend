import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent {
  readonly sections = [
    {
      label: 'Spare Parts',
      description: 'Current stock levels, pricing, and reorder signals.',
      path: '/inventory/parts',
      tone: 'info',
    },
    {
      label: 'Reorder Requests',
      description: 'Approve replenishment requests and capture demand.',
      path: '/inventory/reorders',
      tone: 'warning',
    },
    {
      label: 'Stock Orders',
      description: 'Follow purchase orders from issue to receipt.',
      path: '/inventory/stock-orders',
      tone: 'good',
    },
    {
      label: 'Analytics',
      description: 'Inventory KPIs, stock health, and movement indicators.',
      path: '/inventory/analytics',
      tone: 'critical',
    },
  ];
}
