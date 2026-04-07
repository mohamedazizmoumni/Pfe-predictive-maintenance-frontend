import { Role, User } from '../models/sentinel.models';

const ROLE_ALIASES: Record<string, string> = {
  TECHNICIEN: 'TECHNICIAN',
};

export function normalizeRoleName(roleName?: string | null): string {
  if (!roleName) {
    return '';
  }
  const upperName = roleName.toUpperCase();
  return ROLE_ALIASES[upperName] ?? upperName;
}

export function normalizeRoleList(roles?: string[]): string[] {
  if (!roles || roles.length === 0) {
    return [];
  }
  return roles
    .map((role) => normalizeRoleName(role))
    .filter((role) => !!role);
}

/**
 * Check if user has required role(s)
 * SUPER_ADMIN always has access to everything
 */
export function userHasRequiredRole(
  user: User | null,
  requiredRoles: string[]
): boolean {
  if (!user) {
    return false;
  }

  // ✅ SUPER_ADMIN bypasses all role checks
  if (user.roles.some((role) => normalizeRoleName(role.name) === 'SUPER_ADMIN')) {
    return true;
  }

  const normalizedRequired = normalizeRoleList(requiredRoles);
  if (normalizedRequired.length === 0) {
    return true;
  }

  return user.roles.some((role) =>
    normalizedRequired.includes(normalizeRoleName(role.name))
  );
}

/**
 * Check if roles collection has any of the required roles
 * SUPER_ADMIN always has access to everything
 */
export function rolesCollectionHasAny(
  roles: Role[] | undefined | null,
  requiredRoles: string[]
): boolean {
  if (!roles) {
    return false;
  }

  if (roles.some((role) => normalizeRoleName(role.name) === 'SUPER_ADMIN')) {
    return true;
  }

  const normalizedRequired = normalizeRoleList(requiredRoles);
  if (normalizedRequired.length === 0) {
    return true;
  }

  return roles.some((role) =>
    normalizedRequired.includes(normalizeRoleName(role.name))
  );
}