import { Role, User } from '../../core/models/sentinel.models';

function normalizeDashboardRoleName(roleName?: string | null): string {
  if (!roleName) {
    return '';
  }

  const upperName = roleName.toUpperCase().startsWith('ROLE_')
    ? roleName.toUpperCase().slice(5)
    : roleName.toUpperCase();

  return upperName
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export type DashboardRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'FINANCE_MANAGER'
  | 'MANAGER'
  | 'STOCK_MANAGER'
  | 'TECHNICIAN';

export const ROLE_DASHBOARD_ROUTE: Record<DashboardRole, string> = {
  SUPER_ADMIN: '/dashboards/super-admin',
  ADMIN: '/dashboards/admin',
  FINANCE_MANAGER: '/dashboards/finance',
  MANAGER: '/dashboards/manager',
  STOCK_MANAGER: '/dashboards/stock-manager',
  TECHNICIAN: '/dashboards/technician',
};

export const DASHBOARD_ROLE_PRIORITY: DashboardRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'FINANCE_MANAGER',
  'MANAGER',
  'STOCK_MANAGER',
  'TECHNICIAN',
];

export function resolveDashboardRole(roles?: Array<Role | string> | null): DashboardRole | null {
  if (!roles || roles.length === 0) {
    return null;
  }

  const normalizedRoles = roles.map((role) => {
    if (typeof role === 'string') {
      return normalizeDashboardRoleName(role);
    }

    return normalizeDashboardRoleName(role?.name);
  });

  return DASHBOARD_ROLE_PRIORITY.find((role) => normalizedRoles.includes(role)) ?? null;
}

export function getDashboardRouteForRoles(roles?: Array<Role | string> | null): string {
  const dashboardRole = resolveDashboardRole(roles);
  return dashboardRole ? ROLE_DASHBOARD_ROUTE[dashboardRole] : ROLE_DASHBOARD_ROUTE.ADMIN;
}

export function getDashboardRouteForUser(user: User | null): string {
  return getDashboardRouteForRoles(user?.roles ?? null);
}
