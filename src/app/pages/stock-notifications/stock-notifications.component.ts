import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, combineLatest, BehaviorSubject } from 'rxjs';
import { takeUntil, catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { apiEndpoint } from '../../core/http/api-base';

interface StockNotification {
  id: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'REORDER_REQUEST' | 'STOCK_RECEIVED' | 'STOCK_UPDATED';
  title: string;
  message: string;
  partId?: number;
  partName?: string;
  quantity?: number;
  threshold?: number;
  timestamp: Date;
  isRead: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

type FilterType = 'all' | 'high' | 'unread';

@Component({
  selector: 'app-stock-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './stock-notifications.component.html',
  styleUrl: './stock-notifications.component.scss',
})
export class StockNotificationsComponent implements OnInit, OnDestroy {
  selectedFilter: FilterType = 'all';
  filterOptions: FilterType[] = ['all', 'high', 'unread'];
  isLoading = false;
  errorMessage: string | null = null;

  private destroy$ = new Subject<void>();
  private notificationsSubject = new BehaviorSubject<StockNotification[]>([]);
  private filterSubject = new BehaviorSubject<FilterType>('all');

  readonly notifications$ = this.notificationsSubject.asObservable();

  readonly unreadCount$ = this.notifications$.pipe(
    map((notifications) => notifications.filter((n) => !n.isRead).length)
  );

  readonly filteredNotifications$ = combineLatest([
    this.notifications$,
    this.filterSubject,
  ]).pipe(
    map(([notifications, filter]) => {
      switch (filter) {
        case 'high':
          return notifications.filter((n) => n.priority === 'HIGH');
        case 'unread':
          return notifications.filter((n) => !n.isRead);
        case 'all':
        default:
          return notifications;
      }
    })
  );

  // ── Computed counts for the side panel (no arrow functions in templates) ──

  get criticalCount(): number {
    return this.notificationsSubject.value.filter(
      (n) => n.priority === 'HIGH'
    ).length;
  }

  get mediumCount(): number {
    return this.notificationsSubject.value.filter(
      (n) => n.priority === 'MEDIUM'
    ).length;
  }

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadStockNotifications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.notificationsSubject.complete();
    this.filterSubject.complete();
  }

  private loadStockNotifications(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.http
      .get<any[]>(apiEndpoint('/inventory/parts'))
      .pipe(
        takeUntil(this.destroy$),
        map((parts) => this.generateStockNotifications(parts)),
        catchError((error) => {
          console.error('Failed to load stock data:', error);
          this.errorMessage =
            'Unable to load stock notifications. Please try again later.';
          return of([]);
        })
      )
      .subscribe((notifications) => {
        this.notificationsSubject.next(notifications);
        this.isLoading = false;
      });
  }

  private generateStockNotifications(parts: any[]): StockNotification[] {
    const notifications: StockNotification[] = [];
    const now = new Date();

    parts.forEach((part) => {
      const currentStock = part.currentStock || 0;
      const minimumStock = part.minimumStock || 0;

      if (currentStock <= 0) {
        notifications.push({
          id: `out-of-stock-${part.id}`,
          type: 'OUT_OF_STOCK',
          title: '🚨 Out of Stock',
          message: `${part.name} is out of stock. Immediate action required.`,
          partId: part.id,
          partName: part.name,
          quantity: currentStock,
          threshold: minimumStock,
          timestamp: new Date(now.getTime() - Math.random() * 3600000),
          isRead: false,
          priority: 'HIGH',
        });
      } else if (currentStock <= minimumStock) {
        notifications.push({
          id: `low-stock-${part.id}`,
          type: 'LOW_STOCK',
          title: '⚠️ Low Stock Alert',
          message: `${part.name} is running low (${currentStock} remaining). Minimum stock: ${minimumStock}`,
          partId: part.id,
          partName: part.name,
          quantity: currentStock,
          threshold: minimumStock,
          timestamp: new Date(now.getTime() - Math.random() * 7200000),
          isRead: false,
          priority: 'HIGH',
        });
      }
    });

    return notifications.sort((a, b) => {
      if (a.priority !== b.priority) {
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }

  setFilter(filter: FilterType): void {
    this.selectedFilter = filter;
    this.filterSubject.next(filter);
  }

  onMarkAsRead(notification: StockNotification, event: MouseEvent): void {
    event.stopPropagation();
    if (!notification.isRead) {
      const notifications = this.notificationsSubject.value.map((n) =>
        n.id === notification.id ? { ...n, isRead: true } : n
      );
      this.notificationsSubject.next(notifications);
    }
  }

  onMarkAllAsRead(): void {
    const notifications = this.notificationsSubject.value.map((n) => ({
      ...n,
      isRead: true,
    }));
    this.notificationsSubject.next(notifications);
  }

  onNotificationClick(notification: StockNotification): void {
    if (!notification.isRead) {
      const notifications = this.notificationsSubject.value.map((n) =>
        n.id === notification.id ? { ...n, isRead: true } : n
      );
      this.notificationsSubject.next(notifications);
    }

    if (notification.partId) {
      this.router.navigate(['/inventory/part-detail', notification.partId]);
    } else {
      this.router.navigate(['/inventory']);
    }
  }

  onRefresh(): void {
    this.loadStockNotifications();
  }

  getEmptyStateMessage(): string {
    switch (this.selectedFilter) {
      case 'high':
        return 'No high priority alerts at the moment.';
      case 'unread':
        return "You're all caught up! No unread notifications.";
      case 'all':
      default:
        return 'All stock levels are currently healthy!';
    }
  }

  getPriorityConfig(priority: string) {
    const configs: Record<string, { color: string; bgColor: string; label: string; icon: string }> = {
      HIGH: { color: '#ef4444', bgColor: '#fef2f2', label: 'High Priority', icon: '🚨' },
      MEDIUM: { color: '#f97316', bgColor: '#fff7ed', label: 'Medium Priority', icon: '⚠️' },
      LOW: { color: '#22c55e', bgColor: '#f0fdf4', label: 'Low Priority', icon: '✅' },
    };
    return configs[priority] ?? configs['LOW'];
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      OUT_OF_STOCK: '🚨',
      LOW_STOCK: '⚠️',
      REORDER_REQUEST: '📋',
      STOCK_RECEIVED: '📦',
      STOCK_UPDATED: '✅',
    };
    return icons[type] ?? '📢';
  }
}