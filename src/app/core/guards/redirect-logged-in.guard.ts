import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import {
  Router,
  CanActivateFn
} from '@angular/router';

import { AuthService } from '../services/auth.service';

import {
  getRoleDashboardRoute
} from '../utils/role.utils';

import {
  map,
  take
} from 'rxjs/operators';

export const redirectLoggedInGuard: CanActivateFn = () => {

  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  return authService.isAuthenticated$.pipe(

    take(1),

    map((isAuthenticated) => {

      if (
        isAuthenticated &&
        authService.hasToken()
      ) {

        // Skip navigation during SSR/prerender: there is no real session
        // on the server, so this would just redirect every render.
        if (isPlatformBrowser(platformId)) {
          const user =
            authService.getCurrentUser();

          const route =
            getRoleDashboardRoute(user);

          router.navigate([route]);
        }

        return false;
      }

      return true;

    })

  );

};