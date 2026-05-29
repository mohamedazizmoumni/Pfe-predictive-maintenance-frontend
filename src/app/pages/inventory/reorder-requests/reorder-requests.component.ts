import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Part, ReorderRequest, ReorderApprovalRequest, StockOrderRequest } from '../../../core/models/sentinel.models';
import { InventoryService } from '../../../core/services/inventory.service';
import { AuthService } from '../../../core/services/auth.service';
import { rolesCollectionHasAny } from '../../../core/utils/role.utils';

@Component({
  selector: 'app-reorder-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reorder-requests.component.html',
  styleUrls: ['./reorder-requests.component.scss']
})
export class ReorderRequestsComponent implements OnInit {
  requests: ReorderRequest[] = [];
  isLoading = false;
  error: string | null = null;
  successMessage: string | null = null;

  // UI state for per-request actions
  approvingId: number | null = null;
  approvalReason = '';
  creatingOrderForId: number | null = null;
  newStockOrder: StockOrderRequest = { reorderRequestId: 0, supplierPurchaseOrder: '', expectedDeliveryDate: '', notes: '' };

  constructor(private readonly inventoryService: InventoryService, private readonly authService: AuthService) {}

  ngOnInit(): void {
    this.loadReorders();
  }

  loadReorders(): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getReorders().subscribe({
      next: (response) => {
        const content = response?.content ?? response ?? [];
        this.requests = content;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Failed to load reorder requests';
        this.isLoading = false;
      }
    });
  }

  // Role helpers
  private get currentRoles() {
    const user = this.authService.getCurrentUser();
    return user?.roles ?? [];
  }

  canApprove(): boolean {
    return rolesCollectionHasAny(this.currentRoles, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
  }

  canManageStock(): boolean {
    return rolesCollectionHasAny(this.currentRoles, ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER']);
  }

  // Approve or reject reorder
  approveRequest(request: ReorderRequest, approve: boolean): void {
    if (!this.canApprove()) {
      this.error = 'Not authorized to approve requests.';
      return;
    }
    this.approvingId = request.id;
    const payload: ReorderApprovalRequest = { approved: approve, reason: this.approvalReason || (approve ? 'Approved' : 'Rejected') };
    this.inventoryService.approveReorder(request.id, payload).subscribe({
      next: () => {
        this.approvingId = null;
        this.approvalReason = '';
        this.loadReorders();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Failed to update approval.';
        this.approvingId = null;
      }
    });
  }

  // Create stock order from approved reorder
  startCreateOrder(requestId: number): void {
    if (!this.canManageStock()) {
      this.error = 'Not authorized to create stock orders.';
      return;
    }
    this.creatingOrderForId = requestId;
    this.newStockOrder = { reorderRequestId: requestId, supplierPurchaseOrder: '', expectedDeliveryDate: '', notes: '' };
  }

  cancelCreateOrder(): void {
    this.creatingOrderForId = null;
    this.newStockOrder = { reorderRequestId: 0, supplierPurchaseOrder: '', expectedDeliveryDate: '', notes: '' };
  }

  submitCreateOrder(): void {
    if (!this.canManageStock() || !this.creatingOrderForId) {
      this.error = 'Not authorized or invalid request.';
      return;
    }
    this.inventoryService.createStockOrder(this.newStockOrder).subscribe({
      next: () => {
        this.successMessage = 'Stock order created.';
        this.cancelCreateOrder();
        // refresh orders and reorders
        this.loadReorders();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Failed to create stock order.';
      }
    });
  }
}
