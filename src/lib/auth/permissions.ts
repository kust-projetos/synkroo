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
 * Get all roles equal to or above a given role.
 */
export function rolesAtOrAbove(role: string): string[] {
  const level = ROLE_HIERARCHY[role] ?? 0;
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, lvl]) => lvl >= level)
    .map(([r]) => r);
}

/**
 * Check if a clinic ID matches the user's clinic.
 */
export function isSameClinic(userClinicId: string, targetClinicId: string): boolean {
  return userClinicId === targetClinicId;
}
