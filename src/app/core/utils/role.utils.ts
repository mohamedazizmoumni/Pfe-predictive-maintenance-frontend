import { Role, User } from '../models/sentinel.models';
import { getDashboardRouteForUser } from '../../pages/dashboards/role-dashboard.map';

const ROLE_ALIASES: Record<string, string> = {
  TECHNICIEN: 'TECHNICIAN',
  FINANCEMANAGER: 'FINANCE_MANAGER',
  FINANCE_MANAGER_ROLE: 'FINANCE_MANAGER',
  FINANCE_MGR: 'FINANCE_MANAGER',
};

/**
 * Normalize a role name
 */
export function normalizeRoleName(
  roleName?: string | null
): string {

  if (!roleName) {
    return '';
  }

  const upperName =
    roleName.toUpperCase().startsWith('ROLE_')
      ? roleName.toUpperCase().slice(5)
      : roleName.toUpperCase();

  const normalized = upperName
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  const compact =
    normalized.replace(/_/g, '');

  return (
    ROLE_ALIASES[normalized] ??
    ROLE_ALIASES[compact] ??
    normalized
  );

}

/**
 * Normalize role list
 */
export function normalizeRoleList(
  roles?: string[]
): string[] {

  if (!roles || roles.length === 0) {
    return [];
  }

  return roles
    .map(role => normalizeRoleName(role))
    .filter(role => !!role);

}

/**
 * Returns dashboard route for user
 */
export function getRoleDashboardRoute(
  user: User | null
): string {

  if (!user || !user.roles) {
    return '/auth/login';
  }

  const normalizedRoles =
    user.roles.map(role =>
      normalizeRoleName(role.name)
    );

  // SUPER ADMIN
  if (normalizedRoles.includes('SUPER_ADMIN')) {
    return '/dashboards/super-admin';
  }

  // ADMIN
  if (normalizedRoles.includes('ADMIN')) {
    return '/dashboards/admin';
  }

  // MANAGER
  if (normalizedRoles.includes('MANAGER')) {
    return '/dashboards/manager';
  }

  // STOCK MANAGER
  if (normalizedRoles.includes('STOCK_MANAGER')) {
    return '/dashboards/stock-manager';
  }

  // TECHNICIAN
  if (normalizedRoles.includes('TECHNICIAN')) {
    return '/dashboards/technician';
  }

  // FINANCE
  if (normalizedRoles.includes('FINANCE_MANAGER')) {
    return '/finance/dashboard';
  }

  // STOCK MANAGER
  if (normalizedRoles.includes('STOCK_MANAGER')) {
    return '/inventory';
  }

  // DATA SCIENTIST
  if (normalizedRoles.includes('DATA_SCIENTIST')) {
    return '/recommendations';
  }

  // VIEWER
  if (normalizedRoles.includes('VIEWER')) {
    return '/equipment';
  }

  // fallback
  return '/access-denied';

}

/**
 * Legacy compatibility
 */
export function getDashboardRouteForNormalizedRoles(
  normalizedRoles: string[]
): string {

  if (normalizedRoles.includes('SUPER_ADMIN')) {
    return '/dashboards/super-admin';
  }

  if (normalizedRoles.includes('ADMIN')) {
    return '/dashboards/admin';
  }

  if (normalizedRoles.includes('MANAGER')) {
    return '/dashboards/manager';
  }

  if (normalizedRoles.includes('STOCK_MANAGER')) {
    return '/dashboards/stock-manager';
  }

  if (normalizedRoles.includes('TECHNICIAN')) {
    return '/dashboards/technician';
  }

  if (normalizedRoles.includes('FINANCE_MANAGER')) {
    return '/finance/dashboard';
  }

  if (normalizedRoles.includes('STOCK_MANAGER')) {
    return '/inventory';
  }

  if (normalizedRoles.includes('DATA_SCIENTIST')) {
    return '/recommendations';
  }

  if (normalizedRoles.includes('VIEWER')) {
    return '/equipment';
  }

  return '/access-denied';

}

export function getPrimaryRole(
  user: User | null
): string {

  if (
    !user ||
    !user.roles ||
    user.roles.length === 0
  ) {
    return 'Unknown';
  }

  const normalized =
    user.roles.map((r) =>
      normalizeRoleName(r.name)
    );

  const priority = [
    'SUPER_ADMIN',
    'ADMIN',
    'FINANCE_MANAGER',
    'MANAGER',
    'STOCK_MANAGER',
    'TECHNICIAN',
    'DATA_SCIENTIST',
    'VIEWER'
  ];

  for (const role of priority) {

    if (normalized.includes(role)) {
      return role.replace('_', ' ');
    }

  }

  return normalized[0] ?? 'Unknown';

}

export function userHasRequiredRole(
  user: User | null,
  requiredRoles: string[]
): boolean {

  if (!user) {
    return false;
  }

  const normalizedUserRoles =
    user.roles.map(role =>
      normalizeRoleName(role.name)
    );

  // SUPER_ADMIN bypass
  if (
    normalizedUserRoles.includes(
      'SUPER_ADMIN'
    )
  ) {
    return true;
  }

  const normalizedRequired =
    normalizeRoleList(requiredRoles);

  if (
    normalizedRequired.length === 0
  ) {
    return true;
  }

  return normalizedRequired.some(role =>
    normalizedUserRoles.includes(role)
  );

}

/**
 * Check if roles collection contains any required role
 */
export function rolesCollectionHasAny(
  roles: Role[] | undefined | null,
  requiredRoles: string[]
): boolean {

  if (!roles) {
    return false;
  }

  const normalizedUserRoles =
    roles.map(role =>
      normalizeRoleName(role.name)
    );

  // SUPER_ADMIN bypass
  if (
    normalizedUserRoles.includes(
      'SUPER_ADMIN'
    )
  ) {
    return true;
  }

  const normalizedRequired =
    normalizeRoleList(requiredRoles);

  if (
    normalizedRequired.length === 0
  ) {
    return true;
  }

  return normalizedRequired.some(role =>
    normalizedUserRoles.includes(role)
  );

}