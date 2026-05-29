import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { rolesCollectionHasAny } from '../utils/role.utils';
import { getRoleDashboardRoute } from '../utils/role.utils';
import { filter, map, take } from 'rxjs/operators';

const FINANCE_ROLES = ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'];

export const financeGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  // Fail fast if there's no token at all — no point waiting for a user
  if (!authService.hasToken()) {
    router.navigate(['/auth/login']);
    return false;
  }

  // Wait for the user to be fully hydrated before checking roles.
  // This prevents a hard-refresh race where getCurrentUser() returns null
  // before the auth service has finished restoring the session.
  return authService.currentUser$.pipe(
    filter(user => user !== null),
    take(1),
    map(user => {
      if (!user) {
        router.navigate(['/auth/login']);
        return false;
      }

      if (!rolesCollectionHasAny(user.roles, FINANCE_ROLES)) {
        router.navigate([getRoleDashboardRoute(user)]);
        return false;
      }

      return true;
    })
  );
};