/**
 * Permission helpers for role-based access control.
 *
 * Hierarchy (highest to lowest):
 *   owner > admin > dentist > receptionist
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 80,
  dentist: 50,
  receptionist: 30,
};

/**
 * Check if a user's role meets the minimum required role.
 * Uses role hierarchy levels.
 */
export function hasMinRole(userRole: string, minRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
  return userLevel >= requiredLevel;
}

/**
 * Check if user role is in the allowed set.
 */
export function isRoleIn(userRole: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Get all roles equal to or above a given role.
 */
export function rolesAtOrAbove(role: string): string[] {
  const level = ROLE_HIERARCHY[role] ?? 0;
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, lvl]) => lvl >= level)
    .map(([r]) => r);
}

/**
 * Admin or above (owner, admin).
 */
export function isAdminOrAbove(role: string): boolean {
  return isRoleIn(role, ['owner', 'admin']);
}

/**
 * Check if a clinic ID matches the user's clinic.
 */
export function isSameClinic(userClinicId: string, targetClinicId: string): boolean {
  return userClinicId === targetClinicId;
}
