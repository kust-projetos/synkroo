/**
 * Integration test: POST /api/appointments idempotency (Etapa 4).
 *
 * Proves the Idempotency-Key contract on appointment creation:
 *   - 2 POSTs with the SAME key + same body → 201 both, SAME id, exactly 1 row;
 *   - 2 POSTs with DIFFERENT keys → 201 both, different ids, 2 rows.
 *
 * Auth/RBAC/manifest are mocked to simulate an authenticated session
 * (mirrors patient-reassignment); repositories hit the real Drizzle DB.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/appointments/idempotency/integration.test.ts
 */

/** @jest-environment node */

jest.mock('@/lib/auth/session', () => ({ getUserProfile: jest.fn() }));

jest.mock('@/core/rbac/repository', () => ({
  drizzleRbacRepo: {
    getAccess: jest.fn().mockResolvedValue({
      isSystem: true,
      roleName: 'Owner',
      roleId: 'owner-role-id',
    }),
    getRolePermissions: jest.fn().mockResolvedValue([]),
    getOverrides: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/core/modules/manifest', () => {
  const actual = jest.requireActual('@/core/modules/manifest');
  return {
    ...actual,
    drizzleManifestRepo: {
      getEnabledModuleIds: jest.fn().mockResolvedValue(['core', 'operacional']),
    },
    createManifest: () => ({
      isEnabled: jest.fn().mockResolvedValue(true),
      enabledModules: jest.fn().mockResolvedValue(new Set(['core', 'operacional'])),
    }),
  };
});

import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { POST } from '@/app/api/appointments/route';
import { getUserProfile } from '@/lib/auth/session';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC = '00000000-0000-0000-0000-00000000d101';
const DENTIST = '00000000-0000-0000-0000-00000000d102';
const PATIENT = '00000000-0000-0000-0000-00000000d103';
const PROCEDURE_A = '00000000-0000-0000-0000-00000000d104';
const PROCEDURE_B = '00000000-0000-0000-0000-00000000d105';

function authAs(clinicId: string) {
  (getUserProfile as jest.Mock).mockResolvedValue({
    id: 'user-owner-idem',
    email: 'owner-idem@test.local',
    name: 'Owner Idem',
    clinic_id: clinicId,
  });
}

function postAppointment(body: Record<string, unknown>, key?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['Idempotency-Key'] = key;
  const req = new Request('http://localhost/api/appointments', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return POST(req as any);
}

async function countAppointments(): Promise<number> {
  const db = getDb();
  const { rows } = await db.execute(
    sql`SELECT count(*) as c FROM appointments WHERE clinic_id = ${CLINIC}`,
  );
  return Number((rows as any)[0].c);
}

describeOrSkip('POST /api/appointments idempotency — route + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC}, 'Appt Idem Clinic', 'appt-idem', '11999990301', 'idem@test.com')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO dentists (id, clinic_id, name, phone, email, cro)
          VALUES (${DENTIST}, ${CLINIC}, 'Idem Dentist', '11999990302', 'idem-dent@test.com', 'SP-99999')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO patients (id, clinic_id, name, phone)
          VALUES (${PATIENT}, ${CLINIC}, 'Idem Patient', '11999990303')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO procedures (id, clinic_id, name, duration_minutes, price)
          VALUES (${PROCEDURE_A}, ${CLINIC}, 'Idem Procedure A', 30, '150.00')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO procedures (id, clinic_id, name, duration_minutes, price)
          VALUES (${PROCEDURE_B}, ${CLINIC}, 'Idem Procedure B', 30, '200.00')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM appointments WHERE clinic_id = ${CLINIC}`);
    await db.execute(sql`DELETE FROM idempotency_keys WHERE key LIKE ${'appointment:create:' + CLINIC + ':%'}`);
    await db.execute(sql`DELETE FROM procedures WHERE id IN (${PROCEDURE_A}, ${PROCEDURE_B})`);
    await db.execute(sql`DELETE FROM patients WHERE id = ${PATIENT}`);
    await db.execute(sql`DELETE FROM dentists WHERE id = ${DENTIST}`);
    await db.execute(sql`DELETE FROM clinics WHERE id = ${CLINIC}`);
    await closeDb();
  });

  beforeEach(() => {
    (getUserProfile as jest.Mock).mockReset();
  });

  afterEach(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM appointments WHERE clinic_id = ${CLINIC}`);
  });

  it('duplicate retry with the SAME key returns the ORIGINAL result, no second row', async () => {
    authAs(CLINIC);
    const key = `appt-idem-same-${randomUUID()}`;
    const body = {
      patientId: PATIENT,
      dentistId: DENTIST,
      scheduledAt: '2026-11-01T10:00:00Z',
      durationMinutes: 30,
    };

    const res1 = await postAppointment(body, key);
    expect(res1.status).toBe(201);
    const json1 = await res1.json();
    const id1 = json1.data?.id;
    expect(id1).toBeDefined();

    const res2 = await postAppointment(body, key);
    expect(res2.status).toBe(201);
    const json2 = await res2.json();
    expect(json2.data?.id).toBe(id1);

    expect(await countAppointments()).toBe(1);
  });

  it('two POSTs with DIFFERENT keys create two rows', async () => {
    authAs(CLINIC);
    const bodyFor = (slot: string) => ({
      patientId: PATIENT,
      dentistId: DENTIST,
      scheduledAt: slot,
      durationMinutes: 30,
    });

    const res1 = await postAppointment(bodyFor('2026-11-02T10:00:00Z'), `appt-idem-diff-${randomUUID()}`);
    expect(res1.status).toBe(201);
    const id1 = (await res1.json()).data?.id;

    const res2 = await postAppointment(bodyFor('2026-11-02T11:00:00Z'), `appt-idem-diff-${randomUUID()}`);
    expect(res2.status).toBe(201);
    const id2 = (await res2.json()).data?.id;

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id2).not.toBe(id1);
    expect(await countAppointments()).toBe(2);
  });

  it('same key + DIFFERENT payload → 409 CONFLICT, nenhuma segunda linha', async () => {
    authAs(CLINIC);
    const key = `appt-idem-mismatch-${randomUUID()}`;
    const base = {
      patientId: PATIENT,
      dentistId: DENTIST,
      scheduledAt: '2026-11-03T10:00:00Z',
      durationMinutes: 30,
    };

    const res1 = await postAppointment(base, key);
    expect(res1.status).toBe(201);
    expect((await res1.json()).data?.id).toBeDefined();

    // Mesmo Idempotency-Key, slot divergente → fingerprint mismatch → conflito.
    // ActionError('conflict') → mapActionError → 409 + code CONFLICT (canônico).
    const res2 = await postAppointment({ ...base, scheduledAt: '2026-11-03T12:00:00Z' }, key);
    expect(res2.status).toBe(409);
    expect((await res2.json()).error?.code).toBe('CONFLICT');

    expect(await countAppointments()).toBe(1);
  });

  it('same key + mesma slot + durationMinutes divergente → 409 CONFLICT, nenhuma segunda linha', async () => {
    authAs(CLINIC);
    const key = `appt-idem-duration-${randomUUID()}`;
    const base = {
      patientId: PATIENT,
      dentistId: DENTIST,
      scheduledAt: '2026-11-05T10:00:00Z',
      durationMinutes: 30,
    };

    const res1 = await postAppointment(base, key);
    expect(res1.status).toBe(201);
    expect((await res1.json()).data?.id).toBeDefined();

    // durationMinutes faz parte do fingerprint → mismatch → conflito.
    const res2 = await postAppointment({ ...base, durationMinutes: 60 }, key);
    expect(res2.status).toBe(409);
    expect((await res2.json()).error?.code).toBe('CONFLICT');

    expect(await countAppointments()).toBe(1);
  });

  it('same key + procedureId divergente → 409 CONFLICT, nenhuma segunda linha', async () => {
    authAs(CLINIC);
    const key = `appt-idem-procedure-${randomUUID()}`;
    const base = {
      patientId: PATIENT,
      dentistId: DENTIST,
      procedureId: PROCEDURE_A,
      scheduledAt: '2026-11-06T10:00:00Z',
      durationMinutes: 30,
    };

    const res1 = await postAppointment(base, key);
    expect(res1.status).toBe(201);
    expect((await res1.json()).data?.id).toBeDefined();

    // procedureId faz parte do fingerprint → mismatch → conflito.
    const res2 = await postAppointment({ ...base, procedureId: PROCEDURE_B }, key);
    expect(res2.status).toBe(409);
    expect((await res2.json()).error?.code).toBe('CONFLICT');

    expect(await countAppointments()).toBe(1);
  });

  it('double-click concorrente (Promise.allSettled, mesma chave) → exatamente 1 linha', async () => {
    authAs(CLINIC);
    const key = `appt-idem-race-${randomUUID()}`;
    const body = {
      patientId: PATIENT,
      dentistId: DENTIST,
      scheduledAt: '2026-11-04T10:00:00Z',
      durationMinutes: 30,
    };

    const [r1, r2] = await Promise.allSettled([
      postAppointment(body, key),
      postAppointment(body, key),
    ]);
    const responses = [r1, r2].map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean) as Response[];
    expect(responses).toHaveLength(2);
    // 200/201-com-original OU 409/422-em-processo — ambos aceitos; exige 1 linha só.
    for (const res of responses) {
      expect([200, 201, 409, 422]).toContain(res.status);
    }
    expect(await countAppointments()).toBe(1);
    if (responses[0].status === 201 && responses[1].status === 201) {
      const j1 = await responses[0].json();
      const j2 = await responses[1].json();
      expect(j2.data?.id).toBe(j1.data?.id);
    }
  });
});
