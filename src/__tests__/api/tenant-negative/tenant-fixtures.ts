/**
 * tenant-fixtures.ts — helper compartilhado da suíte tenant-negative (Etapa 3).
 *
 * - Par fixo de clínicas A/B (UUIDs dedicados a esta suíte, sem colisão com
 *   tasks-scope a001/b001 nem patient-reassignment a101/b101).
 * - ensure/cleanup das clínicas + auth Owner mockada + asserção anti-vazamento.
 *
 * Sem testes neste arquivo (não casa com *.integration.test.ts).
 * Snapshots de linha ficam em cada arquivo de domínio (padrão tasks-scope).
 */

import { sql } from 'drizzle-orm';

export const TN_CLINIC_A = '00000000-0000-0000-0000-00000000a201';
export const TN_CLINIC_B = '00000000-0000-0000-0000-00000000b201';

export async function ensureTenantClinics(db: any): Promise<void> {
  await db.execute(
    sql`INSERT INTO clinics (id, name, slug, phone, email)
        VALUES (${TN_CLINIC_A}, 'Tenant Neg Clinic A', 'tn-neg-a', '11999992001', 'tn-neg-a@test.com')
        ON CONFLICT (id) DO NOTHING`,
  );
  await db.execute(
    sql`INSERT INTO clinics (id, name, slug, phone, email)
        VALUES (${TN_CLINIC_B}, 'Tenant Neg Clinic B', 'tn-neg-b', '11999992002', 'tn-neg-b@test.com')
        ON CONFLICT (id) DO NOTHING`,
  );
}

export async function cleanupTenantClinics(db: any): Promise<void> {
  await db.execute(sql`DELETE FROM clinics WHERE id IN (${TN_CLINIC_A}, ${TN_CLINIC_B})`);
}

/** Simula sessão Owner da clínica indicada (padrão patient-reassignment). */
export function authAsOwner(getUserProfileMock: jest.Mock, clinicId: string): void {
  getUserProfileMock.mockResolvedValue({
    id: 'user-owner-a',
    email: 'owner-a@test.local',
    name: 'Owner A',
    clinic_id: clinicId,
  });
}

/** O corpo da resposta não pode conter nenhum dos segredos do tenant B. */
export function expectNoLeak(body: unknown, secrets: readonly string[]): void {
  const raw = JSON.stringify(body);
  for (const secret of secrets) {
    expect(raw).not.toContain(secret);
  }
}
