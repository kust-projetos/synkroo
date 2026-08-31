import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "./auth";
import { findUserProfileById } from "@/repositories/auth";
import { drizzleRbacRepo } from "@/core/rbac/repository";
import { resolveAccess } from "@/core/rbac/resolve";

export interface ServerUserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  role_id: string;
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
  available_clinics?: Array<{
    id: string;
    name: string;
    slug: string;
    roleId: string;
    role: string;
  }>;
}

function toProfileCamel(row: any): ServerUserProfile {
  if (!row) return null as any;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    role_id: row.roleId,
    phone: row.phone,
    avatar_url: row.avatarUrl,
    is_active: row.isActive,
    session_version: row.sessionVersion,
    clinic_id: row.clinicId,
    clinics: row.clinics,
    ...(row.availableClinics ? { available_clinics: row.availableClinics } : {}),
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
    // W3.1: autoridade é user_clinic_access — role efetiva vem da clínica ativa
    const activeClinicId = (session.user as any).clinicId as string | undefined;
    if (!activeClinicId) return null;
    const profile = await findUserProfileById(session.user.id, activeClinicId);
    if (!profile || !profile.isActive) return null;
    const sessionVersion = (session.user as any).sessionVersion;
    if (
      sessionVersion !== undefined &&
      sessionVersion !== profile.sessionVersion
    )
      return null;
    // findUserProfileById ja validou a membership da clinica ativa.
    return toProfileCamel(profile);
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

/** Require a permission resolved from the active membership, never users.role. */
export async function requirePermission(permissionKey: string): Promise<ServerUserProfile> {
  const profile = await requireActiveProfile();
  const access = await resolveAccess(profile.id, profile.clinic_id, drizzleRbacRepo);
  if (!access.can(permissionKey)) throw new Error("Forbidden");
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
export async function validateApiAuth(requiredPermission?: string): Promise<AuthResult> {
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
    if (requiredPermission) {
      const access = await resolveAccess(profile.id, profile.clinic_id, drizzleRbacRepo);
      if (!access.can(requiredPermission)) {
        return {
          success: false,
          error: { message: "Insufficient permissions", status: 403 },
        };
      }
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
