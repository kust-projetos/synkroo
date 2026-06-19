import { getDb } from '@/lib/db/client';
import { clinics } from '@/lib/db/schema/core';
import { seedRbacForClinic } from '@/core/rbac/seed';

export async function provisionClinic(data: { name: string; slug: string; phone: string; email: string }) {
  const db = getDb();
  const [clinic] = await db.insert(clinics).values(data).returning({ id: clinics.id });
  await seedRbacForClinic(clinic.id);   // presets + Owner + Agente
  return clinic;
}
