/**
 * Integration test: getInactivityStats boundary alignment (P0-BOUNDARY-FIX).
 *
 * Prova de intervalo real contra Postgres: faixas [30,60)/[60,90)/[90,180)/
 * [180,∞) em dias reais — lower INCLUSIVO + upper EXCLUSIVO, alinhado a
 * getInactivitySegment. Offsets fracionários evitam flakiness de relógio
 * (sem congelar o tempo do SQL).
 *
 * Run: npm run test:integration:run -- src/services/followup/__tests__/getInactivityStats.integration.test.ts
 * (ou RUN_INTEGRATION_TESTS=1 npx jest --config jest.integration.config.js <este arquivo>)
 */

/** @jest-environment node */

import { getDb, closeDb } from '@/lib/db/client';
import { clinics } from '@/lib/db/schema/core';
import { patients } from '@/modules/operacional/schema';
import { getInactivityStats } from '../inactive-patient.service';
import { inArray } from 'drizzle-orm';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const DAY = 24 * 3600 * 1000;
const ts = String(Date.now()).slice(-10);
const CLINIC_A = `a0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const CLINIC_B = `b0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;

const daysAgo = (d: number): Date => new Date(Date.now() - d * DAY);

describeOrSkip('getInactivityStats — boundary intervals (DB real)', () => {
  beforeAll(async () => {
    const db = getDb();

    await db.insert(clinics).values([
      { id: CLINIC_A, name: 'Stats Boundary Clinic A', slug: `stats-boundary-a-${ts}`, phone: '', email: 'stats-a@t.local' },
      { id: CLINIC_B, name: 'Stats Boundary Clinic B', slug: `stats-boundary-b-${ts}`, phone: '', email: 'stats-b@t.local' },
    ]).onConflictDoNothing();

    await db.insert(patients).values([
      // Fora: 29.5d (< 30d, não inativo)
      { clinicId: CLINIC_A, name: 'Fora 29.5d', phone: '11900000001', lastVisitAt: daysAgo(29.5) },
      // bucket30 [30,60): 30.5d e 59.5d
      { clinicId: CLINIC_A, name: 'B30 30.5d', phone: '11900000002', lastVisitAt: daysAgo(30.5) },
      { clinicId: CLINIC_A, name: 'B30 59.5d', phone: '11900000003', lastVisitAt: daysAgo(59.5) },
      // bucket60 [60,90): 60.5d
      { clinicId: CLINIC_A, name: 'B60 60.5d', phone: '11900000004', lastVisitAt: daysAgo(60.5) },
      // bucket90 [90,180): 90.5d
      { clinicId: CLINIC_A, name: 'B90 90.5d', phone: '11900000005', lastVisitAt: daysAgo(90.5) },
      // bucket180 [180,∞): 180.5d + NULL
      { clinicId: CLINIC_A, name: 'B180 180.5d', phone: '11900000006', lastVisitAt: daysAgo(180.5) },
      { clinicId: CLINIC_A, name: 'B180 NULL', phone: '11900000007', lastVisitAt: null },
      // P1 active-only: soft-deleted 100d (seria bucket90) NÃO pode contar.
      { clinicId: CLINIC_A, name: 'Soft-deleted 100d', phone: '11900000009', lastVisitAt: daysAgo(100), deletedAt: new Date() },
      // Outra clínica: 100d (seria bucket90, mas NÃO pode entrar no tenant A)
      { clinicId: CLINIC_B, name: 'Outra clinica 100d', phone: '11900000008', lastVisitAt: daysAgo(100) },
    ]).onConflictDoNothing();
  });

  afterAll(async () => {
    const db = getDb();
    try {
      await db.delete(patients).where(inArray(patients.clinicId, [CLINIC_A, CLINIC_B]));
      await db.delete(clinics).where(inArray(clinics.id, [CLINIC_A, CLINIC_B]));
    } finally {
      await closeDb();
    }
  });

  it('agrupa por faixas lower-inclusivo/upper-exclusivo com tenant isolado', async () => {
    const stats = await getInactivityStats(CLINIC_A);

    expect(stats.bySegment).toEqual({
      inactive_30: 2, // 30.5d + 59.5d
      inactive_60: 1, // 60.5d
      inactive_90: 1, // 90.5d
      inactive_180: 2, // 180.5d + NULL
    });
    // 29.5d fora + paciente da clínica B fora ⇒ 6 (cada paciente conta 1x).
    expect(stats.totalInactive).toBe(6);
    expect(stats.atRiskRevenue).toBe(6 * 2 * 250);
  });

  it('não vaza paciente de outra clínica (tenant)', async () => {
    const statsB = await getInactivityStats(CLINIC_B);
    expect(statsB.bySegment).toEqual({
      inactive_30: 0,
      inactive_60: 0,
      inactive_90: 1, // 100d
      inactive_180: 0,
    });
    expect(statsB.totalInactive).toBe(1);
  });

  it('exclui soft-deleted das contagens (active-only, DB real)', async () => {
    const stats = await getInactivityStats(CLINIC_A);
    // Sem o filtro deleted_at, o soft-deleted 100d cairia no bucket90.
    expect(stats.bySegment.inactive_90).toBe(1);
    expect(stats.totalInactive).toBe(6);
  });
});
