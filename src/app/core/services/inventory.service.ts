import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import {
  Part,
  PartRequest,
  PartUpdateRequest,
  InventoryUsage,
  InventoryUsageRequest,
  ReorderRequest,
  ReorderRequestRequest,
  ReorderApprovalRequest,
  StockOrder,
  StockOrderRequest,
  StockOrderReceiptRequest,
  InventoryStats,
  LowStockAlert,
  ReorderSummary
} from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private readonly partsUrl = apiEndpoint('/inventory/parts');
  private partsSubject = new BehaviorSubject<Part[]>([]);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private statsSubject = new BehaviorSubject<InventoryStats | null>(null);

  parts$ = this.partsSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();
  stats$ = this.statsSubject.asObservable();

  constructor(private http: HttpClient) {}

  private unsupported<T>(message: string): Observable<T> {
    this.errorSubject.next(message);
    return throwError(() => new Error(message));
  }

  private toPart(raw: any): Part {
    return {
      id: Number(raw?.id ?? 0),
      name: String(raw?.name ?? ''),
      description: String(raw?.description ?? ''),
      partNumber: String(raw?.partNumber ?? raw?.referenceCode ?? ''),
      category: String(raw?.category ?? 'GENERAL'),
      cost: Number(raw?.cost ?? raw?.unitCost ?? 0),
      currentStock: Number(raw?.currentStock ?? raw?.stockQuantity ?? 0),
      minimumStock: Number(raw?.minimumStock ?? 0),
      reorderQuantity: Number(raw?.reorderQuantity ?? 0),
      unit: String(raw?.unit ?? 'unit'),
      supplier: String(raw?.supplier ?? ''),
      status: (raw?.status ?? 'AVAILABLE') as Part['status'],
      notes: String(raw?.notes ?? ''),
      createdDate: String(raw?.createdDate ?? new Date().toISOString()),
      lastModifiedDate: String(raw?.lastModifiedDate ?? new Date().toISOString()),
    };
  }

  private toBackendPartPayload(request: PartRequest | PartUpdateRequest): Record<string, unknown> {
    return {
      name: (request as any).name,
      referenceCode: (request as any).partNumber,
      unitCost: (request as any).cost,
      stockQuantity: (request as any).currentStock ?? 0,
      leadTimeDays: 0,
      description: (request as any).description ?? '',
      category: (request as any).category ?? '',
      minimumStock: (request as any).minimumStock ?? 0,
      reorderQuantity: (request as any).reorderQuantity ?? 0,
      unit: (request as any).unit ?? '',
      supplier: (request as any).supplier ?? '',
      notes: (request as any).notes ?? '',
    };
  }

  // ============= PARTS =============

  createPart(request: PartRequest): Observable<Part> {
    this.isLoadingSubject.next(true);
    return this.http.post<any>(this.partsUrl, this.toBackendPartPayload(request)).pipe(
      map((part) => this.toPart(part)),
      tap((part) => {
        const parts = this.partsSubject.value;
        this.partsSubject.next([...parts, part]);
        this.isLoadingSubject.next(false);
      }),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to create part');
        this.isLoadingSubject.next(false);
        throw error;
      })
    );
  }

  getParts(page: number = 0, size: number = 10): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.http.get<any[] | { content: any[] }>(this.partsUrl).pipe(
      map((response) => {
        const rows = Array.isArray(response) ? response : response?.content ?? [];
        const content = rows.map((item) => this.toPart(item));
        return {
          content,
          totalElements: content.length,
          totalPages: content.length ? 1 : 0,
          number: page,
          size,
        };
      }),
      tap((response) => {
        this.partsSubject.next(response.content || response);
        this.isLoadingSubject.next(false);
      }),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to load parts');
        this.isLoadingSubject.next(false);
        return of({ content: [] });
      })
    );
  }

  getPartById(id: number): Observable<Part> {
    return this.http.get<any>(`${this.partsUrl}/${id}`).pipe(
      map((part) => this.toPart(part)),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to load part');
        throw error;
      })
    );
  }

  /**
   * Update a part by ID.
   * Uses PUT /api/v1/inventory/parts/{id} per the updated backend contract.
   */
  updatePart(id: number, request: PartUpdateRequest): Observable<Part> {
    this.isLoadingSubject.next(true);
    return this.http
      .put<any>(`${this.partsUrl}/${id}`, this.toBackendPartPayload(request))
      .pipe(
        map((part) => this.toPart(part)),
        tap((updated) => {
          const parts = this.partsSubject.value.map((p) =>
            p.id === id ? updated : p
          );
          this.partsSubject.next(parts);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          this.errorSubject.next(error.error?.message || 'Failed to update part');
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Delete a part by ID.
   * Uses DELETE /api/v1/inventory/parts/{id} per the updated backend contract.
   */
  deletePart(id: number): Observable<void> {
    this.isLoadingSubject.next(true);
    return this.http.delete<void>(`${this.partsUrl}/${id}`).pipe(
      tap(() => {
        const parts = this.partsSubject.value.filter((p) => p.id !== id);
        this.partsSubject.next(parts);
        this.isLoadingSubject.next(false);
      }),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to delete part');
        this.isLoadingSubject.next(false);
        throw error;
      })
    );
  }

  getLowStockParts(): Observable<LowStockAlert[]> {
    return of([]);
  }

  /**
   * Fetch distinct categories derived from existing parts.
   */
  getCategories(): Observable<string[]> {
    return this.getParts(0, 1000).pipe(
      map((response) => {
        const content = Array.isArray(response?.content) ? response.content : [];
        const categories = content
          .map((item: Part) => item.category)
          .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
        return Array.from(new Set<string>(categories));
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Create a new category on the backend (not yet available).
   */
  createCategory(name: string): Observable<any> {
    return this.unsupported<any>('Category creation endpoint is not available in the current backend contract.');
  }

  /**
   * Fetch full category objects (id + name) derived from existing parts.
   */
  getCategoryObjects(): Observable<any[]> {
    return this.getCategories().pipe(map((names) => names.map((name, idx) => ({ id: idx + 1, name }))));
  }

  // ============= INVENTORY USAGE =============

  recordUsage(request: InventoryUsageRequest): Observable<InventoryUsage> {
    return this.unsupported<InventoryUsage>('Inventory usage endpoint is not available in the current backend contract.');
  }

  getUsageHistory(page: number = 0, size: number = 10): Observable<any> {
    return of({ content: [], totalElements: 0, totalPages: 0, number: page, size });
  }

  // ============= REORDER REQUESTS =============

  requestReorder(request: ReorderRequestRequest): Observable<ReorderRequest> {
    return this.unsupported<ReorderRequest>('Reorder endpoint is not available in the current backend contract.');
  }

  getReorders(page: number = 0, size: number = 10): Observable<any> {
    return of({ content: [], totalElements: 0, totalPages: 0, number: page, size });
  }

  getPendingReorders(): Observable<ReorderRequest[]> {
    return of([]);
  }

  approveReorder(id: number, request: ReorderApprovalRequest): Observable<ReorderRequest> {
    return this.unsupported<ReorderRequest>('Reorder approval endpoint is not available in the current backend contract.');
  }

  // ============= STOCK ORDERS =============

  createStockOrder(request: StockOrderRequest): Observable<StockOrder> {
    return this.unsupported<StockOrder>('Stock order endpoint is not available in the current backend contract.');
  }

  getStockOrders(page: number = 0, size: number = 10): Observable<any> {
    return of({ content: [], totalElements: 0, totalPages: 0, number: page, size });
  }

  receiveStockOrder(id: number, request: StockOrderReceiptRequest): Observable<StockOrder> {
    return this.unsupported<StockOrder>('Stock order receipt endpoint is not available in the current backend contract.');
  }

  // ============= ANALYTICS =============

  getInventoryStats(): Observable<InventoryStats> {
    return of({
      totalPartsTracked: this.partsSubject.value.length,
      lowStockPartsCount: 0,
      outOfStockPartsCount: 0,
      pendingOrdersCount: 0,
      totalInventoryValue: 0,
      turnoverRate: 0,
      lastUpdated: new Date().toISOString(),
    }).pipe(tap((stats) => this.statsSubject.next(stats)));
  }

  getLowStockAlerts(): Observable<LowStockAlert[]> {
    return of([]);
  }

  getCriticalReorders(): Observable<ReorderSummary[]> {
    return of([]);
  }
}