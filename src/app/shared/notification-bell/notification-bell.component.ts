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
import { BehaviorSubject, Subject, combineLatest } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { trigger, transition, style, animate } from '@angular/animations';
import { NotificationsRestService } from '../../core/services/notifications-rest.service';
import { PreferenceService } from '../../core/services/preference.service';
import { Notification, RISK_CONFIG } from '../../core/models/notification.model';
import { NotificationPreferences } from '../../core/models/sentinel.models';
import { AuthService } from '../../core/services/auth.service';
import { userHasRequiredRole } from '../../core/utils/role.utils';

const NOTIFICATION_PREF_KEY = 'notifications';
const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = { inAppEnabled: true, mutedRiskLevels: [] };

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-6px) scale(0.98)' }),
        animate(
          '160ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        ),
      ]),
      transition(':leave', [
        animate('120ms ease-in', style({ opacity: 0, transform: 'translateY(-6px) scale(0.98)' })),
      ]),
    ]),
  ],
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  @ViewChild('dropdownPanel', { read: ElementRef }) dropdownPanel: ElementRef | null = null;

  isOpen = false;

  private prefs$ = new BehaviorSubject<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);

  /**
   * Priority 10.1: filters by the user's own "Notification Preferences"
   * (Profile page) - muted risk levels are hidden, and inAppEnabled=false
   * empties the bell entirely. Scoped to the bell only (not the shared
   * NotificationsRestService, which stock-notifications/inventory-analytics/
   * notifications-page also consume unfiltered - the preference's own copy
   * says "risk levels show up in your notification bell", not those pages).
   */
  private filteredNotifications$ = combineLatest([
    this.notificationsService.notifications$,
    this.prefs$,
  ]).pipe(map(([notifications, prefs]) => this.applyPreferences(notifications || [], prefs)));

  notifications$ = this.filteredNotifications$;
  recentNotifications$ = this.filteredNotifications$.pipe(
    map((notifications) => notifications.slice(0, 10))
  );
  /**
   * The backend's /unread-count is not preference-aware. When no risk level
   * is muted, trust it exactly (unchanged behavior). Once muting is active,
   * approximate from the already-loaded (most-recent-50) filtered list
   * instead - an honest best-effort rather than a false-precision backend
   * count that ignores the user's mute settings.
   */
  unreadCount$ = combineLatest([
    this.notificationsService.unreadCount$,
    this.filteredNotifications$,
    this.prefs$,
  ]).pipe(
    map(([backendCount, filteredNotifications, prefs]) => {
      if (!prefs.inAppEnabled) return 0;
      if (prefs.mutedRiskLevels.length === 0) return backendCount;
      return filteredNotifications.filter((n) => !n.isRead).length;
    })
  );
  canMarkAllAsRead$ = this.authService.currentUser$.pipe(
    map((user) => userHasRequiredRole(user, ['MANAGER', 'ADMIN', 'SUPER_ADMIN']))
  );

  private destroy$ = new Subject<void>();

  constructor(
    private notificationsService: NotificationsRestService,
    private preferenceService: PreferenceService,
    private authService: AuthService,
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.notificationsService.loadNotifications().pipe(takeUntil(this.destroy$)).subscribe();
    this.preferenceService.get(NOTIFICATION_PREF_KEY).pipe(takeUntil(this.destroy$)).subscribe({
      next: (raw) => {
        if (!raw) return;
        try {
          this.prefs$.next({ ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) });
        } catch {
          // Malformed stored value - keep defaults (show everything).
        }
      },
      error: () => {
        // No preference saved yet, or the endpoint failed - keep defaults.
      },
    });
  }

  private applyPreferences(notifications: Notification[], prefs: NotificationPreferences): Notification[] {
    if (!prefs.inAppEnabled) return [];
    if (prefs.mutedRiskLevels.length === 0) return notifications;
    return notifications.filter((n) => !prefs.mutedRiskLevels.includes(n.riskLevel));
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
