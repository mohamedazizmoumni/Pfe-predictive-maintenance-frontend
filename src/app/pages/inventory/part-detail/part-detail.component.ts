import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { Part } from '../../../core/models/sentinel.models';
import { rolesCollectionHasAny } from '../../../core/utils/role.utils';
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
  deletingPart = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService,
    private authService: AuthService,
    private confirmDialog: ConfirmDialogService
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

  canDelete(): boolean {
    // Deleting parts is stricter than create/update — only ADMIN/SUPER_ADMIN.
    return rolesCollectionHasAny(
      this.authService.getCurrentUser()?.roles,
      ['SUPER_ADMIN', 'ADMIN']
    );
  }

  async deletePart() {
    if (!this.part || !this.canDelete() || this.deletingPart) return;

    const confirmed = await this.confirmDialog.confirmDanger(
      'Delete part',
      `Delete "${this.part.name}" (#${this.part.partNumber})? This cannot be undone.`
    );
    if (!confirmed) return;

    this.deletingPart = true;
    this.inventoryService.deletePart(this.part.id).subscribe({
      next: () => {
        this.router.navigate(['/inventory']);
      },
      error: (err) => {
        this.deletingPart = false;
        this.error =
          err?.error?.message ??
          'Failed to delete part. It may still be referenced by a reorder or stock order.';
      }
    });
  }

  async deleteImage() {
    if (!this.part?.id) return;

    const confirmed = await this.confirmDialog.confirmDanger(
      'Delete image',
      'Delete this part image? This cannot be undone.'
    );
    if (!confirmed) return;

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

  getStockPercent(): number {
    if (!this.part || !this.part.minimumStock) return 100;
    const ratio = (this.part.currentStock / (this.part.minimumStock * 2)) * 100;
    return Math.max(4, Math.min(100, ratio));
  }

  getStockAboveMinimum(): number {
    if (!this.part) return 0;
    return this.part.currentStock - this.part.minimumStock;
  }
}
