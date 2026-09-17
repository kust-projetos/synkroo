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
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM appointments WHERE clinic_id = ${CLINIC}`);
    await db.execute(sql`DELETE FROM idempotency_keys WHERE key LIKE ${'appointment:create:' + CLINIC + ':%'}`);
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
});
