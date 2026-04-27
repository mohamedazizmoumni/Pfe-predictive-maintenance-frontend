import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StockOrder, StockOrderReceiptRequest } from '../../../core/models/sentinel.models';
import { InventoryService } from '../../../core/services/inventory.service';
import { AuthService } from '../../../core/services/auth.service';
import { rolesCollectionHasAny } from '../../../core/utils/role.utils';

@Component({
  selector: 'app-stock-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-orders.component.html',
  styleUrls: ['./stock-orders.component.scss']
})
export class StockOrdersComponent implements OnInit {
  orders: StockOrder[] = [];
  isLoading = false;
  error: string | null = null;
  receivingId: number | null = null;
  receipt: StockOrderReceiptRequest = { quantityReceived: 0, proofOfDelivery: '', notes: '' };

  constructor(private readonly inventoryService: InventoryService, private readonly authService: AuthService) {}

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

  private get currentRoles() {
    const user = this.authService.getCurrentUser();
    return user?.roles ?? [];
  }

  canReceive(): boolean {
    return rolesCollectionHasAny(this.currentRoles, ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER']);
  }

  startReceive(order: StockOrder): void {
    if (!this.canReceive()) {
      this.error = 'Not authorized to record receipts.';
      return;
    }
    this.receivingId = order.id;
    this.receipt = { quantityReceived: order.quantity, proofOfDelivery: '', notes: '' };
  }

  cancelReceive(): void {
    this.receivingId = null;
    this.receipt = { quantityReceived: 0, proofOfDelivery: '', notes: '' };
  }

  submitReceive(orderId: number): void {
    if (!this.canReceive()) {
      this.error = 'Not authorized.';
      return;
    }
    this.inventoryService.receiveStockOrder(orderId, this.receipt).subscribe({
      next: () => {
        this.receivingId = null;
        this.loadOrders();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Failed to record receipt.';
      }
    });
  }
}
