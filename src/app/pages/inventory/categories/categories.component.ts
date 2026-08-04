import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {
  categories: Array<{ id: number; name: string }> = [];
  loading = false;
  error: string | null = null;

  constructor(private inventoryService: InventoryService, private router: Router) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.inventoryService.getCategoryObjects().subscribe({
      next: (cats: any[]) => {
        this.categories = cats || [];
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err?.error?.message ?? 'Failed to load categories.';
        this.loading = false;
      }
    });
  }

  back(): void {
    this.router.navigate(['/inventory']);
  }
}
