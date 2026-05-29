import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';

import { Observable, BehaviorSubject, throwError } from 'rxjs';
import {
  catchError,
  switchMap,
  filter,
  take,
  finalize
} from 'rxjs/operators';

import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { apiEndpoint } from './api-base';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  private readonly accessTokenKey = 'access_token';
  private readonly refreshTokenKey = 'refresh_token';

  private router = inject(Router);
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);

  private readonly skipTokenEndpoints = [
    '/auth/login',
    '/auth/register',
    '/auth/signup',
    '/auth/face-login',
    '/auth/logout',
    '/auth/refresh'
  ];

  /**
   * Endpoints where a 401 should NOT trigger a token refresh or logout.
   * These are non-critical background requests that can fail silently.
   */
  private readonly skipRefreshEndpoints = [
    '/notifications',
    '/api/v1/notifications',
  ];

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    if (this.shouldSkipToken(req.url)) {
      return next.handle(req);
    }

    const token = this.getToken();
    const authReq = token ? this.addToken(req, token) : req;

    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          // Don't attempt refresh for non-critical background endpoints
          if (this.shouldSkipRefresh(req.url)) {
            return throwError(() => err);
          }
          return this.handle401(req, next);
        }
        return throwError(() => err);
      })
    );
  }

  // ======================
  // 🔐 REFRESH LOGIC
  // ======================
  private handle401(req: HttpRequest<any>, next: HttpHandler) {

    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      // Some backend responses do not include a refresh token.
      // Avoid tearing down the authenticated shell on the first 401.
      return throwError(() => new Error('No refresh token'));
    }

    if (this.isRefreshing) {
      return this.refreshTokenSubject.pipe(
        filter(t => t !== null),
        take(1),
        switchMap(t => next.handle(this.addToken(req, t!)))
      );
    }

    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    return this.http.post<any>(
      apiEndpoint('/auth/refresh'),
      { refreshToken }
    ).pipe(

      switchMap(res => {
        const newToken = this.extractAccessToken(res);

        if (!newToken) {
          this.logout();
          return throwError(() => new Error('No access token'));
        }

        this.setToken(newToken);

        this.refreshTokenSubject.next(newToken);

        return next.handle(
          this.addToken(req, newToken).clone({
            setHeaders: {
              'x-refresh-retried': 'true'
            }
          })
        );
      }),

      catchError(err => {
        this.logout();
        return throwError(() => err);
      }),

      finalize(() => {
        this.isRefreshing = false;
      })
    );
  }

  // ======================
  // 🔧 HELPERS
  // ======================

  private getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(this.accessTokenKey);
  }

  private getRefreshToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(this.refreshTokenKey);
  }

  private setToken(token: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.accessTokenKey, token);
    }
  }

  private addToken(req: HttpRequest<any>, token: string) {
    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private shouldSkipToken(url: string): boolean {
    return this.skipTokenEndpoints.some(ep => url.includes(ep));
  }

  private shouldSkipRefresh(url: string): boolean {
    return this.skipRefreshEndpoints.some(ep => url.includes(ep));
  }

  private extractAccessToken(res: any): string | null {
    return res?.accessToken || res?.token || res?.data?.accessToken || null;
  }

  private logout() {
    this.authService.clearSession();
    this.router.navigate(['/auth/login']);
  }
}