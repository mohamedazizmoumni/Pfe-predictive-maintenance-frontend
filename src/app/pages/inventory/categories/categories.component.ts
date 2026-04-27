import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {
  categories: Array<{ id: number; name: string }> = [];
  loading = false;
  newCategory = '';
  adding = false;
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

  addCategory(): void {
    const name = (this.newCategory || '').trim();
    if (!name) return;
    this.adding = true;
    this.inventoryService.createCategory(name).subscribe({
      next: (res: any) => {
        this.newCategory = '';
        this.adding = false;
        this.loadCategories();
      },
      error: (err: any) => {
        this.error = err?.error?.message ?? 'Failed to add category.';
        this.adding = false;
      }
    });
  }

  back(): void {
    this.router.navigate(['/inventory']);
  }
}
