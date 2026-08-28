// scripts/migrate-userrole-to-rbac.ts
// Migração de dados: usuários existentes com role (enum legado) → user_clinic_access (RBAC granular).
// Executar APÓS aplicar a migration de schema (0004_rbac.sql) em cada ambiente.
// Uso: npx tsx scripts/migrate-userrole-to-rbac.ts

// Carrega .env.local ANTES de qualquer import que use process.env
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '..', '.env.local') });

import { getDb, closeDb } from '@/lib/db/client';
import { users, clinics } from '@/lib/db/schema/core';
import { roles, userClinicAccess } from '@/modules/core/schema/rbac';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { eq, and } from 'drizzle-orm';

const ROLE_MAP: Record<string, string> = {
  owner: RESERVED_ROLE_OWNER,      // 'Owner'
  admin: 'Administrador',          // NÃO Owner (anti-escalada)
  dentist: 'Dentista',
  receptionist: 'Recepcionista',
};

async function main() {
  const db = getDb();
  // Popula catálogo de permissões (idempotente) — sem isso, seedRbacForClinic
  // semeia perfis de sistema com permissões vazias.
  await bootstrapActions();
  const allClinics = await db.select({ id: clinics.id }).from(clinics);
  for (const c of allClinics) {
    await seedRbacForClinic(c.id);
    const staff = await db.select({ id: users.id, role: users.role, clinicId: users.clinicId }).from(users).where(eq(users.clinicId, c.id));
    for (const u of staff) {
      const roleName = ROLE_MAP[u.role] ?? 'Recepcionista';
      const [role] = await db.select({ id: roles.id }).from(roles)
        .where(and(eq(roles.clinicId, c.id), eq(roles.name, roleName))).limit(1);
      if (!role) { console.warn(`role ${roleName} ausente p/ clinica ${c.id}`); continue; }
      await db.insert(userClinicAccess)
        .values({ userId: u.id, clinicId: c.id, roleId: role.id })
        .onConflictDoNothing();
    }
  }
  console.log('migração userRole→RBAC concluída');
}

main().then(() => closeDb()).catch((e) => { console.error(e); process.exit(1); });
