import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { StockOrder } from '../../../core/models/sentinel.models';
import { InventoryService } from '../../../core/services/inventory.service';

@Component({
  selector: 'app-stock-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stock-orders.component.html',
  styleUrls: ['./stock-orders.component.scss']
})
export class StockOrdersComponent implements OnInit {
  orders: StockOrder[] = [];
  isLoading = false;
  error: string | null = null;

  constructor(private readonly inventoryService: InventoryService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getStockOrders().subscribe({
      next: (response) => {
        this.orders = response?.content ?? response ?? [];
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Failed to load stock orders';
        this.isLoading = false;
      }
    });
  }
}
