import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { findUserProfileById } from '@/repositories/auth';

export interface ServerUserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  clinic_id: string;
  clinics: {
    id: string;
    name: string;
    slug: string;
    phone: string;
    email: string;
    settings: Record<string, unknown>;
  } | null;
}

function toProfileCamel(row: any): ServerUserProfile {
  if (!row) return null as any;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    phone: row.phone,
    avatar_url: row.avatarUrl,
    is_active: row.isActive,
    clinic_id: row.clinicId,
    clinics: row.clinics,
  };
}

/**
 * Get the current session from the request context.
 */
export async function getSession() {
  try {
    return await getServerSession(authOptions);
  } catch {
    // Return null when no request context (e.g., during build, tests)
    return null;
  }
}

/**
 * Get the current authenticated user ID and basic info from session.
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}

/**
 * Get the full user profile (with clinic) for the currently authenticated user.
 */
export async function getUserProfile(): Promise<ServerUserProfile | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;

  try {
    const profile = await findUserProfileById(session.user.id);
    return profile ? toProfileCamel(profile) : null;
  } catch {
    return null;
  }
}

/**
 * Require authentication — throws if not authenticated.
 */
export async function requireAuth(): Promise<{ id: string; email: string }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Require specific role(s).
 */
export async function requireRole(roles: string[]): Promise<ServerUserProfile> {
  const profile = await getUserProfile();
  if (!profile || !roles.includes(profile.role)) {
    throw new Error('Forbidden');
  }
  return profile;
}

/**
 * API Authentication Response.
 */
export interface AuthResult {
  success: boolean;
  error?: { message: string; status: number };
  user?: { id: string; email: string };
  profile?: ServerUserProfile;
}

/**
 * Validate API authentication.
 */
export async function validateApiAuth(): Promise<AuthResult> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: { message: 'Unauthorized', status: 401 } };
    }
    if (!profile.is_active) {
      return { success: false, error: { message: 'User account is inactive', status: 403 } };
    }
    return {
      success: true,
      user: { id: profile.id, email: profile.email },
      profile,
    };
  } catch {
    return { success: false, error: { message: 'Authentication error', status: 500 } };
  }
}

/**
 * Validate that user belongs to the specified clinic.
 */
export async function validateClinicAccess(
  clinicId: string,
): Promise<AuthResult> {
  const result = await validateApiAuth();
  if (!result.success) return result;
  if (result.profile!.clinic_id !== clinicId) {
    return { success: false, error: { message: 'Access denied to this clinic', status: 403 } };
  }
  return result;
}

/**
 * Check if user has required role.
 */
export function hasRequiredRole(
  profile: { role: string },
  allowedRoles: string[],
): boolean {
  return allowedRoles.includes(profile.role);
}

/**
 * Check if user is authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session?.user?.id;
}

// Re-export as getUser for backward compatibility
export { getCurrentUser as getUser };
