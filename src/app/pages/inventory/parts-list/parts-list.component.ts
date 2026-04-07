import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Part } from '../../../core/models/sentinel.models';
import { InventoryService } from '../../../core/services/inventory.service';

interface PaginatedResponse<T> {
  content?: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
}

@Component({
  selector: 'app-parts-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './parts-list.component.html',
  styleUrls: ['./parts-list.component.scss']
})
export class PartsListComponent implements OnInit {
  parts: Part[] = [];
  filteredParts: Part[] = [];
  isLoading = false;
  error: string | null = null;

  page = 0;
  size = 10;
  totalElements = 0;

  // Client-side search, filter and sort state

  searchTerm = '';
  filterStatus: 'all' | 'ok' | 'low' | 'critical' = 'all';
  filterCategory: string = 'all';
  sortField: 'partNumber' | 'name' | 'category' | 'currentStock' | 'minimumStock' | 'cost' | 'stockValue' = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  categories: string[] = [];

  isExporting = false;

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadParts();
  }

  loadParts(page: number = 0): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getParts(page, this.size).subscribe({
      next: (response) => {
        const payload = (response as PaginatedResponse<Part>) ?? {};
        const content = payload.content ?? (Array.isArray(response) ? (response as Part[]) : []);
        this.parts = content;
        this.totalElements = payload.totalElements ?? content.length;
        this.page = payload.number ?? page;
        this.buildCategories();
        this.applyFiltersAndSort();
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Failed to load parts';
        this.isLoading = false;
      }
    });
  }

  buildCategories(): void {
    const set = new Set<string>();
    for (const part of this.parts) {
      if (part.category) {
        set.add(part.category);
      }
    }
    this.categories = Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  onSearchChange(): void {
    this.applyFiltersAndSort();
  }

  onFilterChange(): void {
    this.applyFiltersAndSort();
  }

  onSort(field: typeof this.sortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applyFiltersAndSort();
  }

  isSorted(field: typeof this.sortField, direction: 'asc' | 'desc'): boolean {
    return this.sortField === field && this.sortDirection === direction;
  }

  private applyFiltersAndSort(): void {
    const term = this.searchTerm.trim().toLowerCase();

    let result = this.parts.filter((part) => {
      const matchesSearch = !term
        ? true
        : [part.name, part.partNumber, part.category]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(term));

      const status = this.stockStatus(part);
      const matchesStatus = this.filterStatus === 'all' ? true : status === this.filterStatus;

      const matchesCategory =
        this.filterCategory === 'all' ? true : (part.category ?? '').toLowerCase() === this.filterCategory.toLowerCase();

      return matchesSearch && matchesStatus && matchesCategory;
    });

    result = result.sort((a, b) => {
      const direction = this.sortDirection === 'asc' ? 1 : -1;

      const getValue = (part: Part): number | string => {
        if (this.sortField === 'stockValue') {
          return (part.currentStock ?? 0) * (part.cost ?? 0);
        }
        return (part as any)[this.sortField] ?? '';
      };

      const va = getValue(a);
      const vb = getValue(b);

      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * direction;
      }
      return String(va).localeCompare(String(vb)) * direction;
    });

    this.filteredParts = result;
  }

  nextPage(): void {
    if ((this.page + 1) * this.size >= this.totalElements) {
      return;
    }
    this.loadParts(this.page + 1);
  }

  prevPage(): void {
    if (this.page === 0) {
      return;
    }
    this.loadParts(this.page - 1);
  }

  get pageStartIndex(): number {
    if (!this.totalElements) {
      return 0;
    }
    return this.page * this.size + 1;
  }

  get pageEndIndex(): number {
    if (!this.totalElements) {
      return 0;
    }
    const end = (this.page + 1) * this.size;
    return end > this.totalElements ? this.totalElements : end;
  }

  createPart(): void {
    this.router.navigate(['/inventory/part-form']);
  }

  viewPart(part: Part): void {
    this.router.navigate(['/inventory/part-detail', part.id]);
  }

  editPart(part: Part): void {
    this.router.navigate(['/inventory/part-form', part.id]);
  }

  trackByPart(_: number, part: Part): number {
    return part.id;
  }

  stockStatus(part: Part): 'ok' | 'low' | 'critical' {
    if (part.currentStock <= 0) {
      return 'critical';
    }
    if (part.currentStock <= part.minimumStock) {
      return 'low';
    }
    return 'ok';
  }

  stockValue(part: Part): number {
    const quantity = part.currentStock ?? 0;
    const cost = part.cost ?? 0;
    return quantity * cost;
  }

  stockAboveMinimum(part: Part): number {
    const quantity = part.currentStock ?? 0;
    const min = part.minimumStock ?? 0;
    return quantity - min;
  }

  exportToCsv(): void {
    if (this.isExporting) {
      return;
    }

    this.isExporting = true;

    const rows = this.filteredParts.length ? this.filteredParts : this.parts;

    const header = [
      'Part Number',
      'Name',
      'Category',
      'Current Stock',
      'Minimum Stock',
      'Unit Cost',
      'Stock Value',
      'Status'
    ];

    const lines = rows.map((part) => {
      const status = this.stockStatus(part);
      const statusLabel = status === 'ok' ? 'OK' : status === 'low' ? 'Low' : 'Out of Stock';
      const values = [
        part.partNumber ?? '',
        part.name ?? '',
        part.category ?? '',
        String(part.currentStock ?? 0),
        String(part.minimumStock ?? 0),
        String(part.cost ?? 0),
        String(this.stockValue(part)),
        statusLabel
      ];
      return values
        .map((v) => {
          const value = v.replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(',');
    });

    const csvContent = [header.join(','), ...lines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parts-inventory.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    this.isExporting = false;
  }
}
