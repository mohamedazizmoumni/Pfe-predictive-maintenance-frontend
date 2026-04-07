import { Injectable, inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';
import { userHasRequiredRole } from '../utils/role.utils';

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

      if (userHasRequiredRole(user, requiredRoles)) {
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