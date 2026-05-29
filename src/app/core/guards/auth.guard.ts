import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {

  const authService = inject(AuthService);
  const router = inject(Router);

  if (
    authService.hasToken() &&
    authService.isAuthenticated()
  ) {
    console.debug('✅ User authenticated');
    return true;
  }

  console.debug(
    '⚠️ No valid token, redirecting to login'
  );

  router.navigate(['/auth/login']);

  return false;

};