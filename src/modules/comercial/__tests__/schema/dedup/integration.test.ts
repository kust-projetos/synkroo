/** @jest-environment node */

// Integration: uses real DB — disables jest.setup.ts mock
jest.unmock('@/lib/db/client');

/**
 * Integration test: Concurrent lead capture dedup via unique partial index.
 *
 * Verifies that two concurrent captures with same (clinic_id, phone_normalized)
 * result in exactly one lead row. This is the DB-level dedup guarantee that
 * prevents webhook/manual race conditions.
 *
 * Requires RUN_INTEGRATION_TESTS=1 (set by jest.integration.config.js).
 */

import { getDb, closeDb } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import { leads } from '@/modules/comercial/schema';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Minimal capture helper — uses INSERT ... ON CONFLICT to upsert by
 * (clinic_id, phone_normalized) leveraging the unique partial index.
 */
async function captureLead(input: {
  clinicId: string;
  name: string;
  phone: string;
  source: string;
}): Promise<{ leadId: string }> {
  const phoneNormalized = normalizePhone(input.phone);
  const result = await getDb()
    .insert(leads)
    .values({
      clinicId: input.clinicId,
      name: input.name,
      phone: input.phone,
      phoneNormalized,
      source: input.source,
    })
    .onConflictDoUpdate({
      target: [leads.clinicId, leads.phoneNormalized],
      targetWhere: sql`${leads.phoneNormalized} IS NOT NULL AND ${leads.phoneNormalized} <> ''`,
      set: { name: input.name, updatedAt: new Date() },
    })
    .returning({ leadId: leads.id });

  return { leadId: result[0].leadId };
}

const describeOrSkip =
  process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

describeOrSkip('Comercial — lead dedup (DB-level)', () => {
  let clinicId: string;

  beforeAll(async () => {
    const slug = `test-dedup-${crypto.randomUUID().slice(0, 8)}`;
    const r = await getDb().execute(
      sql`INSERT INTO clinics (name, slug, phone, email)
          VALUES ('Test Dedup', ${slug}, '11999990000', 'dedup@test.com')
          RETURNING id`,
    );
    clinicId = r.rows[0].id as string;
  });

  afterAll(async () => {
    if (clinicId) {
      await getDb().execute(sql`DELETE FROM clinics WHERE id = ${clinicId}`);
    }
    await closeDb();
  });

  beforeEach(async () => {
    if (clinicId) {
      await getDb().execute(
        sql`DELETE FROM leads WHERE clinic_id = ${clinicId}`,
      );
    }
  });

  it('keeps one lead for concurrent same clinic phone capture', async () => {
    const input = {
      clinicId,
      name: 'Maria',
      phone: '(11) 99999-0000',
      source: 'whatsapp' as const,
    };

    const results = await Promise.all([
      captureLead(input),
      captureLead({ ...input, name: 'Maria Silva' }),
    ]);

    expect(new Set(results.map((r) => r.leadId)).size).toBe(1);

    const phoneNormalized = normalizePhone(input.phone);
    const count = await getDb()
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(
        sql`${leads.clinicId} = ${clinicId} AND ${leads.phoneNormalized} = ${phoneNormalized}`,
      );

    expect(Number(count[0].count)).toBe(1);
  });

  it('allows different phones for same clinic', async () => {
    const r1 = await captureLead({
      clinicId,
      name: 'João',
      phone: '(11) 99999-1111',
      source: 'whatsapp',
    });
    const r2 = await captureLead({
      clinicId,
      name: 'Ana',
      phone: '(11) 99999-2222',
      source: 'web',
    });

    expect(r1.leadId).not.toBe(r2.leadId);
  });

  it('allows same phone across different clinics', async () => {
    const slug2 = `test-dedup2-${crypto.randomUUID().slice(0, 8)}`;
    const r2 = await getDb().execute(
      sql`INSERT INTO clinics (name, slug, phone, email)
          VALUES ('Test Dedup 2', ${slug2}, '11999990000', 'dedup2@test.com')
          RETURNING id`,
    );
    const clinic2Id = r2.rows[0].id as string;

    try {
      const rA = await captureLead({
        clinicId,
        name: 'Lead A',
        phone: '(11) 99999-3333',
        source: 'whatsapp',
      });
      const rB = await captureLead({
        clinicId: clinic2Id,
        name: 'Lead B',
        phone: '(11) 99999-3333',
        source: 'web',
      });

      expect(rA.leadId).not.toBe(rB.leadId);
    } finally {
      await getDb().execute(
        sql`DELETE FROM clinics WHERE id = ${clinic2Id}`,
      );
    }
  });
});
