import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  CanActivateFn,
  Router
} from '@angular/router';

import { AuthService } from '../services/auth.service';

import {
  filter,
  map,
  take
} from 'rxjs/operators';

import {
  userHasRequiredRole
} from '../utils/role.utils';

export const dataRoleGuard: CanActivateFn = (route, state) => {

  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  const requiredRoles =
    route.data['requiredRoles'] as string[] | undefined;

  // No role restriction
  if (
    !requiredRoles ||
    requiredRoles.length === 0
  ) {
    return true;
  }

  // No token
  if (!authService.hasToken()) {

    // Skip navigation during SSR/prerender: there is no real session on
    // the server, so this would just redirect every protected route.
    if (isBrowser) {
      router.navigate(['/auth/login']);
    }

    return false;
  }

  return authService.currentUser$.pipe(

    // Wait until user is restored
    filter(user => user !== null),

    take(1),

    map(user => {

      if (!user) {

        if (isBrowser) {
          router.navigate(['/auth/login']);
        }

        return false;
      }

      const hasRole =
        userHasRequiredRole(
          user,
          requiredRoles
        );

      if (hasRole) {
        return true;
      }

      if (isBrowser) {
        router.navigate(['/access-denied'], { queryParams: { from: state.url } });
      }

      return false;

    })

  );

};