import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { NotificationsRestService } from '../../core/services/notifications-rest.service';
import { Notification, RISK_CONFIG } from '../../core/models/notification.model';
import { AuthService } from '../../core/services/auth.service';
import { userHasRequiredRole } from '../../core/utils/role.utils';

type FilterType = 'all' | 'critical' | 'high' | 'unread';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss',
})
export class NotificationsPageComponent implements OnInit, OnDestroy {
  selectedFilter: FilterType = 'all';
  filterOptions: FilterType[] = ['all', 'critical', 'high', 'unread'];
  notifications$ = this.notificationsService.notifications$;
  unreadCount$ = this.notificationsService.unreadCount$;
  isLoading = false;

  private destroy$ = new Subject<void>();
  private filterSubject = new BehaviorSubject<FilterType>('all');
  readonly filteredNotifications$ = combineLatest([
    this.notificationsService.notifications$,
    this.filterSubject,
  ]).pipe(
    map(([notifications, filter]) => {
      const safeNotifications = notifications ?? [];
      switch (filter) {
        case 'critical':
          return safeNotifications.filter((n) => n.riskLevel === 'CRITICAL');
        case 'high':
          return safeNotifications.filter((n) => n.riskLevel === 'HIGH');
        case 'unread':
          return safeNotifications.filter((n) => !n.isRead);
        case 'all':
        default:
          return safeNotifications;
      }
    })
  );
  readonly canMarkAllAsRead$ = this.authService.currentUser$.pipe(
    map((user) => userHasRequiredRole(user, ['MANAGER', 'ADMIN', 'SUPER_ADMIN']))
  );

  constructor(
    private notificationsService: NotificationsRestService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.notificationsService.loadNotifications().pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.isLoading = false;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.filterSubject.complete();
  }

  setFilter(filter: FilterType): void {
    this.selectedFilter = filter;
    this.filterSubject.next(filter);
  }

  onMarkAllAsRead(): void {
    this.notificationsService.markAllAsRead().pipe(takeUntil(this.destroy$)).subscribe();
  }

  onMarkAsRead(notification: Notification, event: MouseEvent): void {
    event.stopPropagation();
    if (!notification.isRead) {
      this.notificationsService.markAsRead(notification.id).pipe(takeUntil(this.destroy$)).subscribe();
    }
  }

  onNotificationClick(notification: Notification): void {
    if (!notification.isRead) {
      this.notificationsService.markAsRead(notification.id).pipe(takeUntil(this.destroy$)).subscribe();
    }
    // Could navigate to machine details or related page
    if (notification.machineId) {
      this.router.navigate(['/equipment', notification.machineId]);
    }
  }

  getRiskConfig(riskLevel: string) {
    return RISK_CONFIG[riskLevel as keyof typeof RISK_CONFIG] || RISK_CONFIG.LOW;
  }

  getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
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
