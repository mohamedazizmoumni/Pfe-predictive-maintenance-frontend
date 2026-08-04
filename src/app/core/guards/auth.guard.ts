import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {

  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (
    authService.hasToken() &&
    authService.isAuthenticated()
  ) {
    console.debug('✅ User authenticated');
    return true;
  }

  // Skip navigation during SSR/prerender: there is no real session on the
  // server, so redirecting there would just fail every protected route.
  if (isPlatformBrowser(platformId)) {
    console.debug(
      '⚠️ No valid token, redirecting to login'
    );
    router.navigate(['/auth/login']);
  }

  return false;

};