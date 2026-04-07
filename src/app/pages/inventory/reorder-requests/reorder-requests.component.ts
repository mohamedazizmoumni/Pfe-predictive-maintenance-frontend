import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ReorderRequest } from '../../../core/models/sentinel.models';
import { InventoryService } from '../../../core/services/inventory.service';

@Component({
  selector: 'app-reorder-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reorder-requests.component.html',
  styleUrls: ['./reorder-requests.component.scss']
})
export class ReorderRequestsComponent implements OnInit {
  requests: ReorderRequest[] = [];
  pending: ReorderRequest[] = [];
  isLoading = false;
  error: string | null = null;

  constructor(private readonly inventoryService: InventoryService) {}

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
        this.pending = content.filter((req: ReorderRequest) => req.status === 'REQUESTED');
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Failed to load reorder requests';
        this.isLoading = false;
      }
    });
  }
}
