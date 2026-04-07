import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoginResponse, User, RegisterPayload, Role } from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';

export interface LoginPayload {
  username: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly USER_KEY = 'current_user';

  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {
    this.restoreSession();
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  // ============================================================================
  // LOGIN & REGISTRATION
  // ============================================================================

  /**
   * Login with username and password
   */
  login(credentials: LoginPayload): Observable<LoginResponse> {
    console.log('🔐 Attempting login for user:', credentials.username);

    return this.http
      .post<LoginResponse>(apiEndpoint('/v1/auth/login'), credentials)
      .pipe(
        tap((response) => {
          console.log('✅ Login successful for user:', credentials.username);
          this.persistSession(response);
        }),
        catchError((error) => {
          console.error('❌ Login failed:', error.status, error.message);
          return throwError(() => error);
        })
      );
  }

  /**
   * Register a new user
   */
  register(payload: RegisterPayload): Observable<LoginResponse> {
    console.log('📝 Attempting registration for user:', payload.username);

    return this.http
      .post<LoginResponse>(apiEndpoint('/v1/auth/register'), payload)
      .pipe(
        tap((response) => {
          console.log('✅ Registration successful for user:', payload.username);
          this.persistSession(response);
        }),
        catchError((error) => {
          console.error('❌ Registration failed:', error.status, error.message);
          return throwError(() => error);
        })
      );
  }

  // ============================================================================
  // TOKEN MANAGEMENT
  // ============================================================================

  /**
   * Refresh JWT token
   */
  refreshToken(): Observable<LoginResponse> {
    console.log('🔄 Attempting to refresh token...');
    const refreshToken = this.getStorageItem(this.REFRESH_TOKEN_KEY);

    if (!refreshToken) {
      console.error('❌ No refresh token available');
      return throwError(() => new Error('No refresh token available'));
    }

    console.log('🔄 Refresh token found, sending to backend...');
    return this.http
      .post<LoginResponse>(apiEndpoint('/v1/auth/refresh'), { refreshToken })
      .pipe(
        tap((response) => {
          console.log('✅ Token refreshed successfully');
          console.log('🔑 New token:', response.token);
          this.persistSession(response);
        }),
        catchError((error: any) => {
          console.error('❌ Token refresh failed:', error.status, error.message);
          this.logout();
          return throwError(() => new Error('Token refresh failed'));
        })
      );
  }

  // ============================================================================
  // LOGOUT & SESSION
  // ============================================================================

  /**
   * Logout user and clear session
   */
  logout(): Observable<any> {
    console.log('🚪 Logging out user...');
    const refreshToken = this.getStorageItem(this.REFRESH_TOKEN_KEY);

    return this.http
      .post(apiEndpoint('/v1/auth/logout'), { refreshToken })
      .pipe(
        tap(() => {
          this.clearAuth();
          console.log('✅ Logout successful');
        }),
        catchError((error) => {
          console.warn('⚠️ Logout request failed, clearing session locally:', error);
          this.clearAuth();
          return throwError(() => error);
        })
      );
  }

  /**
   * Clear authentication from storage and subjects
   */
  private clearAuth(): void {
    if (!this.isBrowser()) {
      return;
    }
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  private persistSession(response: LoginResponse | Record<string, any>): void {
    const accessToken = this.resolveAccessToken(response);

    if (!accessToken) {
      console.error('❌ No access token present in response payload.');
      return;
    }

    this.setStorageItem(this.ACCESS_TOKEN_KEY, accessToken);

    const refreshToken = this.resolveRefreshToken(response);
    if (refreshToken) {
      this.setStorageItem(this.REFRESH_TOKEN_KEY, refreshToken);
    } else {
      console.warn('⚠️ No refresh token found in response payload.');
    }

    const userPayload = response.user ?? this.getCurrentUser();
    const user = this.buildUserFromToken(accessToken, userPayload);
    this.setUserToStorage(user);
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
  }

  private resolveAccessToken(response: any): string | null {
    return (
      response?.token ??
      response?.accessToken ??
      response?.access_token ??
      null
    );
  }

  private resolveRefreshToken(response: any): string | null {
    return (
      response?.refreshToken ??
      response?.refresh_token ??
      response?.refresh ??
      null
    );
  }

  // ============================================================================
  // TOKEN HELPERS
  // ============================================================================

  /**
   * Get access token from storage
   */
  getAccessToken(): string | null {
    return this.getStorageItem(this.ACCESS_TOKEN_KEY);
  }

  /**
   * Get refresh token from storage
   */
  getRefreshToken(): string | null {
    return this.getStorageItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Check if user has valid token
   */
  hasToken(): boolean {
    const token = this.getAccessToken();
    return !!token && !this.isTokenExpired(token);
  }

  /**
   * Check if token is expired (basic check - decode payload)
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      return Date.now() >= expirationTime;
    } catch (error) {
      console.error('❌ Error checking token expiration:', error);
      return true;
    }
  }

  /**
   * Build user object from JWT token and user data
   */
  private buildUserFromToken(token: string, user?: User | null): User {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const mergedUser: User = {
        id: payload.sub || user?.id || payload.userId || 'unknown-user',
        username: payload.username || payload.sub || user?.username || 'unknown-user',
        email: payload.email || user?.email || '',
        firstName: payload.firstName || user?.firstName,
        lastName: payload.lastName || user?.lastName,
        displayName: payload.displayName || user?.displayName || payload.username || payload.sub,
        department: payload.department || user?.department,
        phoneNumber: payload.phoneNumber || user?.phoneNumber,
        status: payload.status || user?.status,
        mfaEnabled: payload.mfaEnabled ?? user?.mfaEnabled,
        lastLoginDate: payload.lastLoginDate || user?.lastLoginDate,
        roles: this.extractRoles(payload.roles, user?.roles),
      };

      return {
        ...user,
        ...mergedUser,
      } as User;
    } catch (error) {
      console.error('❌ Error decoding token:', error);
      return user || {
        id: 'unknown-user',
        username: 'unknown-user',
        email: '',
        roles: [],
      };
    }
  }

  private extractRoles(payloadRoles: any, fallback?: Role[]): Role[] {
    if (Array.isArray(payloadRoles)) {
      return payloadRoles.map((role: any) => {
        if (typeof role === 'string') {
          return { id: role, name: role } as Role;
        }
        if (role && typeof role === 'object') {
          return {
            id: role.id || role.name || this.generateRoleId(),
            name: role.name || role.id || 'UNKNOWN_ROLE',
            description: role.description,
          } as Role;
        }
        return { id: 'UNKNOWN_ROLE', name: 'UNKNOWN_ROLE' } as Role;
      });
    }
    return fallback || [];
  }

  private generateRoleId(): string {
    return `role-${Math.random().toString(36).slice(2, 10)}`;
  }

  // ============================================================================
  // STORAGE HELPERS
  // ============================================================================

  /**
   * Get item from localStorage
   */
  private getStorageItem(key: string): string | null {
    if (!this.isBrowser()) {
      return null;
    }
    const item = localStorage.getItem(key);
    if (item) {
      console.log(`✅ Retrieved from storage: ${key}`);
    } else {
      console.log(`ℹ️ No ${key} found in localStorage`);
    }
    return item;
  }

  /**
   * Set item in localStorage
   */
  private setStorageItem(key: string, value: string): void {
    if (!this.isBrowser()) {
      return;
    }
    localStorage.setItem(key, value);
    console.log(`💾 Stored to localStorage: ${key}`);
  }

  // ============================================================================
  // USER HELPERS
  // ============================================================================

  /**
   * Get current user from storage
   */
  private getUserFromStorage(): User | null {
    if (!this.isBrowser()) {
      return null;
    }
    const userJson = localStorage.getItem(this.USER_KEY);
    if (userJson) {
      try {
        return JSON.parse(userJson);
      } catch (error) {
        console.error('❌ Error parsing user from storage:', error);
        return null;
      }
    }
    return null;
  }

  private setUserToStorage(user: User): void {
    if (!this.isBrowser()) {
      return;
    }
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Restore session on app initialization
   */
  private restoreSession(): void {
    const token = this.getAccessToken();
    if (token && !this.isTokenExpired(token)) {
      const user = this.getUserFromStorage() || this.buildUserFromToken(token, null);
      if (user) {
        console.log('✅ Session restored for user:', user.username);
        this.setUserToStorage(user);
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(true);
        return;
      }
    }

    console.log('⚠️ Session not valid, clearing storage');
    this.clearAuth();
  }

  /**
   * Get current user synchronously
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }
}