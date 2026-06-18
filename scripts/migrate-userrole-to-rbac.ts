// scripts/migrate-userrole-to-rbac.ts
// Migração de dados: usuários existentes com role (enum legado) → user_clinic_access (RBAC granular).
// Executar APÓS aplicar a migration de schema (0004_rbac.sql) em cada ambiente.
// Uso: npx tsx scripts/migrate-userrole-to-rbac.ts

import { getDb, closeDb } from '@/lib/db/client';
import { users, clinics } from '@/lib/db/schema/core';
import { roles, userClinicAccess } from '@/lib/db/schema/rbac';
import { seedRbacForClinic } from '@/core/rbac/seed';
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
  const allClinics = await db.select({ id: clinics.id }).from(clinics);
  for (const c of allClinics) {
    await seedRbacForClinic(c.id);
    const staff = await db.select({ id: users.id, role: users.role, clinicId: users.clinicId, isMaster: users.isMaster }).from(users).where(eq(users.clinicId, c.id));
    for (const u of staff) {
      if (u.isMaster) continue; // master não precisa de acesso por clínica
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
