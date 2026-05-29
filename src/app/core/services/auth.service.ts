import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoginResponse, User, RegisterPayload, Role } from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';
import { normalizeRoleName } from '../utils/role.utils';

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
  private readonly PROFILE_PICTURE_KEY_PREFIX = 'profile_picture_url:';

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

  login(credentials: LoginPayload): Observable<LoginResponse> {
    console.log('🔐 Attempting login for user:', credentials.username);

    return this.http
      .post<LoginResponse>(apiEndpoint('/auth/login'), credentials)
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

  faceLogin(payload: FormData): Observable<LoginResponse> {
    console.log('📷 Attempting face login...');

    return this.http
      .post<LoginResponse>(apiEndpoint('/auth/face-login'), payload)
      .pipe(
        tap((response) => {
          console.log('✅ Face login successful');
          this.persistSession(response);
        }),
        catchError((error) => {
          console.error('❌ Face login failed:', error.status, error.message);
          return throwError(() => error);
        })
      );
  }

  register(payload: RegisterPayload): Observable<LoginResponse> {
    console.log('📝 Attempting registration for user:', payload.username);

    return this.http
      .post<LoginResponse>(apiEndpoint('/auth/register'), payload)
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

  signupWithFace(formData: FormData): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(apiEndpoint('/auth/signup'), formData)
      .pipe(
        tap((response) => {
          this.persistSession(response);
        }),
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  refreshToken(): Observable<LoginResponse> {
    console.log('🔄 Attempting to refresh token...');
    const refreshToken = this.getStorageItem(this.REFRESH_TOKEN_KEY);

    if (!refreshToken) {
      console.error('❌ No refresh token available');
      return throwError(() => new Error('No refresh token available'));
    }

    console.log('🔄 Refresh token found, sending to backend...');
    return this.http
      .post<LoginResponse>(apiEndpoint('/auth/refresh'), { refreshToken })
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

  logout(): Observable<any> {
    console.log('🚪 Logging out user...');
    const refreshToken = this.getStorageItem(this.REFRESH_TOKEN_KEY);

    return this.http
      .post(apiEndpoint('/auth/logout'), { refreshToken })
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

  clearSession(): void {
    this.clearAuth();
  }

  updateCurrentUser(user: User | null): void {
    if (!user) {
      this.currentUserSubject.next(null);
      if (this.isBrowser()) {
        localStorage.removeItem(this.USER_KEY);
      }
      return;
    }

    // CRITICAL: Preserve existing roles when updating user
    // to prevent roles from being wiped out during navigation or profile updates
    const currentUser = this.currentUserSubject.value;
    const existingRoles = this.normalizeRoles(currentUser?.roles);
    const incomingRoles = this.normalizeRoles(user.roles);
    
    // If incoming user has no roles but current user does, preserve them
    const preservedRoles = incomingRoles.length > 0 ? incomingRoles : existingRoles;
    
    const userWithPreservedRoles = {
      ...user,
      roles: preservedRoles,
      profilePictureUrl: user.profilePictureUrl ?? currentUser?.profilePictureUrl ?? this.getStoredProfilePictureUrl(user.username ?? currentUser?.username) ?? undefined
    };

    this.setUserToStorage(userWithPreservedRoles);
    this.setStoredProfilePictureUrl(
      userWithPreservedRoles.username,
      userWithPreservedRoles.profilePictureUrl ?? null
    );
    this.currentUserSubject.next(userWithPreservedRoles);
  }

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

    // Never reuse the previous session user here; that can leak roles,
    // avatar data, and department info into the newly authenticated session.
    const userPayload = response.user ?? null;
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
      response?.data?.token ??
      response?.data?.accessToken ??
      response?.data?.access_token ??
      null
    );
  }

  private resolveRefreshToken(response: any): string | null {
    return (
      response?.refreshToken ??
      response?.refresh_token ??
      response?.refresh ??
      response?.data?.refreshToken ??
      response?.data?.refresh_token ??
      response?.data?.refresh ??
      null
    );
  }

  getAccessToken(): string | null {
    return this.getStorageItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return this.getStorageItem(this.REFRESH_TOKEN_KEY);
  }

  hasToken(): boolean {
    const token = this.getAccessToken();
    return !!token && !this.isTokenExpired(token);
  }

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

  private buildUserFromToken(token: string, user?: User | null): User {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const username = payload.username || payload.sub || user?.username || 'unknown-user';
      const storedProfilePictureUrl = this.getStoredProfilePictureUrl(username);
      const mergedUser: User = {
        id: payload.sub || user?.id || payload.userId || 'unknown-user',
        username,
        email: payload.email || user?.email || '',
        firstName: payload.firstName || user?.firstName,
        lastName: payload.lastName || user?.lastName,
        displayName: payload.displayName || user?.displayName || payload.username || payload.sub,
        department: payload.department || user?.department,
        phoneNumber: payload.phoneNumber || user?.phoneNumber,
        status: payload.status || user?.status,
        mfaEnabled: payload.mfaEnabled ?? user?.mfaEnabled,
        lastLoginDate: payload.lastLoginDate || user?.lastLoginDate,
        profilePictureUrl: payload.profilePictureUrl || user?.profilePictureUrl || storedProfilePictureUrl,
        roles: this.extractRoles(payload.roles, this.normalizeRoles(user?.roles)),
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
      const extracted = payloadRoles.map((role: any) => {
        if (typeof role === 'string') {
          const normalizedRole = normalizeRoleName(role);
          return {
            id: normalizedRole || role,
            name: normalizedRole || role,
          } as Role;
        }
        if (role && typeof role === 'object') {
          const roleNameSource = role.name || role.authority || role.role || role.code || role.id || 'UNKNOWN_ROLE';
          const normalizedRole = normalizeRoleName(roleNameSource);
          return {
            id: role.id || normalizedRole || this.generateRoleId(),
            name: normalizedRole || roleNameSource,
            description: role.description,
          } as Role;
        }
        return { id: 'UNKNOWN_ROLE', name: 'UNKNOWN_ROLE' } as Role;
      });
      // If we extracted some valid roles, return them; otherwise use fallback
      return extracted.length > 0 ? extracted : this.normalizeRoles(fallback);
    }
    // If no payload roles, always use fallback to prevent losing roles
    return this.normalizeRoles(fallback);
  }

  private normalizeRoles(roles?: Array<Role | string | any> | null): Role[] {
    if (!Array.isArray(roles)) {
      return [];
    }

    return roles
      .map((role: any) => {
        if (typeof role === 'string') {
          const normalizedRole = normalizeRoleName(role);
          return {
            id: normalizedRole || role,
            name: normalizedRole || role,
          } as Role;
        }

        if (role && typeof role === 'object') {
          const roleNameSource = role.name || role.authority || role.role || role.code || role.id || 'UNKNOWN_ROLE';
          const normalizedRole = normalizeRoleName(roleNameSource);
          return {
            id: role.id || normalizedRole || this.generateRoleId(),
            name: normalizedRole || roleNameSource,
            description: role.description,
          } as Role;
        }

        return { id: 'UNKNOWN_ROLE', name: 'UNKNOWN_ROLE' } as Role;
      })
      .filter((role) => !!role && role.name !== 'UNKNOWN_ROLE');
  }

  private generateRoleId(): string {
    return `role-${Math.random().toString(36).slice(2, 10)}`;
  }

  private getStorageItem(key: string): string | null {
    if (!this.isBrowser()) {
      return null;
    }
    const item = localStorage.getItem(key);
    if (item) {
      console.debug(`✅ Retrieved from storage: ${key}`);
    } else {
      console.debug(`ℹ️ No ${key} found in localStorage`);
    }
    return item;
  }

  private setStorageItem(key: string, value: string): void {
    if (!this.isBrowser()) {
      return;
    }
    localStorage.setItem(key, value);
    console.debug(`💾 Stored to localStorage: ${key}`);
  }

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
    this.setStoredProfilePictureUrl(user.username, user.profilePictureUrl ?? null);
  }

  private getStoredProfilePictureUrl(username?: string | null): string | null {
    if (!this.isBrowser() || !username) {
      return null;
    }

    return localStorage.getItem(`${this.PROFILE_PICTURE_KEY_PREFIX}${username}`);
  }

  private setStoredProfilePictureUrl(
    username?: string | null,
    profilePictureUrl?: string | null
  ): void {
    if (!this.isBrowser() || !username) {
      return;
    }

    const key = `${this.PROFILE_PICTURE_KEY_PREFIX}${username}`;

    if (profilePictureUrl) {
      localStorage.setItem(key, profilePictureUrl);
    } else {
      localStorage.removeItem(key);
    }
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

    console.debug('⚠️ Session not valid, clearing storage');
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