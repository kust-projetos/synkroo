import { eq, sql, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { clinics, users, userCredentials } from '@/lib/db/schema';
import { roles, userClinicAccess } from '@/modules/core/schema/rbac';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';

export interface AuthUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
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

/**
 * Fetch the full user profile (with clinic) by user ID.
 */
export async function findUserProfileById(
  userId: string,
): Promise<AuthUserRow | null> {
  const db = getDb();

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      isActive: users.isActive,
      clinicId: users.clinicId,
      clinicIdJson: clinics.id,
      clinicName: clinics.name,
      clinicSlug: clinics.slug,
      clinicPhone: clinics.phone,
      clinicEmail: clinics.email,
      clinicSettings: clinics.settings,
    })
    .from(users)
    .innerJoin(clinics, eq(clinics.id, users.clinicId))
    .where(eq(users.id, userId))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    phone: row.phone,
    avatarUrl: row.avatarUrl,
    isActive: row.isActive,
    clinicId: row.clinicId,
    clinics: {
      id: row.clinicIdJson,
      name: row.clinicName,
      slug: row.clinicSlug,
      phone: row.clinicPhone,
      email: row.clinicEmail,
      settings: (row.clinicSettings || {}) as Record<string, unknown>,
    },
  };
}

/**
 * Fetch user by email (for signup duplicate check).
 */
export async function findUserByEmail(
  email: string,
): Promise<{ id: string } | null> {
  const db = getDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return rows[0] || null;
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
  const { hashPassword } = await import('@/lib/auth/password');

  const slug = params.clinicName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const result = await db.transaction(async (tx) => {
    // 1. Create clinic
    const [clinic] = await tx
      .insert(clinics)
      .values({
        name: params.clinicName,
        slug,
        phone: '',
        email: params.email,
        settings: {
          business_hours: {
            monday: { open: '08:00', close: '18:00' },
            tuesday: { open: '08:00', close: '18:00' },
            wednesday: { open: '08:00', close: '18:00' },
            thursday: { open: '08:00', close: '18:00' },
            friday: { open: '08:00', close: '18:00' },
            saturday: { open: '08:00', close: '12:00' },
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
        email: params.email,
        name: params.name,
        role: 'owner',
        isActive: true,
      })
      .returning();

    // 3. Create credentials
    await tx.insert(userCredentials).values({
      userId: user.id,
      passwordHash: hashPassword(params.password),
    });

    // 4. Seed dos perfis de sistema (idempotente) na MESMA tx — atomicidade da FK roles.clinic_id.
    await seedRbacForClinic(clinic.id, tx);

    // 5. Concede ao dono o acesso com role Owner (sem isso, resolveAccess → can:()=>false = lockout).
    const [ownerRole] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.clinicId, clinic.id), eq(roles.name, RESERVED_ROLE_OWNER)))
      .limit(1);
    if (!ownerRole) throw new Error('[signup] perfil Owner não foi semeado');
    await tx.insert(userClinicAccess).values({
      userId: user.id,
      clinicId: clinic.id,
      roleId: ownerRole.id,
    });

    return { user, clinic };
  });

  // Return full profile
  const profile = await findUserProfileById(result.user.id);
  return profile!;
}
