import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NavigationEnd,
  Router,
  RouterModule
} from '@angular/router';

import { filter, Subscription } from 'rxjs';

import {
  Part,
  ReorderRequestRequest
} from '../../../core/models/sentinel.models';

import { InventoryService } from '../../../core/services/inventory.service';
import { AuthService } from '../../../core/services/auth.service';

import { rolesCollectionHasAny } from '../../../core/utils/role.utils';

import { environment } from '../../../../environments/environment';

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
export class PartsListComponent implements OnInit, OnDestroy {

  parts: Part[] = [];
  filteredParts: Part[] = [];

  isLoading = false;
  error: string | null = null;

  page = 0;
  size = 10;
  totalElements = 0;

  searchTerm = '';

  filterStatus: 'all' | 'ok' | 'low' | 'critical' = 'all';

  filterCategory: string = 'all';

  sortField:
    | 'partNumber'
    | 'name'
    | 'category'
    | 'currentStock'
    | 'minimumStock'
    | 'cost'
    | 'stockValue' = 'name';

  sortDirection: 'asc' | 'desc' = 'asc';

  categories: string[] = [];

  isExporting = false;

  private routerSubscription?: Subscription;

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {

    this.loadParts();

    // AUTO REFRESH WHEN RETURNING TO THIS PAGE
    this.routerSubscription = this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe((event: any) => {

        if (event.urlAfterRedirects.includes('/inventory/parts')) {
          this.loadParts(this.page);
        }

      });

  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  getImageUrl(part: Part): string | null {

    if (!part.imageUrl) {
      return null;
    }

    if (
      part.imageUrl.startsWith('http://') ||
      part.imageUrl.startsWith('https://')
    ) {
      return part.imageUrl;
    }

    const baseUrl = environment.apiUrl.replace('/api/v1', '');

    return `${baseUrl}${part.imageUrl}`;
  }
  getCriticalCount(): number {
  return this.filteredParts.filter(
    (p) => this.stockStatus(p) === 'critical'
  ).length;
}

getLowCount(): number {
  return this.filteredParts.filter(
    (p) => this.stockStatus(p) === 'low'
  ).length;
}

getHealthyCount(): number {
  return this.filteredParts.filter(
    (p) => this.stockStatus(p) === 'ok'
  ).length;
}

getTotalInventoryValue(): number {
  return this.filteredParts.reduce(
    (total, part) => total + this.stockValue(part),
    0
  );
}

  canRequest(): boolean {
    return rolesCollectionHasAny(
      this.authService.getCurrentUser()?.roles,
      [
        'SUPER_ADMIN',
        'ADMIN',
        'STOCK_MANAGER',
        'MANAGER',
        'TECHNICIAN'
      ]
    );
  }

  requestReorderQuick(part: Part): void {

    if (!this.canRequest()) {
      this.error = 'Not authorized to request reorders.';
      return;
    }

    const defaultQty =
      part.reorderQuantity ||
      Math.max(1, (part.minimumStock || 1));

    const qtyStr = window.prompt(
      `Enter quantity to reorder for ${part.name}:`,
      String(defaultQty)
    );

    if (!qtyStr) {
      return;
    }

    const qty = parseInt(qtyStr, 10);

    if (isNaN(qty) || qty <= 0) {
      this.error = 'Invalid quantity.';
      return;
    }

    const reason =
      window.prompt('Reason (optional):', 'Replenishment') || '';

    const payload: ReorderRequestRequest = {
      partId: part.id,
      quantity: qty,
      reason,
      notes: ''
    };

    this.inventoryService.requestReorder(payload).subscribe({
      next: () => {
        this.loadParts(this.page);
      },
      error: (err) => {
        this.error =
          err?.error?.message ??
          'Failed to request reorder.';
      }
    });

  }

  loadParts(page: number = 0): void {

    this.isLoading = true;
    this.error = null;

    this.inventoryService.getParts(page, this.size).subscribe({

      next: (response) => {

        const payload =
          (response as PaginatedResponse<Part>) ?? {};

        const content =
          payload.content ??
          (Array.isArray(response)
            ? (response as Part[])
            : []);

        // FORCE NEW REFERENCES
        this.parts = [...content];

        this.totalElements =
          payload.totalElements ?? content.length;

        this.page =
          payload.number ?? page;

        this.buildCategories();

        this.applyFiltersAndSort();

        this.isLoading = false;

      },

      error: (err) => {

        this.error =
          err?.error?.message ??
          'Failed to load parts';

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

    this.categories = Array.from(set)
      .sort((a, b) => a.localeCompare(b));

  }

  onSearchChange(): void {
    this.applyFiltersAndSort();
  }

  onFilterChange(): void {
    this.applyFiltersAndSort();
  }

  onSort(field: typeof this.sortField): void {

    if (this.sortField === field) {

      this.sortDirection =
        this.sortDirection === 'asc'
          ? 'desc'
          : 'asc';

    } else {

      this.sortField = field;
      this.sortDirection = 'asc';

    }

    this.applyFiltersAndSort();

  }

  isSorted(
    field: typeof this.sortField,
    direction: 'asc' | 'desc'
  ): boolean {

    return (
      this.sortField === field &&
      this.sortDirection === direction
    );

  }

  private applyFiltersAndSort(): void {

    const term =
      this.searchTerm.trim().toLowerCase();

    let result = this.parts.filter((part) => {

      const matchesSearch = term
        ? [
            part.name,
            part.partNumber,
            part.category
          ]
            .filter(Boolean)
            .some((value) =>
              value.toLowerCase().includes(term)
            )
        : true;

      const status = this.stockStatus(part);

      const matchesStatus =
        this.filterStatus === 'all'
          ? true
          : status === this.filterStatus;

      const matchesCategory =
        this.filterCategory === 'all'
          ? true
          : (part.category ?? '')
              .toLowerCase() ===
            this.filterCategory.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory
      );

    });

    result = result.sort((a, b) => {

      const direction =
        this.sortDirection === 'asc'
          ? 1
          : -1;

      const getValue = (
        part: Part
      ): number | string => {

        if (this.sortField === 'stockValue') {

          return (
            (part.currentStock ?? 0) *
            (part.cost ?? 0)
          );

        }

        return (part as any)[this.sortField] ?? '';

      };

      const va = getValue(a);
      const vb = getValue(b);

      if (
        typeof va === 'number' &&
        typeof vb === 'number'
      ) {
        return (va - vb) * direction;
      }

      return (
        String(va).localeCompare(String(vb)) *
        direction
      );

    });

    // FORCE UI REFRESH
    this.filteredParts = [...result];

  }

  nextPage(): void {

    if (
      (this.page + 1) * this.size >=
      this.totalElements
    ) {
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

    const end =
      (this.page + 1) * this.size;

    return end > this.totalElements
      ? this.totalElements
      : end;

  }

  createPart(): void {
    this.router.navigate([
      '/inventory/part-form'
    ]);
  }

  viewPart(part: Part): void {
    this.router.navigate([
      '/inventory/part-detail',
      part.id
    ]);
  }

  editPart(part: Part): void {
    this.router.navigate([
      '/inventory/part-form',
      part.id
    ]);
  }

  trackByPart(
    _: number,
    part: Part
  ): number {
    return part.id;
  }

  stockStatus(
    part: Part
  ): 'ok' | 'low' | 'critical' {

    if (part.currentStock <= 0) {
      return 'critical';
    }

    if (
      part.currentStock <=
      part.minimumStock
    ) {
      return 'low';
    }

    return 'ok';

  }

  stockValue(part: Part): number {

    const quantity =
      part.currentStock ?? 0;

    const cost =
      part.cost ?? 0;

    return quantity * cost;

  }

  stockAboveMinimum(part: Part): number {

    const quantity =
      part.currentStock ?? 0;

    const min =
      part.minimumStock ?? 0;

    return quantity - min;

  }

  exportToCsv(): void {

    if (this.isExporting) {
      return;
    }

    this.isExporting = true;

    const rows =
      this.filteredParts.length
        ? this.filteredParts
        : this.parts;

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

      const status =
        this.stockStatus(part);

      const statusLabel =
        status === 'ok'
          ? 'OK'
          : status === 'low'
          ? 'Low'
          : 'Out of Stock';

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

          const value =
            v.replace(/"/g, '""');

          return `"${value}"`;

        })
        .join(',');

    });

    const csvContent =
      [header.join(','), ...lines]
        .join('\r\n');

    const blob = new Blob(
      [csvContent],
      {
        type: 'text/csv;charset=utf-8;'
      }
    );

    const url =
      window.URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;
    a.download = 'parts-inventory.csv';

    a.click();

    window.URL.revokeObjectURL(url);

    this.isExporting = false;

  }

}