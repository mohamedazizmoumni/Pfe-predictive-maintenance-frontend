import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, interval } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { Notification, UnreadCountResponse, ReadAllResponse } from '../models/notification.model';
import { apiEndpoint } from '../http/api-base';

@Injectable({
  providedIn: 'root',
})
export class NotificationsRestService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  private pollingSubscription: Subscription | null = null;
  private roleParam: string | null = null;

  readonly notifications$ = this.notificationsSubject.asObservable();
  readonly unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Load notifications from backend
   */
  loadNotifications(role?: string): Observable<Notification[]> {
    const resolvedRole = role ?? this.roleParam ?? undefined;
    let params = new HttpParams();
    if (resolvedRole) {
      params = params.set('role', resolvedRole);
    }

    return this.http
      .get<Notification[]>(apiEndpoint('/notifications'), { params })
      .pipe(
        tap((notifications) => {
          this.notificationsSubject.next(notifications);
          this.recalculateUnreadCount(notifications);
        }),
        catchError((error) => {
          // Stop polling if the endpoint is unavailable (401/403/404)
          if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
            this.stopPolling();
          }
          console.warn('Notifications unavailable:', error?.status);
          return of([]);
        })
      );
  }

  /**
   * Load unread notification count
   */
  loadUnreadCount(): Observable<UnreadCountResponse> {
    return this.http
      .get<UnreadCountResponse>(apiEndpoint('/notifications/unread-count'))
      .pipe(
        tap((response) => {
          this.unreadCountSubject.next(response.count);
        }),
        catchError((error) => {
          if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
            this.stopPolling();
          }
          console.warn('Unread count unavailable:', error?.status);
          return of({ count: 0 });
        })
      );
  }

  /**
   * Mark a single notification as read
   */
  markAsRead(id: number): Observable<void> {
    return this.http
      .put<void>(apiEndpoint(`/notifications/${id}/read`), {})
      .pipe(
        tap(() => {
          const notifications = this.notificationsSubject.value.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          );
          this.notificationsSubject.next(notifications);

          const currentCount = this.unreadCountSubject.value;
          this.unreadCountSubject.next(Math.max(0, currentCount - 1));
        }),
        catchError((error) => {
          console.error('Failed to mark notification as read:', error);
          return of(void 0);
        })
      );
  }

  /**
   * Mark all notifications as read (restricted to MANAGER, ADMIN, SUPER_ADMIN)
   */
  markAllAsRead(): Observable<ReadAllResponse> {
    return this.http
      .put<ReadAllResponse>(apiEndpoint('/notifications/read-all'), {})
      .pipe(
        tap((response) => {
          const notifications = this.notificationsSubject.value.map((n) => ({
            ...n,
            isRead: true,
          }));
          this.notificationsSubject.next(notifications);
          this.unreadCountSubject.next(0);
        }),
        catchError((error) => {
          console.error('Failed to mark all as read:', error);
          return of({ updated: 0 });
        })
      );
  }

  /**
   * Get notifications for a specific machine
   */
  getNotificationsForMachine(machineId: number): Observable<Notification[]> {
    return this.http
      .get<Notification[]>(apiEndpoint(`/notifications/machine/${machineId}`))
      .pipe(
        catchError((error) => {
          console.error('Failed to fetch machine notifications:', error);
          return of([]);
        })
      );
  }

  /**
   * Start polling for new notifications
   */
  startPolling(intervalMs: number = 30000, role?: string | null): void {
    if (role !== undefined) {
      this.roleParam = role;
    }
    if (this.pollingSubscription) {
      return; // Already polling
    }

    this.pollingSubscription = interval(intervalMs).subscribe(() => {
      this.loadNotifications().subscribe();
      this.loadUnreadCount().subscribe();
    });

    // Load immediately on start
    this.loadNotifications().subscribe();
    this.loadUnreadCount().subscribe();
  }

  /**
   * Set role used for role-scoped notifications
   */
  setRole(role: string | null): void {
    this.roleParam = role;
  }

  /**
   * Stop polling for new notifications
   */
  stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  /**
   * Private helper to recalculate unread count
   */
  private recalculateUnreadCount(notifications: Notification[]): void {
    const count = notifications.filter((n) => !n.isRead).length;
    this.unreadCountSubject.next(count);
  }
}
