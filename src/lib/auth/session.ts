import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "./auth";
import { findUserProfileById, hasUserClinicAccess } from "@/repositories/auth";

export interface ServerUserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  session_version: number;
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
    session_version: row.sessionVersion,
    clinic_id: row.clinicId,
    clinics: row.clinics,
  };
}

/**
 * Get the current session from the request context.
 */
export async function getSession(): Promise<Session | null> {
  try {
    return await getServerSession<typeof authOptions, Session>(authOptions);
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
    if (!profile || !profile.isActive) return null;
    const sessionVersion = session.user.sessionVersion;
    if (
      sessionVersion !== undefined &&
      sessionVersion !== profile.sessionVersion
    )
      return null;
    const activeProfile = toProfileCamel(profile);
    if (session.user.clinicId) {
      if (!(await hasUserClinicAccess(session.user.id, session.user.clinicId)))
        return null;
      activeProfile.clinic_id = session.user.clinicId;
    }
    return activeProfile;
  } catch {
    return null;
  }
}

/**
 * Require authentication — throws if not authenticated.
 */
export async function requireActiveProfile(): Promise<ServerUserProfile> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const profile = await getUserProfile();
  if (
    !profile ||
    profile.session_version !== (session.user.sessionVersion ?? 0)
  ) {
    throw new Error("Unauthorized");
  }
  return profile;
}

export async function requireAuth(): Promise<{ id: string; email: string }> {
  const profile = await requireActiveProfile();
  return { id: profile.id, email: profile.email };
}

/**
 * Require specific role(s).
 */
export async function requireRole(roles: string[]): Promise<ServerUserProfile> {
  const profile = await requireActiveProfile();
  if (!roles.includes(profile.role)) throw new Error("Forbidden");
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
      return {
        success: false,
        error: { message: "Unauthorized", status: 401 },
      };
    }
    if (!profile.is_active) {
      return {
        success: false,
        error: { message: "User account is inactive", status: 403 },
      };
    }
    return {
      success: true,
      user: { id: profile.id, email: profile.email },
      profile,
    };
  } catch {
    return {
      success: false,
      error: { message: "Authentication error", status: 500 },
    };
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
    return {
      success: false,
      error: { message: "Access denied to this clinic", status: 403 },
    };
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
  try {
    await requireActiveProfile();
    return true;
  } catch {
    return false;
  }
}

// Re-export as getUser for backward compatibility
export { getCurrentUser as getUser };
