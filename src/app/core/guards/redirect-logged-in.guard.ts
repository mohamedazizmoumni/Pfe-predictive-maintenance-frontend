import { inject } from '@angular/core';

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

  return authService.isAuthenticated$.pipe(

    take(1),

    map((isAuthenticated) => {

      if (
        isAuthenticated &&
        authService.hasToken()
      ) {

        const user =
          authService.getCurrentUser();

        const route =
          getRoleDashboardRoute(user);

        router.navigate([route]);

        return false;
      }

      return true;

    })

  );

};