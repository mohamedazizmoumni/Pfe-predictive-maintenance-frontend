import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
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
  private apiUrl = apiEndpoint('/v1/inventory');
  private partsSubject = new BehaviorSubject<Part[]>([]);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private statsSubject = new BehaviorSubject<InventoryStats | null>(null);

  parts$ = this.partsSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();
  stats$ = this.statsSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ============= PARTS =============

  createPart(request: PartRequest): Observable<Part> {
    this.isLoadingSubject.next(true);
    return this.http.post<Part>(`${this.apiUrl}/parts`, request).pipe(
      tap((part) => {
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
    const params = new HttpParams()
      .set('page', page)
      .set('size', size);
    return this.http.get<any>(`${this.apiUrl}/parts`, { params }).pipe(
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
    return this.http.get<Part>(`${this.apiUrl}/parts/${id}`).pipe(
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to load part');
        throw error;
      })
    );
  }

  updatePart(id: number, request: PartUpdateRequest): Observable<Part> {
    this.isLoadingSubject.next(true);
    return this.http.put<Part>(`${this.apiUrl}/parts/${id}`, request).pipe(
      tap((part) => {
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
    return this.http.delete<void>(`${this.apiUrl}/parts/${id}`).pipe(
      tap(() => {
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
    return this.http.get<LowStockAlert[]>(`${this.apiUrl}/parts/low-stock`).pipe(
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to load low stock parts');
        return of([]);
      })
    );
  }

  // ============= INVENTORY USAGE =============

  recordUsage(request: InventoryUsageRequest): Observable<InventoryUsage> {
    this.isLoadingSubject.next(true);
    return this.http.post<InventoryUsage>(`${this.apiUrl}/usage`, request).pipe(
      tap(() => this.isLoadingSubject.next(false)),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to record usage');
        this.isLoadingSubject.next(false);
        throw error;
      })
    );
  }

  getUsageHistory(page: number = 0, size: number = 10): Observable<any> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size);
    return this.http.get<any>(`${this.apiUrl}/usage`, { params }).pipe(
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to load usage history');
        return of({ content: [] });
      })
    );
  }

  // ============= REORDER REQUESTS =============

  requestReorder(request: ReorderRequestRequest): Observable<ReorderRequest> {
    this.isLoadingSubject.next(true);
    return this.http.post<ReorderRequest>(`${this.apiUrl}/reorders`, request).pipe(
      tap(() => this.isLoadingSubject.next(false)),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to request reorder');
        this.isLoadingSubject.next(false);
        throw error;
      })
    );
  }

  getReorders(page: number = 0, size: number = 10): Observable<any> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size);
    return this.http.get<any>(`${this.apiUrl}/reorders`, { params }).pipe(
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to load reorders');
        return of({ content: [] });
      })
    );
  }

  getPendingReorders(): Observable<ReorderRequest[]> {
    return this.http.get<ReorderRequest[]>(`${this.apiUrl}/reorders/pending`).pipe(
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to load pending reorders');
        return of([]);
      })
    );
  }

  approveReorder(id: number, request: ReorderApprovalRequest): Observable<ReorderRequest> {
    this.isLoadingSubject.next(true);
    return this.http.put<ReorderRequest>(`${this.apiUrl}/reorders/${id}/approve`, request).pipe(
      tap(() => this.isLoadingSubject.next(false)),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to approve reorder');
        this.isLoadingSubject.next(false);
        throw error;
      })
    );
  }

  // ============= STOCK ORDERS =============

  createStockOrder(request: StockOrderRequest): Observable<StockOrder> {
    this.isLoadingSubject.next(true);
    return this.http.post<StockOrder>(`${this.apiUrl}/orders`, request).pipe(
      tap(() => this.isLoadingSubject.next(false)),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to create stock order');
        this.isLoadingSubject.next(false);
        throw error;
      })
    );
  }

  getStockOrders(page: number = 0, size: number = 10): Observable<any> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size);
    return this.http.get<any>(`${this.apiUrl}/orders`, { params }).pipe(
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to load stock orders');
        return of({ content: [] });
      })
    );
  }

  receiveStockOrder(id: number, request: StockOrderReceiptRequest): Observable<StockOrder> {
    this.isLoadingSubject.next(true);
    return this.http.put<StockOrder>(`${this.apiUrl}/orders/${id}/receive`, request).pipe(
      tap(() => this.isLoadingSubject.next(false)),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to receive stock order');
        this.isLoadingSubject.next(false);
        throw error;
      })
    );
  }

  // ============= ANALYTICS =============

  getInventoryStats(): Observable<InventoryStats> {
    return this.http.get<InventoryStats>(`${this.apiUrl}/analytics/stats`).pipe(
      tap((stats) => this.statsSubject.next(stats)),
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to load inventory stats');
        return of({} as InventoryStats);
      })
    );
  }

  getLowStockAlerts(): Observable<LowStockAlert[]> {
    return this.http.get<LowStockAlert[]>(`${this.apiUrl}/analytics/low-stock-alerts`).pipe(
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to load low stock alerts');
        return of([]);
      })
    );
  }

  getCriticalReorders(): Observable<ReorderSummary[]> {
    return this.http.get<ReorderSummary[]>(`${this.apiUrl}/analytics/critical-reorders`).pipe(
      catchError((error) => {
        this.errorSubject.next(error.error?.message || 'Failed to load critical reorders');
        return of([]);
      })
    );
  }
}