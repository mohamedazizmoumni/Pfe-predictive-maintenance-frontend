import { Injectable, inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const redirectLoggedInGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated$.pipe(
    take(1),
    map((isAuthenticated) => {
      if (isAuthenticated) {
        console.log('✅ User already authenticated, redirecting to dashboard');
        router.navigate(['/dashboard']);
        return false;
      } else {
        console.log('✅ User not authenticated, allowing access to auth page');
        return true;
      }
    })
  );
};