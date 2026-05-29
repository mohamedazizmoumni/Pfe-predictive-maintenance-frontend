import { inject } from '@angular/core';
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

export const dataRoleGuard: CanActivateFn = (route) => {

  const authService = inject(AuthService);
  const router = inject(Router);

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

    router.navigate(['/auth/login']);

    return false;
  }

  return authService.currentUser$.pipe(

    // Wait until user is restored
    filter(user => user !== null),

    take(1),

    map(user => {

      if (!user) {

        router.navigate(['/auth/login']);

        return false;
      }

      const hasRole =
        userHasRequiredRole(
          user,
          requiredRoles
        );

      if (hasRole) {

        console.log(
          '✅ Access granted:',
          user.roles
        );

        return true;
      }

      console.warn(
        '⛔ Access denied',
        'User roles:',
        user.roles,
        'Required:',
        requiredRoles
      );

      router.navigate(['/access-denied']);

      return false;

    })

  );

};