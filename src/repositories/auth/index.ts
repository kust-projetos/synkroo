import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { normalizeEmail } from "@/lib/validations/common";
import { getDb } from "@/lib/db/client";
import { clinics, users, userCredentials } from "@/lib/db/schema";
import { roles, userClinicAccess } from "@/modules/core/schema/rbac";
import { seedRbacForClinic } from "@/core/rbac/seed";
import { RESERVED_ROLE_OWNER } from "@/core/rbac/presets";

export interface AuthUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  roleId: string;
  roleName: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  sessionVersion: number;
  clinicId: string;
  clinics: {
    id: string;
    name: string;
    slug: string;
    phone: string;
    email: string;
    settings: Record<string, unknown>;
  } | null;
}

export interface UserClinicOption {
  id: string;
  name: string;
  slug: string;
  roleId: string;
  role: string;
}

function activeMembership(clinicId: string, now = new Date()) {
  return and(
    eq(userClinicAccess.clinicId, clinicId),
    isNull(userClinicAccess.revokedAt),
    or(isNull(userClinicAccess.expiresAt), gt(userClinicAccess.expiresAt, now)),
  );
}

/**
 * Fetch the full user profile (with clinic) by user ID and active clinic.
 * Now authoritative via user_clinic_access — role comes from access row, not users.role.
 */
export async function findUserProfileById(
  userId: string,
  activeClinicId: string,
): Promise<AuthUserRow | null> {
  const db = getDb();

  // The active clinic is always explicit. The access row is the authority for
  // both membership and role; users.role is legacy bootstrap data only.
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: roles.name,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      isActive: users.isActive,
      sessionVersion: users.sessionVersion,
      clinicId: clinics.id,
      clinicName: clinics.name,
      clinicSlug: clinics.slug,
      clinicPhone: clinics.phone,
      clinicEmail: clinics.email,
      clinicSettings: clinics.settings,
      roleId: roles.id,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(userClinicAccess, and(eq(userClinicAccess.userId, users.id), eq(userClinicAccess.clinicId, activeClinicId)))
    .innerJoin(clinics, eq(clinics.id, userClinicAccess.clinicId))
    .innerJoin(roles, and(
      eq(roles.id, userClinicAccess.roleId),
      eq(roles.clinicId, userClinicAccess.clinicId),
    ))
    .where(and(
      eq(users.id, userId),
      eq(users.isActive, true),
      activeMembership(activeClinicId),
    ))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    roleId: row.roleId,
    roleName: row.roleName,
    phone: row.phone,
    avatarUrl: row.avatarUrl,
    isActive: row.isActive,
    sessionVersion: row.sessionVersion,
    clinicId: row.clinicId,
    clinics: {
      id: row.clinicId,
      name: row.clinicName,
      slug: row.clinicSlug,
      phone: row.clinicPhone,
      email: row.clinicEmail,
      settings: (row.clinicSettings || {}) as Record<string, unknown>,
    },
  };
}

/** List only active memberships, including clinics whose default user.clinic_id differs. */
export async function listUserClinics(userId: string): Promise<UserClinicOption[]> {
  const now = new Date();
  const rows = await getDb()
    .select({
      id: clinics.id,
      name: clinics.name,
      slug: clinics.slug,
      roleId: roles.id,
      role: roles.name,
    })
    .from(userClinicAccess)
    .innerJoin(users, eq(users.id, userClinicAccess.userId))
    .innerJoin(clinics, eq(clinics.id, userClinicAccess.clinicId))
    .innerJoin(roles, and(
      eq(roles.id, userClinicAccess.roleId),
      eq(roles.clinicId, userClinicAccess.clinicId),
    ))
    .where(and(
      eq(userClinicAccess.userId, userId),
      eq(users.isActive, true),
      isNull(userClinicAccess.revokedAt),
      or(isNull(userClinicAccess.expiresAt), gt(userClinicAccess.expiresAt, now)),
    ));
  return rows;
}

export async function hasUserClinicAccess(
  userId: string,
  clinicId: string,
): Promise<boolean> {
  const db = getDb();
  const [access] = await db
    .select({ userId: userClinicAccess.userId })
    .from(userClinicAccess)
      .where(
        and(
          eq(userClinicAccess.userId, userId),
          activeMembership(clinicId),
        ),
      )
    .limit(1);
  return Boolean(access);
}
/**
 * Fetch user by email (for signup duplicate check).
 */
export async function findUserByEmail(
  email: string,
): Promise<{ id: string } | null> {
  const normalizedEmail = normalizeEmail(email);
  const db = getDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  return rows[0] || null;
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_current_password' };

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
): Promise<ChangePasswordResult> {
  const db = getDb();
  const { hashPassword, verifyPassword } = await import('@/lib/auth/password');

  return db.transaction(async (tx) => {
    const [credential] = await tx
      .select({ passwordHash: userCredentials.passwordHash })
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId))
      .for('update');

    if (!credential || !(await verifyPassword(currentPassword, credential.passwordHash))) {
      return { ok: false as const, reason: 'invalid_current_password' as const };
    }

    await tx
      .update(userCredentials)
      .set({ passwordHash: await hashPassword(nextPassword), updatedAt: new Date() })
      .where(eq(userCredentials.userId, userId));

    await tx
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { ok: true as const };
  });
}

/**
 * Replace the stored password hash without requiring the current password.
 * Used for transparent re-hash to the versioned format after login.
 */
export async function updateUserPasswordHash(userId: string, nextHash: string): Promise<void> {
  await getDb()
    .update(userCredentials)
    .set({ passwordHash: nextHash, updatedAt: new Date() })
    .where(eq(userCredentials.userId, userId));
}

export async function revokeUserSession(userId: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

interface CreateUserWithClinicParams {
  email: string;
  password: string;
  name: string;
  clinicName: string;
}

/**
 * Create a clinic, user profile, and credentials in a single transaction.
 * Returns the created user profile.
 */
export async function createUserWithClinic(
  params: CreateUserWithClinicParams,
): Promise<AuthUserRow> {
  const db = getDb();
  const { hashPassword } = await import("@/lib/auth/password");
  const normalizedEmail = normalizeEmail(params.email);

  const slug = params.clinicName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const result = await db.transaction(async (tx) => {
    // 1. Create clinic
    const [clinic] = await tx
      .insert(clinics)
      .values({
        name: params.clinicName,
        slug,
        phone: "",
        email: normalizedEmail,
        settings: {
          business_hours: {
            monday: { open: "08:00", close: "18:00" },
            tuesday: { open: "08:00", close: "18:00" },
            wednesday: { open: "08:00", close: "18:00" },
            thursday: { open: "08:00", close: "18:00" },
            friday: { open: "08:00", close: "18:00" },
            saturday: { open: "08:00", close: "12:00" },
            sunday: { open: null, close: null },
          },
          ai_settings: {
            auto_response: true,
            escalation_enabled: true,
            business_name: params.clinicName,
          },
        },
      })
      .returning();

    // 2. Create user profile
    const [user] = await tx
      .insert(users)
      .values({
        clinicId: clinic.id,
        email: normalizedEmail,
        name: params.name,
        role: "owner",
        isActive: true,
      })
      .returning();

    // 3. Create credentials
    await tx.insert(userCredentials).values({
      userId: user.id,
      passwordHash: await hashPassword(params.password),
    });

    // 4. Garante catálogo populado (idempotente) antes do seed.
    // Sem bootstrap, seedRbacForClinic semeia perfis com permissões vazias.
    const { bootstrapActions } = await import("@/core/actions/bootstrap");
    await bootstrapActions();

    // 5. Seed dos perfis de sistema (idempotente) na MESMA tx — atomicidade da FK roles.clinic_id.
    await seedRbacForClinic(clinic.id, tx);

    // 6. Concede ao dono o acesso com role Owner (sem isso, resolveAccess → can:()=>false = lockout).
    const [ownerRole] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(eq(roles.clinicId, clinic.id), eq(roles.name, RESERVED_ROLE_OWNER)),
      )
      .limit(1);
    if (!ownerRole) throw new Error("[signup] perfil Owner não foi semeado");
    await tx.insert(userClinicAccess).values({
      userId: user.id,
      clinicId: clinic.id,
      roleId: ownerRole.id,
    });

    return { user, clinic };
  });

  // Return full profile — usar clínica recém-criada como ativa (W3.1)
  const profile = await findUserProfileById(result.user.id, result.clinic.id);
  return profile!;
}
