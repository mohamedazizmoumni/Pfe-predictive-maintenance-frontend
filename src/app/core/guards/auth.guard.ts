import { Injectable, inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';
import { rolesCollectionHasAny } from '../utils/role.utils';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if user has valid token
  if (!authService.hasToken()) {
    console.warn('⚠️ No valid token, redirecting to login');
    router.navigate(['/auth/login']);
    return false;
  }

  // Check if user is authenticated
  return authService.isAuthenticated$.pipe(
    take(1),
    map((isAuthenticated) => {
      if (isAuthenticated) {
        console.log('✅ User authenticated');
        return true;
      } else {
        console.warn('⚠️ User not authenticated, redirecting to login');
        router.navigate(['/auth/login']);
        return false;
      }
    })
  );
};

export const dataRoleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = route.data['requiredRoles'] as string[] | undefined;

  // If no required roles specified, allow access
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  // Check if user is authenticated and has required role
  return authService.currentUser$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        console.warn('⚠️ No user found, redirecting to login');
        router.navigate(['/auth/login']);
        return false;
      }

      const hasRole = rolesCollectionHasAny(user.roles, requiredRoles);

      if (hasRole) {
        console.log('✅ User has required role');
        return true;
      } else {
        console.warn('⚠️ User lacks required role, redirecting to access denied');
        router.navigate(['/access-denied']);
        return false;
      }
    })
  );
};
