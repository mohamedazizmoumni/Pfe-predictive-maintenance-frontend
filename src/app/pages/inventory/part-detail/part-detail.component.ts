import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { Part } from '../../../core/models/sentinel.models';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-part-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './part-detail.component.html',
  styleUrls: ['./part-detail.component.scss']
})
export class PartDetailComponent implements OnInit {
  part: Part | null = null;
  loading = false;
  error: string | null = null;
  deletingImage = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadPart(id);
    } else {
      this.error = 'No part ID provided.';
    }
  }

  loadPart(id: string) {
    this.loading = true;
    this.error = null;
    
    this.inventoryService.getPartById(Number(id)).subscribe({
      next: (part: Part) => {
        this.part = part;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load part details.';
        this.loading = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/inventory']);
  }

  editPart() {
    if (this.part) {
      this.router.navigate(['/inventory/part-form', this.part.id]);
    }
  }

  deleteImage() {
    if (!this.part?.id) return;

    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    this.deletingImage = true;
    this.inventoryService.deletePartImage(this.part.id).subscribe({
      next: (updatedPart) => {
        this.part = updatedPart;
        this.deletingImage = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to delete image';
        this.deletingImage = false;
      }
    });
  }

  getImageUrl(): string | null {
    if (!this.part?.imageUrl) return null;
    
    // If the URL is already absolute, return it as is
    if (this.part.imageUrl.startsWith('http://') || this.part.imageUrl.startsWith('https://')) {
      return this.part.imageUrl;
    }
    
    // Otherwise, prepend the backend base URL (without /api/v1)
    const baseUrl = environment.apiUrl.replace('/api/v1', '');
    return `${baseUrl}${this.part.imageUrl}`;
  }

  getStockStatus(): 'ok' | 'low' | 'critical' {
    if (!this.part) return 'ok';
    
    if (this.part.currentStock === 0) return 'critical';
    if (this.part.currentStock <= this.part.minimumStock) return 'low';
    return 'ok';
  }

  getStockStatusLabel(): string {
    const status = this.getStockStatus();
    if (status === 'critical') return 'Out of Stock';
    if (status === 'low') return 'Low Stock';
    return 'In Stock';
  }

  getStockValue(): number {
    if (!this.part) return 0;
    return this.part.currentStock * this.part.cost;
  }

  getStockAboveMinimum(): number {
    if (!this.part) return 0;
    return this.part.currentStock - this.part.minimumStock;
  }
}
