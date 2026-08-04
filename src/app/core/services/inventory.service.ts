import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
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
  private reordersSubject = new BehaviorSubject<ReorderRequest[]>([]);
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
      partNumber: String(raw?.partNumber ?? raw?.part_number ?? raw?.referenceCode ?? ''),
      category: String(raw?.category ?? 'GENERAL'),
      subCategory: String(raw?.subCategory ?? raw?.subcategory ?? ''),
      cost: Number(raw?.cost ?? raw?.unitCost ?? 0),
      currentStock: Number(raw?.currentStock ?? raw?.stockQuantity ?? 0),
      minimumStock: Number(raw?.minimumStock ?? 0),
      reorderQuantity: Number(raw?.reorderQuantity ?? 0),
      unit: String(raw?.unit ?? 'unit'),
      supplier: String(raw?.supplier ?? ''),
      status: (raw?.status ?? 'AVAILABLE') as Part['status'],
      notes: String(raw?.notes ?? ''),
      imageUrl: raw?.imageUrl || undefined,
      createdDate: String(raw?.createdDate ?? new Date().toISOString()),
      lastModifiedDate: String(raw?.lastModifiedDate ?? new Date().toISOString()),
    };
  }

  private toBackendPartPayload(request: PartRequest | PartUpdateRequest): Record<string, unknown> {
    return {
      name: (request as any).name,
      partNumber: (request as any).partNumber,
      referenceCode: (request as any).partNumber,
      unitCost: (request as any).cost,
      stockQuantity: (request as any).currentStock ?? 0,
      leadTimeDays: 0,
      description: (request as any).description ?? '',
      category: (request as any).category ?? '',
      subCategory: (request as any).subCategory ?? '',
      minimumStock: (request as any).minimumStock ?? 0,
      reorderQuantity: (request as any).reorderQuantity ?? 0,
      unit: (request as any).unit ?? '',
      supplier: (request as any).supplier ?? '',
      notes: (request as any).notes ?? '',
    };
  }

  private toReorderRequest(raw: any, fallback?: Partial<ReorderRequestRequest>): ReorderRequest {
    return {
      id: raw?.id ?? 0,
      partId: raw?.partId ?? fallback?.partId ?? 0,
      partName: raw?.partName ?? '',
      quantity: raw?.quantity ?? fallback?.quantity ?? 0,
      approximateCost: raw?.approximateCost ?? 0,
      reason: raw?.reason ?? fallback?.reason ?? '',
      status: raw?.status ?? 'REQUESTED',
      requestedBy: raw?.requestedBy ?? '',
      requestedDate: raw?.requestedDate ?? new Date().toISOString(),
      approvedBy: raw?.approvedBy ?? '',
      approvedDate: raw?.approvedDate ?? '',
      notes: raw?.notes ?? fallback?.notes ?? '',
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

  getSubCategories(category: string): Observable<string[]> {
    const subcategoryMap: Record<string, string[]> = {
      'MECHANICAL': ['Bearings', 'Gears', 'Shafts', 'Couplings', 'Seals', 'Bushings'],
      'ELECTRICAL': ['Motors', 'Contactors', 'Relays', 'Transformers', 'Capacitors', 'Switches'],
      'HYDRAULIC': ['Pumps', 'Cylinders', 'Valves', 'Hoses', 'Filters', 'Accumulators'],
      'PNEUMATIC': ['Compressors', 'Actuators', 'Regulators', 'Valves', 'Tubing', 'Fittings'],
      'FASTENERS': ['Bolts', 'Nuts', 'Screws', 'Washers', 'Rivets', 'Pins'],
      'BELTS_CHAINS': ['V-Belts', 'Timing Belts', 'Roller Chains', 'Sprockets', 'Tensioners'],
      'LUBRICANTS': ['Oils', 'Greases', 'Coolants', 'Solvents', 'Additives'],
      'GENERAL': ['Other', 'Miscellaneous', 'Consumables', 'Tools', 'Safety Equipment'],
    };
    const subs = subcategoryMap[category.toUpperCase()] || subcategoryMap['GENERAL'];
    return of(subs);
  }

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

  /** Real recorded usage across all parts over the trailing window — empty until technicians log part consumption via rapports. */
  getAllUsage(days: number = 90): Observable<InventoryUsage[]> {
    const url = apiEndpoint(`/inventory/analytics/usage?days=${days}`);
    return this.http.get<InventoryUsage[]>(url).pipe(
      catchError((error) => {
        console.error('Failed to load usage history:', error);
        return of([]);
      })
    );
  }

  // ============= REORDER REQUESTS =============

  requestReorder(request: ReorderRequestRequest): Observable<ReorderRequest> {
    const url = apiEndpoint('/inventory/reorders');
    return this.http.post<any>(url, request).pipe(
      map((response) => this.toReorderRequest(response, request)),
      tap((newReorder) => {
        // Keep the local reorders cache in sync so analytics update immediately
        const current = this.reordersSubject.value;
        this.reordersSubject.next([...current, newReorder]);
      }),
      catchError((error) => {
        console.error('Failed to request reorder:', error);
        this.errorSubject.next(error.error?.message || 'Failed to request reorder');
        throw error;
      })
    );
  }

  getReorders(page: number = 0, size: number = 10): Observable<any> {
    const url = apiEndpoint('/inventory/reorders');
    return this.http.get<any>(url).pipe(
      map((response) => {
        const rows = Array.isArray(response) ? response : response?.content ?? [];
        const content = rows.map((r: any) => this.toReorderRequest(r));
        return {
          content,
          totalElements: content.length,
          totalPages: content.length ? 1 : 0,
          number: page,
          size,
        };
      }),
      tap((response) => {
        // Keep reorders cache updated for analytics
        this.reordersSubject.next(response.content ?? []);
      }),
      catchError((error) => {
        console.error('Failed to load reorders:', error);
        return of({ content: [], totalElements: 0, totalPages: 0, number: page, size });
      })
    );
  }

  getPendingReorders(): Observable<ReorderRequest[]> {
    const url = apiEndpoint('/inventory/reorders/pending');
    return this.http.get<any[]>(url).pipe(
      map((rows) => (rows ?? []).map((r) => this.toReorderRequest(r))),
      catchError((error) => {
        console.error('Failed to load pending reorders:', error);
        return of([]);
      })
    );
  }

  approveReorder(id: number, request: ReorderApprovalRequest): Observable<ReorderRequest> {
    const url = apiEndpoint(`/inventory/reorders/${id}/approval`);
    return this.http.put<any>(url, request).pipe(
      map((response) => this.toReorderRequest(response)),
      tap((updated) => {
        const current = this.reordersSubject.value.map((r) =>
          r.id === id ? updated : r
        );
        this.reordersSubject.next(current);
      }),
      catchError((error) => {
        console.error('Failed to approve reorder:', error);
        this.errorSubject.next(error.error?.message || 'Failed to approve reorder');
        throw error;
      })
    );
  }


  createStockOrder(request: StockOrderRequest): Observable<StockOrder> {
    const url = apiEndpoint('/inventory/orders');
    return this.http.post<any>(url, request).pipe(
      map((response) => ({
        id: response.id || 0,
        reorderRequestId: response.reorderRequestId || request.reorderRequestId,
        partId: response.partId || 0,
        partName: response.partName || '',
        quantity: response.quantity || 0,
        cost: response.cost || 0,
        supplierPurchaseOrder: response.supplierPurchaseOrder || request.supplierPurchaseOrder,
        status: response.status || 'ORDERED',
        orderedDate: response.orderedDate || new Date().toISOString(),
        expectedDeliveryDate: response.expectedDeliveryDate || request.expectedDeliveryDate,
        deliveredDate: response.deliveredDate || '',
        orderedBy: response.orderedBy || '',
        notes: response.notes || request.notes,
      })),
      catchError((error) => {
        console.error('Failed to create stock order:', error);
        this.errorSubject.next(error.error?.message || 'Failed to create stock order');
        throw error;
      })
    );
  }

  getStockOrders(page: number = 0, size: number = 10): Observable<any> {
    const url = apiEndpoint('/inventory/orders');
    return this.http.get<any>(url).pipe(
      map((response) => {
        const content = Array.isArray(response) ? response : response?.content || [];
        return {
          content,
          totalElements: content.length,
          totalPages: content.length ? 1 : 0,
          number: page,
          size,
        };
      }),
      catchError((error) => {
        console.error('Failed to load stock orders:', error);
        return of({ content: [], totalElements: 0, totalPages: 0, number: page, size });
      })
    );
  }

  receiveStockOrder(id: number, request: StockOrderReceiptRequest): Observable<StockOrder> {
    const url = apiEndpoint(`/inventory/orders/${id}/deliver`);
    return this.http.put<any>(url, request).pipe(
      map((response) => ({
        id: response.id || id,
        reorderRequestId: response.reorderRequestId || 0,
        partId: response.partId || 0,
        partName: response.partName || '',
        quantity: response.quantity || 0,
        cost: response.cost || 0,
        supplierPurchaseOrder: response.supplierPurchaseOrder || '',
        status: response.status || 'RECEIVED',
        orderedDate: response.orderedDate || '',
        expectedDeliveryDate: response.expectedDeliveryDate || '',
        deliveredDate: response.deliveredDate || new Date().toISOString(),
        orderedBy: response.orderedBy || '',
        notes: response.notes || request.notes,
      })),
      catchError((error) => {
        console.error('Failed to receive stock order:', error);
        this.errorSubject.next(error.error?.message || 'Failed to receive stock order');
        throw error;
      })
    );
  }

  // ============= ANALYTICS =============

  /**
   * Compute real inventory statistics from the already-loaded parts and
   * reorders caches. Falls back to fetching both if the caches are empty.
   */
  getInventoryStats(): Observable<InventoryStats> {
    const parts = this.partsSubject.value;
    const reorders = this.reordersSubject.value;

    // If parts haven't been loaded yet, fetch them first then compute
    if (parts.length === 0) {
      return this.getParts(0, 10000).pipe(
        switchMap((): Observable<InventoryStats> =>
          this.computeStatsWithTurnover(this.partsSubject.value, this.reordersSubject.value)
        ),
        tap((stats: InventoryStats) => this.statsSubject.next(stats)),
        catchError(() => {
          const fallback = this.computeStats([], [], 0);
          this.statsSubject.next(fallback);
          return of(fallback);
        })
      );
    }

    return this.computeStatsWithTurnover(parts, reorders).pipe(
      tap((stats) => this.statsSubject.next(stats))
    );
  }

  /** Computes client-side stats and merges in the real, backend-computed turnover rate. */
  private computeStatsWithTurnover(parts: Part[], reorders: ReorderRequest[]): Observable<InventoryStats> {
    const url = apiEndpoint('/inventory/analytics/stats');
    return this.http.get<InventoryStats>(url).pipe(
      map((backendStats) => this.computeStats(parts, reorders, backendStats.turnoverRate)),
      catchError(() => of(this.computeStats(parts, reorders, 0)))
    );
  }

  private computeStats(parts: Part[], reorders: ReorderRequest[], turnoverRate: number): InventoryStats {
    const lowStockPartsCount = parts.filter(
      (p) => p.currentStock > 0 && p.currentStock <= p.minimumStock
    ).length;

    const outOfStockPartsCount = parts.filter(
      (p) => p.currentStock === 0
    ).length;

    const pendingOrdersCount = reorders.filter(
      (r) => r.status === 'REQUESTED' || r.status === 'APPROVED'
    ).length;

    const totalInventoryValue = parts.reduce(
      (sum, p) => sum + p.cost * p.currentStock,
      0
    );

    return {
      totalPartsTracked: parts.length,
      lowStockPartsCount,
      outOfStockPartsCount,
      pendingOrdersCount,
      totalInventoryValue,
      turnoverRate,
      lastUpdated: new Date().toISOString(),
    };
  }

  getLowStockAlerts(): Observable<LowStockAlert[]> {
    const url = apiEndpoint('/inventory/analytics/low-stock-alerts');
    return this.http.get<LowStockAlert[]>(url).pipe(
      catchError((error) => {
        console.error('Failed to load low stock alerts:', error);
        return of([]);
      })
    );
  }

  getCriticalReorders(limit: number = 10): Observable<ReorderSummary[]> {
    const url = apiEndpoint(`/inventory/analytics/critical-reorders?limit=${limit}`);
    return this.http.get<ReorderSummary[]>(url).pipe(
      catchError((error) => {
        console.error('Failed to load critical reorders:', error);
        return of([]);
      })
    );
  }

  // ============= IMAGE UPLOAD =============

  uploadPartImage(partId: number, imageFile: File): Observable<Part> {
    const formData = new FormData();
    formData.append('image', imageFile);

    return this.http.post<any>(`${this.partsUrl}/${partId}/image`, formData).pipe(
      map((part) => this.toPart(part)),
      tap((updated) => {
        const parts = this.partsSubject.value.map((p) =>
          p.id === partId ? updated : p
        );
        this.partsSubject.next(parts);
      }),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to upload image');
        throw error;
      })
    );
  }

  deletePartImage(partId: number): Observable<Part> {
    return this.http.delete<any>(`${this.partsUrl}/${partId}/image`).pipe(
      map((part) => this.toPart(part)),
      tap((updated) => {
        const parts = this.partsSubject.value.map((p) =>
          p.id === partId ? updated : p
        );
        this.partsSubject.next(parts);
      }),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to delete image');
        throw error;
      })
    );
  }
  
}