import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { LoginResponse, User } from '../../core/models/sentinel.models';
import {
  getDashboardRouteForRoles,
  getDashboardRouteForUser,
  ROLE_DASHBOARD_ROUTE,
  resolveDashboardRole,
} from './role-dashboard.map';

@Injectable({ providedIn: 'root' })
export class DashboardRoutingService {
  constructor(private readonly router: Router) {}

  getRouteForUser(user: User | null): string {
    return getDashboardRouteForUser(user);
  }

  getRouteForRoles(roles?: Array<string | { name: string }> | null): string {
    return getDashboardRouteForRoles(
      roles?.map((role) => (typeof role === 'string' ? role : role.name)) ?? null
    );
  }

  getRouteForLoginResponse(response: LoginResponse | null | undefined): string {
    return this.getRouteForRoles(response?.roles ?? response?.user?.roles ?? null);
  }

  getDashboardRouteForCurrentUser(user: User | null): string {
    return this.getRouteForUser(user);
  }

  getDashboardRoleLabel(user: User | null): string {
    const role = resolveDashboardRole(user?.roles ?? null) ?? 'ADMIN';
    return role
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  navigateToUserDashboard(user: User | null): Promise<boolean> {
    return this.router.navigate([this.getRouteForUser(user)]);
  }

  navigateToLoginResponseDashboard(response: LoginResponse | null | undefined): Promise<boolean> {
    return this.router.navigate([this.getRouteForLoginResponse(response)]);
  }

  get roleDashboardRouteMap(): typeof ROLE_DASHBOARD_ROUTE {
    return ROLE_DASHBOARD_ROUTE;
  }
}
