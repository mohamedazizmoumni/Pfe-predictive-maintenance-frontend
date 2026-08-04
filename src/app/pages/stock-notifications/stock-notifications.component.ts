import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { NotificationsRestService } from '../../core/services/notifications-rest.service';
import { AuthService } from '../../core/services/auth.service';
import { Notification, RiskLevel } from '../../core/models/notification.model';
import { userHasRequiredRole } from '../../core/utils/role.utils';

type FilterType = 'all' | 'high' | 'unread';

const RISK_ICON: Record<RiskLevel, string> = {
  CRITICAL: 'Siren',
  HIGH: 'TriangleAlert',
  MEDIUM: 'AlertCircle',
  LOW: 'CircleCheck',
};

@Component({
  selector: 'app-stock-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './stock-notifications.component.html',
  styleUrl: './stock-notifications.component.scss',
})
export class StockNotificationsComponent implements OnInit, OnDestroy {
  selectedFilter: FilterType = 'all';
  filterOptions: FilterType[] = ['all', 'high', 'unread'];
  isLoading = false;

  private destroy$ = new Subject<void>();
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private filterSubject = new BehaviorSubject<FilterType>('all');

  readonly notifications$ = this.notificationsSubject.asObservable();

  readonly canMarkAllAsRead$ = this.authService.currentUser$.pipe(
    map((user) => userHasRequiredRole(user, ['MANAGER', 'ADMIN', 'SUPER_ADMIN']))
  );

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
          return notifications.filter(
            (n) => n.riskLevel === 'HIGH' || n.riskLevel === 'CRITICAL'
          );
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
      (n) => n.riskLevel === 'CRITICAL' || n.riskLevel === 'HIGH'
    ).length;
  }

  get mediumCount(): number {
    return this.notificationsSubject.value.filter(
      (n) => n.riskLevel === 'MEDIUM'
    ).length;
  }

  constructor(
    private notificationsService: NotificationsRestService,
    private authService: AuthService,
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

    this.notificationsService
      .loadNotifications('STOCK_MANAGER')
      .pipe(
        takeUntil(this.destroy$),
        // Stock/inventory alerts are never tied to a machine — this filters out
        // any machine-health notifications that also target STOCK_MANAGER.
        map((notifications) => notifications.filter((n) => n.machineId == null))
      )
      .subscribe((notifications) => {
        this.notificationsSubject.next(notifications);
        this.isLoading = false;
      });
  }

  setFilter(filter: FilterType): void {
    this.selectedFilter = filter;
    this.filterSubject.next(filter);
  }

  onMarkAsRead(notification: Notification, event: MouseEvent): void {
    event.stopPropagation();
    this.markRead(notification.id);
  }

  onMarkAllAsRead(): void {
    this.notificationsService.markAllAsRead().subscribe(() => {
      const notifications = this.notificationsSubject.value.map((n) => ({
        ...n,
        isRead: true,
      }));
      this.notificationsSubject.next(notifications);
    });
  }

  onNotificationClick(notification: Notification): void {
    if (!notification.isRead) {
      this.markRead(notification.id);
    }
    this.router.navigate(['/inventory']);
  }

  onRefresh(): void {
    this.loadStockNotifications();
  }

  exportReport(): void {
    const rows = this.notificationsSubject.value;
    if (!rows.length) return;

    const header = ['Title', 'Risk Level', 'Message', 'Status', 'Created At'];
    const lines = rows.map((n) =>
      [n.title, n.riskLevel, n.body, n.isRead ? 'Read' : 'Unread', n.createdAt]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );

    const csvContent = [header.join(','), ...lines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-alerts.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private markRead(id: number): void {
    const target = this.notificationsSubject.value.find((n) => n.id === id);
    if (!target || target.isRead) return;

    this.notificationsService.markAsRead(id).subscribe(() => {
      const notifications = this.notificationsSubject.value.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      this.notificationsSubject.next(notifications);
    });
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

  getRiskIcon(riskLevel: RiskLevel): string {
    return RISK_ICON[riskLevel] ?? RISK_ICON.LOW;
  }

  getRelativeTime(createdAt: string): string {
    const date = new Date(createdAt);
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
}
