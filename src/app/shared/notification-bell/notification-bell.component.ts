import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { NotificationsRestService } from '../../core/services/notifications-rest.service';
import { Notification, RISK_CONFIG } from '../../core/models/notification.model';
import { AuthService } from '../../core/services/auth.service';
import { userHasRequiredRole } from '../../core/utils/role.utils';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  @ViewChild('dropdownPanel', { read: ElementRef }) dropdownPanel: ElementRef | null = null;

  isOpen = false;
  notifications$ = this.notificationsService.notifications$;
  unreadCount$ = this.notificationsService.unreadCount$;
  recentNotifications$ = this.notificationsService.notifications$.pipe(
    map((notifications) => (notifications || []).slice(0, 10))
  );
  canMarkAllAsRead$ = this.authService.currentUser$.pipe(
    map((user) => userHasRequiredRole(user, ['MANAGER', 'ADMIN', 'SUPER_ADMIN']))
  );

  private destroy$ = new Subject<void>();

  constructor(
    private notificationsService: NotificationsRestService,
    private authService: AuthService,
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.notificationsService.loadNotifications().pipe(takeUntil(this.destroy$)).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
  }

  closeDropdown(): void {
    this.isOpen = false;
  }

  onNotificationClick(notification: Notification): void {
    if (!notification.isRead) {
      this.notificationsService.markAsRead(notification.id).pipe(takeUntil(this.destroy$)).subscribe();
    }
  }

  onMarkAllAsRead(): void {
    this.notificationsService.markAllAsRead().pipe(takeUntil(this.destroy$)).subscribe();
  }

  onViewAll(): void {
    this.router.navigate(['/notifications']);
    this.closeDropdown();
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      this.isOpen &&
      this.elementRef &&
      !this.elementRef.nativeElement.contains(event.target)
    ) {
      this.closeDropdown();
    }
  }
}
