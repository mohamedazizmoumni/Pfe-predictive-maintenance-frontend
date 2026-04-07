import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { 
  HttpInterceptor, 
  HttpRequest, 
  HttpHandler, 
  HttpEvent, 
  HttpErrorResponse 
} from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, switchMap, filter, take, finalize } from 'rxjs/operators';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { apiEndpoint } from './api-base';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  private readonly skipTokenEndpoints = [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/logout'
  ];

  private readonly accessTokenKey = 'access_token';
  private readonly refreshTokenKey = 'refresh_token';

  private router = inject(Router);
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    console.log('🔍 AuthInterceptor intercepting:', req.url);

    // Skip token for auth endpoints
    if (this.shouldSkipToken(req.url)) {
      console.log('⏭️ Skipping token for:', req.url);
      return next.handle(req).pipe(
        catchError(err => this.handleError(err, req))
      );
    }

    const token = this.getToken();
    console.log('🔑 Token available:', token ? 'YES' : 'NO');

    const requestWithToken = token ? this.addToken(req, token) : req;

    // Log headers for debugging
    console.log('📤 Request headers:', requestWithToken.headers.keys());
    console.log('📤 Authorization header:', requestWithToken.headers.get('Authorization'));

    return next.handle(requestWithToken).pipe(
      catchError(err => {
        console.error('❌ HTTP Error:', err.status, err.message);

        if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.includes('/refresh')) {
          console.log('🔄 Attempting to refresh token due to 401');
          return this.handle401Error(req, next);
        }

        return this.handleError(err, req);
      })
    );
  }

  private getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem(this.accessTokenKey);
      console.log('📦 Token from localStorage:', token ? 'FOUND' : 'NOT FOUND');
      return token;
    }
    return null; // SSR support can be added later if needed
  }

  private getRefreshToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(this.refreshTokenKey);
    }
    return null;
  }

  private addToken(req: HttpRequest<any>, token: string): HttpRequest<any> {
    console.log('✅ Adding token to request:', req.url);
    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  private shouldSkipToken(url: string): boolean {
    const shouldSkip = this.skipTokenEndpoints.some(ep => url.includes(ep));
    console.log('🔍 Should skip token for', url, '?', shouldSkip);
    return shouldSkip;
  }

  private handle401Error(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      console.warn('⚠️ No refresh token available, skipping refresh attempt');
      this.clearAuth();
      this.router.navigate(['/auth/login']);
      return throwError(() => new Error('No refresh token available'));
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      console.log('🔄 Refresh token available: YES');

      return this.http.post<any>(apiEndpoint('/v1/auth/refresh'), { refreshToken }).pipe(
        switchMap((res: any) => {
          console.log('✅ Token refreshed successfully');

          const newAccessToken = res.token || res.accessToken || res.access_token;
          const newRefreshToken = res.refreshToken || res.refresh_token || res.refresh;

          if (!newAccessToken) {
            throw new Error('No access token returned from refresh endpoint');
          }

          // Store new tokens
          this.setStorageItem(this.accessTokenKey, newAccessToken);
          if (newRefreshToken) {
            this.setStorageItem(this.refreshTokenKey, newRefreshToken);
          }

          this.refreshTokenSubject.next(newAccessToken);

          console.log('✅ Retrying original request with new token');
          return next.handle(this.addToken(req, newAccessToken)).pipe(
            catchError((retryError) => {
              console.error('⚠️ Request still failing after refresh:', {
                url: req.url,
                status: retryError?.status
              });
              return throwError(() => retryError);
            })
          );
        }),
        catchError((refreshError: any) => {
          console.error('❌ Token refresh failed:', refreshError);
          this.clearAuth();
          this.router.navigate(['/auth/login']);
          return throwError(() => refreshError);
        }),
        finalize(() => {
          this.isRefreshing = false;
          console.log('🏁 Token refresh finalized');
        })
      );
    } else {
      // Wait for the ongoing refresh
      console.log('⏳ Token refresh already in progress, waiting...');
      return this.refreshTokenSubject.pipe(
        filter((token: string | null) => token !== null),
        take(1),
        switchMap((token: string | null) => {
          console.log('✅ Using new token from ongoing refresh');
          return next.handle(this.addToken(req, token!));
        })
      );
    }
  }

  private handleError(error: HttpErrorResponse, req: HttpRequest<any>): Observable<never> {
    console.error('🚨 HTTP Error Response:', {
      status: error.status,
      url: req.url,
      message: error.message
    });

    if (error.status === 403) {
      console.warn('⚠️ Access forbidden, redirecting to /access-denied');
      this.router.navigate(['/access-denied']);
    }

    if (error.status === 0) {
      console.error('🚨 Network error or CORS issue');
    }

    return throwError(() => error);
  }

  private clearAuth(): void {
    if (isPlatformBrowser(this.platformId)) {
      console.log('🧹 Clearing auth tokens');
      localStorage.removeItem(this.accessTokenKey);
      localStorage.removeItem(this.refreshTokenKey);
    }
  }

  private setStorageItem(key: string, value: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(key, value);
      console.log(`💾 Stored ${key} in localStorage`);
    }
  }
}