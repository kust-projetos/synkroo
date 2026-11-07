/**
 * Integration: WhatsApp exact appointment confirmation (P0).
 *
 * DB-backed proof for every acceptance clause:
 *  - SIM with one valid pending → exactly that appointment confirmed.
 *  - "NÃO VOU" / "OK" / "sim, obrigado" → NO mutation (never auto-cancel).
 *  - SIM without pending → no change.
 *  - Second pending for the same sender fails explicitly (single intent); legacy duplicates stay ambiguous.
 *  - Similar phone / other tenant → no change.
 *  - Duplicate inbound event → one effect (replay, no second mutation).
 *  - Commit-unknown simulation → reconcile by event before any retry.
 *  - Expired / already-final pendings → no appointment mutation.
 *  - Waitlist: exact SIM with a notified entry escalates concrete_offer_required; never books.
 *  - Full path: persistInboundMessage → dispatchInboundMessageJob →
 *    persisted confirmed state (not only the helper).
 *  - Action path: runAction(processarConfirmacaoResposta) confirms.
 *
 * Run: TEST_DATABASE_URL=postgresql://.../synkroo_test npm run test:integration:run -- confirmation-exact
 * Guard: skips entirely when RUN_INTEGRATION_TESTS is not set.
 */

/** @jest-environment node */

import { Pool } from 'pg';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST as wahaPost } from '@/app/api/whatsapp/waha/route';

// Skip entire suite when RUN_INTEGRATION_TESTS is not set — hooks run before describe.skip.
const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';

import '@/modules/operacional/actions';
import '@/modules/atendimento/actions';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { runAction } from '@/core/actions/run';
import { processarConfirmacaoResposta } from '@/modules/operacional/actions/processar-confirmacao-resposta';
import {
  createConfirmationRequest,
  processTrustedConfirmation,
  processTrustedWaitlistResponse,
  reconcileConfirmationByEvent,
  reconcileWaitlistByEvent,
  resolveInboundReply,
} from '../confirmation-service';
import { persistInboundMessage } from '@/modules/atendimento/repositories/conversations-repository';
import { sendWhatsAppMessage } from '@/modules/atendimento/services/channel-service';
import { markNotified } from '@/repositories/waitlist';
import { dispatchInboundMessageJob } from '@/modules/atendimento/services/dispatch-inbound-message';
import { routeInboundToAgent } from '@/core/ia-channel/webhook-router';

// The dispatcher must never reach the agent on escalate/confirm paths.
// Mock the router (call tracking) and make a real agent invocation loud.
jest.mock('@/core/ia-channel/webhook-router', () => ({
  routeInboundToAgent: jest.fn(async () => ({ from: 'mock', action: 'agent' })),
}));
jest.mock('@/core/ia-channel/agent-invoker', () => ({
  invokeAgent: jest.fn(async () => {
    throw new Error('invokeAgent must not run in confirmation-path integration tests');
  }),
}));

// Outbound sends are mocked as delivered: these tests prove the persisted
// DB state + routing decisions, not provider delivery. Individual cases
// override the mock to simulate send failure (dispatcher must then fail
// the job for outbox retry instead of silently dropping the reply).
jest.mock('@/modules/atendimento/services/channel-service', () => {
  const actual = jest.requireActual('@/modules/atendimento/services/channel-service');
  return { ...actual, sendWhatsAppMessage: jest.fn(async () => ({ success: true })) };
});

// Commit-then-throw injection for the unknown-outcome test: the FIRST
// transaction committed through the wrapped handle actually commits and
// then throws, simulating a lost commit response.
let failNextCommit = false;
jest.mock('@/lib/db/client', () => {
  const actual = jest.requireActual('@/lib/db/client');
  return {
    ...actual,
    getDb: () => {
      const db = actual.getDb();
      if (!failNextCommit) return db;
      return new Proxy(db, {
        get(t, p) {
          if (p === 'transaction') {
            return async (cb: any) => {
              const result = await (t as any).transaction(cb);
              failNextCommit = false;
              throw new Error('simulated-lost-commit-response');
            };
          }
          return (t as any)[p];
        },
      });
    },
  };
});

const mockRouteInboundToAgent = routeInboundToAgent as jest.Mock;
const mockSendWhatsAppMessage = sendWhatsAppMessage as jest.Mock;

const CLINIC_A = '00000000-0000-0000-0000-000000000a11';
const CLINIC_B = '00000000-0000-0000-0000-000000000b11';
const DENTIST_A1 = '00000000-0000-0000-0000-000000000a21';
const DENTIST_A2 = '00000000-0000-0000-0000-000000000a22';
const DENTIST_B1 = '00000000-0000-0000-0000-000000000b21';
const PATIENT_A = '00000000-0000-0000-0000-000000000a31';
const PATIENT_B = '00000000-0000-0000-0000-000000000b31';
const SENDER_A = '5511987654321';
const SIMILAR_SENDER = '5511987654322';

let pool: Pool;
let convCounter = 0;

function uniquePhone(base: string): string {
  convCounter += 1;
  // Deterministic distinct senders per test (keeps EXACT matching meaningful).
  return `${base.slice(0, -2)}${String(70 + convCounter).padStart(2, '0')}`;
}

async function waitForSchemaReady(maxAttempts = 20, baseDelayMs = 500): Promise<Pool> {
  let lastError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let p: Pool | undefined = undefined;
    try {
      p = new Pool({ connectionString: process.env.DATABASE_URL! });
      await p.query('SELECT 1');
      const tableRow = await p.query(`SELECT to_regclass('public.appointment_confirmation_requests') AS tbl`);
      if (!tableRow.rows[0]?.tbl) throw new Error('appointment_confirmation_requests not migrated yet');
      return p;
    } catch (err: any) { lastError = err.message; }
    try { await p?.end(); } catch { /* ignore */ }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
  }
  throw new Error(`Schema not ready: ${lastError}`);
}

function makeCtx(clinicId = CLINIC_A) {
  return {
    source: 'user' as const,
    user: { id: '00000000-0000-0000-0000-000000000001', email: 'test@test.local', name: 'Test User', role: 'admin' },
    clinicId,
    role: 'admin',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'test-user' },
  };
}

async function seedStatic(): Promise<void> {
  for (const [id, slug, plan] of [[CLINIC_A, 'test-clinic-exact-a', 'starter'], [CLINIC_B, 'test-clinic-exact-b', 'starter']] as const) {
    await pool.query(`DELETE FROM clinics WHERE id = $1`, [id]);
    await pool.query(
      `INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
       VALUES ($1, $2, $3, '+5500000000000', 'clinic@test.local', $4, 'active')`,
      [id, `Clinic ${slug}`, slug, plan],
    );
  }
  for (const [id, clinic] of [[DENTIST_A1, CLINIC_A], [DENTIST_A2, CLINIC_A], [DENTIST_B1, CLINIC_B]] as const) {
    await pool.query(`DELETE FROM dentists WHERE id = $1`, [id]);
    await pool.query(
      `INSERT INTO dentists (id, clinic_id, name, phone, email, cro) VALUES ($1, $2, $3, '+5511000000001', 'd@test.local', 'SP-1')`,
      [id, clinic, `Dent ${id}`],
    );
  }
  await pool.query(`DELETE FROM patients WHERE id IN ($1, $2)`, [PATIENT_A, PATIENT_B]);
  await pool.query(
    `INSERT INTO patients (id, clinic_id, name, phone, email) VALUES ($1, $2, 'Patient A', $3, 'a@t.local')`,
    [PATIENT_A, CLINIC_A, `+${SENDER_A}`],
  );
  await pool.query(
    `INSERT INTO patients (id, clinic_id, name, phone, email) VALUES ($1, $2, 'Patient B', '+5511888888888', 'b@t.local')`,
    [PATIENT_B, CLINIC_B],
  );
}

async function cleanupDynamic(): Promise<void> {
  await pool.query(`DELETE FROM appointment_confirmation_requests WHERE clinic_id IN ($1, $2)`, [CLINIC_A, CLINIC_B]);
  await pool.query(`DELETE FROM appointments WHERE clinic_id IN ($1, $2)`, [CLINIC_A, CLINIC_B]);
  await pool.query(`DELETE FROM waitlist WHERE clinic_id IN ($1, $2)`, [CLINIC_A, CLINIC_B]);
  await pool.query(`DELETE FROM outbox_jobs WHERE clinic_id IN ($1, $2)`, [CLINIC_A, CLINIC_B]);
  await pool.query(
    `DELETE FROM conversations WHERE clinic_id IN ($1, $2) AND external_id LIKE '5511%'`,
    [CLINIC_A, CLINIC_B],
  );
}

async function makeConversation(clinicId: string, phone: string): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO conversations (clinic_id, channel, external_id, status)
     VALUES ($1, 'whatsapp', $2, 'active')
     ON CONFLICT (clinic_id, channel, external_id) DO NOTHING
     RETURNING id`,
    [clinicId, phone],
  );
  if (rows[0]?.id) return rows[0].id;
  const { rows: existing } = await pool.query(
    `SELECT id FROM conversations WHERE clinic_id = $1 AND channel = 'whatsapp' AND external_id = $2 LIMIT 1`,
    [clinicId, phone],
  );
  return existing[0].id;
}

async function makeAppointment(clinicId: string, patientId: string, dentistId: string, scheduledAt: string, status = 'scheduled'): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
     VALUES ($1, $2, $3, $4, 30, $5) RETURNING id`,
    [clinicId, patientId, dentistId, scheduledAt, status],
  );
  return rows[0].id;
}

async function makePatient(clinicId: string, phone: string, name = 'Synthetic Patient'): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, $2, $3, $4) RETURNING id`,
    [clinicId, name, `+${phone}`, `${Date.now()}-${Math.floor(Math.random() * 1e6)}@t.local`],
  );
  return rows[0].id;
}

async function seedAuthenticInbound(conversationId: string, content: string, eventId: string, opts?: {
  provider?: string;
  direction?: 'inbound' | 'outbound';
  createdAt?: string;
  /**
   * Provider message clock persisted as metadata.authenticatedEventAt.
   * `undefined` (default) → fresh timestamp (now + 2s, strictly after any
   * just-created intent so the stale-replay guard passes); explicit ISO
   * string → used as-is; explicit null → NO authenticated marker (missing case).
   */
  eventTimestamp?: string | null;
}): Promise<void> {
  const meta: Record<string, unknown> = {};
  // Default provider clock: at least 2s after the pending/intent now.
  // The stale-replay guard fails closed on same-second ties (unverifiable
  // ordering never consumes), so helper defaults must be strictly later
  // than intent creation. Explicit stale/missing cases pass their own
  // eventTimestamp and are preserved.
  if (opts?.eventTimestamp === undefined) meta.authenticatedEventAt = new Date(Date.now() + 2000).toISOString();
  else if (opts?.eventTimestamp !== null) meta.authenticatedEventAt = opts.eventTimestamp;
  await pool.query(
    `INSERT INTO messages (conversation_id, direction, content, message_type, external_provider, external_message_id, created_at, metadata)
     VALUES ($1, $2, $3, 'text', $4, $5, COALESCE($6::timestamptz, NOW()), $7::jsonb)`,
    [conversationId, opts?.direction ?? 'inbound', content, opts?.provider ?? 'waha', eventId, opts?.createdAt ?? null, JSON.stringify(meta)],
  );
}

async function appointmentStatus(id: string): Promise<string> {
  const { rows } = await pool.query(`SELECT status FROM appointments WHERE id = $1`, [id]);
  return rows[0]?.status;
}

async function conversationStatus(id: string): Promise<string> {
  const { rows } = await pool.query(`SELECT status FROM conversations WHERE id = $1`, [id]);
  return rows[0]?.status;
}

function dispatchJob(conversationId: string, phone: string, content: string, eventId: string, provider = 'waha', opts?: {
  messageType?: string;
  messageKind?: 'text' | 'button';
  receivedAt?: string;
}): any {
  return {
    id: `job-${eventId}`,
    payload: {
      clinicId: CLINIC_A,
      conversationId,
      channel: 'whatsapp',
      externalConversationId: phone,
      externalProvider: provider,
      externalMessageId: eventId,
      content,
      messageType: opts?.messageType ?? 'text',
      messageKind: opts?.messageKind ?? 'text',
      receivedAt: opts?.receivedAt ?? new Date(Date.now() + 2000).toISOString(),
      metadata: {},
    },
  };
}

async function requestState(id: string): Promise<any> {
  const { rows } = await pool.query(
    `SELECT status, outcome, consumed_by_provider, consumed_by_event FROM appointment_confirmation_requests WHERE id = $1`,
    [id],
  );
  return rows[0];
}

async function requestSnapshot(id: string): Promise<any> {
  const { rows } = await pool.query(
    `SELECT status, outcome, patient_id, appointment_scheduled_at, clinic_timezone, consumed_by_provider, consumed_by_event
       FROM appointment_confirmation_requests WHERE id = $1`,
    [id],
  );
  return rows[0];
}

async function appointmentRow(id: string): Promise<any> {
  const { rows } = await pool.query(`SELECT status, scheduled_at FROM appointments WHERE id = $1`, [id]);
  return rows[0];
}

beforeAll(async () => {
  if (SKIP) return;
  await bootstrapActions();
  pool = await waitForSchemaReady();
  await cleanupDynamic();
  await seedStatic();
}, 60_000);

afterEach(async () => {
  if (SKIP || !pool) return;
  await cleanupDynamic();
  mockRouteInboundToAgent.mockClear();
  mockSendWhatsAppMessage.mockClear();
});

afterAll(async () => {
  if (SKIP || !pool) return;
  try {
    await pool.query(`DELETE FROM appointment_confirmation_requests WHERE clinic_id IN ($1, $2)`, [CLINIC_A, CLINIC_B]);
    await pool.query(`DELETE FROM appointments WHERE clinic_id IN ($1, $2)`, [CLINIC_A, CLINIC_B]);
    await pool.query(`DELETE FROM waitlist WHERE clinic_id IN ($1, $2)`, [CLINIC_A, CLINIC_B]);
    await pool.query(`DELETE FROM outbox_jobs WHERE clinic_id IN ($1, $2)`, [CLINIC_A, CLINIC_B]);
    await pool.query(`DELETE FROM conversations WHERE clinic_id IN ($1, $2)`, [CLINIC_A, CLINIC_B]);
    await pool.query(`DELETE FROM patients WHERE id IN ($1, $2)`, [PATIENT_A, PATIENT_B]);
    await pool.query(`DELETE FROM dentists WHERE id IN ($1, $2, $3)`, [DENTIST_A1, DENTIST_A2, DENTIST_B1]);
    await pool.query(`DELETE FROM clinics WHERE id IN ($1, $2)`, [CLINIC_A, CLINIC_B]);
  } catch { /* ignore */ }
  await pool.end();
});

const describeOrSkip = SKIP ? describe.skip : describe;

function trusted(phone: string, conversationId: string, content: string, event: string, clinicId = CLINIC_A, opts?: {
  messageType?: string;
  messageKind?: 'text' | 'button';
  receivedAt?: Date | string | null;
}) {
  return {
    clinicId,
    conversationId,
    senderPhone: phone,
    content,
    externalProvider: 'waha',
    externalMessageId: event,
    messageType: opts?.messageType ?? 'text',
    messageKind: opts?.messageKind ?? 'text',
    receivedAt: opts?.receivedAt ?? new Date(Date.now() + 2000),
  };
}

describeOrSkip('exact confirmation (DB-backed)', () => {
  it('SIM with one valid pending → exactly that appointment confirmed', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T10:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(req.deduped).toBe(false);

    const result = await processTrustedConfirmation(trusted(SENDER_A, conv, 'SIM', 'evt-sim-1'));

    expect(result.processed).toBe(true);
    expect(result.action).toBe('confirmed');
    expect(result.appointmentId).toBe(appt);
    expect(result.responseMessage).toContain('Confirmado');
    expect(await appointmentStatus(appt)).toBe('confirmed');
    const state = await requestState(req.id);
    expect(state.status).toBe('consumed');
    expect(state.outcome).toBe('confirmed');
    expect(state.consumed_by_provider).toBe('waha');
    expect(state.consumed_by_event).toBe('evt-sim-1');
  });

  it('NÃO VOU → no confirm, no cancel, request stays pending (human decides)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T11:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    const result = await processTrustedConfirmation(trusted(SENDER_A, conv, 'NÃO VOU', 'evt-nao-1'));

    expect(result.processed).toBe(false);
    expect(await appointmentStatus(appt)).toBe('scheduled');
    expect((await requestState(req.id)).status).toBe('pending');
  });

  it('OK and "sim, obrigado" → no appointment change (no includes-match)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T12:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    for (const [label, text] of [['ok', 'OK'], ['includes', 'sim, obrigado']] as const) {
      const result = await processTrustedConfirmation(trusted(SENDER_A, conv, text, `evt-${label}-1`));
      expect(result.processed).toBe(false);
    }
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('SIM without pending → no change', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T13:00:00Z');

    const result = await processTrustedConfirmation(trusted(SENDER_A, conv, 'sim', 'evt-nopending-1'));

    expect(result.processed).toBe(false);
    expect(result.reason).toBe('no_pending');
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('second pending for the same sender fails; first intent still confirms', async () => {
    // Single-intent invariant: at most one pending per (clinic, sender),
    // regardless of appointment/conversation. The second create must fail
    // explicitly — never dedupe, replace, or hide the first intent.
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt1 = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T14:00:00Z');
    const appt2 = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A2, '2030-06-10T15:00:00Z');
    const req1 = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt1, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await expect(createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt2, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    })).rejects.toThrow(/another conversation/);
    expect((await requestState(req1.id)).status).toBe('pending');

    const result = await processTrustedConfirmation(trusted(SENDER_A, conv, 'SIM', 'evt-amb-1'));

    expect(result).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt1 });
    expect(await appointmentStatus(appt1)).toBe('confirmed');
    expect(await appointmentStatus(appt2)).toBe('scheduled');
  });

  it('same sender in two conversations: second create fails; SIM never consumes the other appointment', async () => {
    // Cross-conversation ambiguity: appointment A prompted in conversation
    // X, appointment B prompted in conversation Y, same sender. The second
    // prompt must never exist — and a SIM arriving on the other
    // conversation must escalate, never consume.
    const convA = await makeConversation(CLINIC_A, SENDER_A);
    const convB = await makeConversation(CLINIC_A, uniquePhone(SENDER_A));
    const apptA = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T14:00:00Z');
    const apptB = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A2, '2030-06-10T15:00:00Z');
    const reqA = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: apptA, conversationId: convA,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await expect(createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: apptB, conversationId: convB,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    })).rejects.toThrow(/another conversation/);
    expect((await requestState(reqA.id)).status).toBe('pending');

    // SIM on the OTHER conversation: no mutation, explicit mismatch.
    const cross = await processTrustedConfirmation(trusted(SENDER_A, convB, 'SIM', 'evt-cross-conv-1'));
    expect(cross.processed).toBe(false);
    expect(cross.reason).toBe('conversation_mismatch');
    expect(await appointmentStatus(apptA)).toBe('scheduled');
    expect(await appointmentStatus(apptB)).toBe('scheduled');
    expect((await requestState(reqA.id)).status).toBe('pending');

    // Resolver likewise hands off before attempting consume.
    const decision = await resolveInboundReply({ ...trusted(SENDER_A, convB, 'SIM', 'evt-cross-conv-2') });
    expect(decision).toMatchObject({ kind: 'escalate', reason: 'conversation_mismatch' });
    expect(await appointmentStatus(apptA)).toBe('scheduled');

    // The owning conversation still confirms.
    const ok = await processTrustedConfirmation(trusted(SENDER_A, convA, 'SIM', 'evt-cross-conv-3'));
    expect(ok).toMatchObject({ processed: true, action: 'confirmed', appointmentId: apptA });
    expect(await appointmentStatus(apptA)).toBe('confirmed');
    expect(await appointmentStatus(apptB)).toBe('scheduled');
  });

  it('similar phone → no change (no partial phone matching)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T16:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    const result = await processTrustedConfirmation(trusted(SIMILAR_SENDER, conv, 'SIM', 'evt-similar-1'));

    expect(result.processed).toBe(false);
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('other tenant → no change', async () => {
    const convB = await makeConversation(CLINIC_B, '+5511888888888');
    const apptB = await makeAppointment(CLINIC_B, PATIENT_B, DENTIST_B1, '2030-06-10T10:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_B, appointmentId: apptB, conversationId: convB,
      senderPhone: '+5511888888888', expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const convA = await makeConversation(CLINIC_A, SENDER_A);
    const apptA = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T17:00:00Z');

    // Tenant A context can never consume tenant B's pending, and vice versa.
    const cross = await processTrustedConfirmation(trusted('+5511888888888', convA, 'SIM', 'evt-cross-1', CLINIC_A));
    expect(cross.processed).toBe(false);
    expect(await appointmentStatus(apptB)).toBe('scheduled');
    expect(await appointmentStatus(apptA)).toBe('scheduled');
  });

  it('duplicate inbound event → one effect (replay, no second mutation)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T18:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    const first = await processTrustedConfirmation(trusted(SENDER_A, conv, 'sim', 'evt-dup-1'));
    const second = await processTrustedConfirmation(trusted(SENDER_A, conv, 'sim', 'evt-dup-1'));

    expect(first.processed).toBe(true);
    expect(second.processed).toBe(true);
    expect(second.appointmentId).toBe(appt);
    const { rows } = await pool.query(
      `SELECT status, outcome, COUNT(*) OVER () AS n FROM appointment_confirmation_requests
       WHERE clinic_id = $1 AND consumed_by_event = 'evt-dup-1'`,
      [CLINIC_A],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('consumed');
    expect(await appointmentStatus(appt)).toBe('confirmed');
  });

  it('unknown outcome reconciles by event before any retry', async () => {
    // Simulate a commit that succeeded while the response was lost: the
    // consumption record exists, the retry carries the SAME inbound event.
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T19:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const committed = await processTrustedConfirmation(trusted(SENDER_A, conv, 'SIM', 'evt-lost-1'));
    expect(committed.processed).toBe(true);

    // The "retry" replays through the consumption record — no new mutation.
    const reconciled = await reconcileConfirmationByEvent({
      clinicId: CLINIC_A, conversationId: conv, senderPhone: SENDER_A,
      externalProvider: 'waha', externalMessageId: 'evt-lost-1',
    });
    expect(reconciled).toMatchObject({ found: true, outcome: 'confirmed', appointmentId: appt });
    const retry = await processTrustedConfirmation(trusted(SENDER_A, conv, 'SIM', 'evt-lost-1'));
    expect(retry).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt });

    const unknown = await reconcileConfirmationByEvent({
      clinicId: CLINIC_A, conversationId: conv, senderPhone: SENDER_A,
      externalProvider: 'waha', externalMessageId: 'evt-never-seen',
    });
    expect(unknown).toMatchObject({ found: false });

    // A replayed event id in ANOTHER conversation cannot return this
    // conversation's outcome (scope is clinic+conversation+sender+event).
    const otherConv = await makeConversation(CLINIC_A, SENDER_A);
    const crossConv = await reconcileConfirmationByEvent({
      clinicId: CLINIC_A, conversationId: otherConv, senderPhone: SENDER_A,
      externalProvider: 'waha', externalMessageId: 'evt-lost-1',
    });
    expect(crossConv).toMatchObject({ found: false });
  });

  it('committed-then-lost outcome exercises catch+reconcile exactly once', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T22:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    // The transaction commits, then the response is "lost": the service
    // must reconcile by provider/event and return the recorded outcome
    // instead of throwing or repeating the mutation.
    failNextCommit = true;
    let result;
    try {
      result = await processTrustedConfirmation(trusted(SENDER_A, conv, 'SIM', 'evt-lostcommit-1'));
    } finally {
      failNextCommit = false;
    }
    expect(result).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt });
    expect(await appointmentStatus(appt)).toBe('confirmed');
    const { rows } = await pool.query(
      `SELECT status, outcome FROM appointment_confirmation_requests
       WHERE clinic_id = $1 AND consumed_by_event = 'evt-lostcommit-1'`,
      [CLINIC_A],
    );
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ status: 'consumed', outcome: 'confirmed' });
  });

  it('expired pending does not block renewal of the same key', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T23:00:00Z');
    const stale = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2000-01-01T00:00:00Z'),
    });
    expect(stale.deduped).toBe(false);

    const renewed = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(renewed.deduped).toBe(false);
    expect(renewed.id).not.toBe(stale.id);
    expect((await requestState(stale.id)).status).toBe('expired');

    const confirmed = await processTrustedConfirmation(trusted(SENDER_A, conv, 'SIM', 'evt-renew-1'));
    expect(confirmed).toMatchObject({ processed: true, appointmentId: appt });
    expect(await appointmentStatus(appt)).toBe('confirmed');
  });

  it('duplicate create with unexpired pending dedupes in-transaction without aborting (no 25P02)', async () => {
    // Characterization for the ON CONFLICT DO NOTHING path: the second
    // create for the same key must return the same row as deduped and leave
    // the transaction usable — the follow-up SIM consume must still confirm.
    // (Catching a 23505 inside the open transaction would abort it and every
    // later statement would fail with 25P02.)
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T23:30:00Z');
    const first = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(first.deduped).toBe(false);

    const second = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(second).toMatchObject({ id: first.id, deduped: true });
    // The deduped intent carries the same schedule snapshot (not just the id).
    expect(new Date(second.appointmentScheduledAt).toISOString()).toBe('2030-06-10T23:30:00.000Z');
    expect((await requestState(first.id)).status).toBe('pending');

    const confirmed = await processTrustedConfirmation(trusted(SENDER_A, conv, 'SIM', 'evt-dedupe-1'));
    expect(confirmed).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt });
    expect(await appointmentStatus(appt)).toBe('confirmed');
  });

  it('expired pending → no change, request marked expired', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T20:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2000-01-01T00:00:00Z'),
    });

    const result = await processTrustedConfirmation(trusted(SENDER_A, conv, 'SIM', 'evt-exp-1'));

    expect(result.processed).toBe(false);
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('pending on an already-final appointment → no appointment mutation', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    // The helper correctly rejects creating NEW requests for cancelled
    // appointments, so the pending is created while `scheduled` and the
    // appointment is finalized (cancelled) before the SIM is processed.
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T21:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await pool.query(
      `UPDATE appointments SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [appt],
    );

    const result = await processTrustedConfirmation(trusted(SENDER_A, conv, 'SIM', 'evt-final-1'));

    expect(result.processed).toBe(false);
    expect(result.reason).toBe('already_final');
    expect(await appointmentStatus(appt)).toBe('cancelled');
    expect((await requestState(req.id)).status).toBe('consumed');
  });

  it('createConfirmationRequest rejects new requests for non-scheduled appointments', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-10T21:30:00Z', 'cancelled');
    await expect(createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    })).rejects.toThrow(/not scheduled/);
    expect(await appointmentStatus(appt)).toBe('cancelled');
  });

  it('full path: persistInboundMessage → dispatchInboundMessageJob → confirmed', async () => {
    const phone = uniquePhone(SENDER_A);
    const wlPatientId = await makePatient(CLINIC_A, phone, 'E2E Patient');
    // Production order: the conversation and the pending prompt exist
    // BEFORE the inbound reply arrives, so the persisted event time is
    // after the pending's creation (stale-replay guard passes).
    const { rows: [convRow] } = await pool.query(
      `INSERT INTO conversations (clinic_id, channel, external_id, status)
       VALUES ($1, 'whatsapp', $2, 'active') RETURNING id`,
      [CLINIC_A, phone],
    );
    const appt = await makeAppointment(CLINIC_A, wlPatientId, DENTIST_A2, '2030-06-11T10:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: convRow.id,
      senderPhone: phone, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const stored = await persistInboundMessage({
      clinicId: CLINIC_A,
      channel: 'whatsapp',
      externalConversationId: phone,
      externalProvider: 'waha',
      externalMessageId: 'evt-e2e-1',
      content: 'SIM',
      messageType: 'text',
      // Production order: the provider event is newer than the pending
      // prompt, so the stale-replay guard passes on provider time.
      // At least +2s after intent creation: the guard fails closed on
      // same-second ties (unverifiable ordering never consumes), so a
      // bare `new Date()` here races the just-created pending.
      eventTimestamp: new Date(Date.now() + 2000).toISOString(),
      metadata: {},
    });
    expect(stored.deduped).toBe(false);
    if (stored.deduped || !stored.receivedAt) throw new Error('unreachable');
    expect(stored.conversationId).toBe(convRow.id);
    // The dispatcher consumes the persisted event time from the outbox job;
    // the inline payload below mirrors it (persisted before the pending).
    const persistedAt = stored.receivedAt.toISOString();

    await dispatchInboundMessageJob({
      id: 'job-e2e-1',
      payload: {
        clinicId: CLINIC_A,
        conversationId: stored.conversationId,
        channel: 'whatsapp',
        externalConversationId: phone,
        externalProvider: 'waha',
        externalMessageId: 'evt-e2e-1',
        content: 'SIM',
        messageType: 'text',
        messageKind: 'text',
        receivedAt: persistedAt,
        metadata: {},
      },
    } as any);

    expect(await appointmentStatus(appt)).toBe('confirmed');

    // Same event redispatched → still exactly one effect.
    await dispatchInboundMessageJob({
      id: 'job-e2e-1',
      payload: {
        clinicId: CLINIC_A,
        conversationId: stored.conversationId,
        channel: 'whatsapp',
        externalConversationId: phone,
        externalProvider: 'waha',
        externalMessageId: 'evt-e2e-1',
        content: 'SIM',
        messageType: 'text',
        messageKind: 'text',
        receivedAt: persistedAt,
        metadata: {},
      },
    } as any);
    expect(await appointmentStatus(appt)).toBe('confirmed');
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM appointment_confirmation_requests
       WHERE clinic_id = $1 AND consumed_by_event = 'evt-e2e-1'`,
      [CLINIC_A],
    );
    expect(rows[0].n).toBe(1);
  });

  it('Action path: persisted WAHA event confirms via DB-derived values only', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-11T11:00:00Z');
    // Production order: the pending prompt predates the inbound event, so
    // the persisted event time is after the pending's creation.
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await seedAuthenticInbound(conv, 'SIM', 'waha:action:evt-ok-1', { provider: 'waha' });

    const result = await runAction(
      processarConfirmacaoResposta,
      { conversationId: conv, eventId: 'waha:action:evt-ok-1' },
      makeCtx() as any,
    );

    expect(result.ok).toBe(true);
    expect((result as any).data?.processed ?? (result as any).value?.processed).not.toBe(false);
    expect(await appointmentStatus(appt)).toBe('confirmed');
  });

  it('Action path: fabricated event id never mutates', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-11T12:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    const result = await runAction(
      processarConfirmacaoResposta,
      { conversationId: conv, eventId: 'waha:action:evt-fabricated-1' },
      makeCtx() as any,
    );

    expect(result.ok).toBe(true);
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('Action path: event in the wrong conversation never mutates', async () => {
    const convA = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-11T13:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: convA,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await seedAuthenticInbound(convA, 'SIM', 'waha:action:evt-wrongconv-1', { provider: 'waha' });
    const convB = await makeConversation(CLINIC_A, uniquePhone(SENDER_A));

    const result = await runAction(
      processarConfirmacaoResposta,
      { conversationId: convB, eventId: 'waha:action:evt-wrongconv-1' },
      makeCtx() as any,
    );

    expect(result.ok).toBe(true);
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('Action path: non-inbound and out-of-allowlist provider rows never mutate', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-11T14:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await seedAuthenticInbound(conv, 'SIM', 'waha:action:evt-outbound-1', { provider: 'waha', direction: 'outbound' });
    await seedAuthenticInbound(conv, 'SIM', 'evolution:evt-legacy-1', { provider: 'evolution' });

    for (const eventId of ['waha:action:evt-outbound-1', 'evolution:evt-legacy-1']) {
      const result = await runAction(
        processarConfirmacaoResposta,
        { conversationId: conv, eventId },
        makeCtx() as any,
      );
      expect(result.ok).toBe(true);
    }
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('Action path: caller-supplied message/sender/appointment ids are rejected by strict input', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    expect(processarConfirmacaoResposta.input.safeParse({
      conversationId: conv, eventId: 'waha:action:evt-ok-1', message: 'sim',
    }).success).toBe(false);
    expect(processarConfirmacaoResposta.input.safeParse({
      conversationId: conv, eventId: 'waha:action:evt-ok-1', senderPhone: SENDER_A,
    }).success).toBe(false);
    expect(processarConfirmacaoResposta.input.safeParse({
      conversationId: conv, eventId: 'waha:action:evt-ok-1', appointmentId: conv,
    }).success).toBe(false);
    expect(processarConfirmacaoResposta.input.safeParse({
      conversationId: conv, eventId: 'waha:action:evt-ok-1', content: 'sim',
    }).success).toBe(false);
  });

  it('Action path: stale pre-pending SIM event never confirms a future request', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    // Authentic event persisted first (old SIM), then the pending request
    // is created afterwards: the event predates the intent and must not
    // confirm it. The provider clock (not the insert time) is authoritative.
    await seedAuthenticInbound(conv, 'SIM', 'waha:action:evt-stale-1', {
      provider: 'waha',
      createdAt: '2026-01-01T00:00:00Z',
      eventTimestamp: '2026-01-01T00:00:00Z',
    });
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-11T15:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    const result = await runAction(
      processarConfirmacaoResposta,
      { conversationId: conv, eventId: 'waha:action:evt-stale-1' },
      makeCtx() as any,
    );

    expect(result.ok).toBe(true);
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('Action path: delayed SIM stored after a new pending never confirms (provider clock, not insert time)', async () => {
    // Regression core: the row is persisted NOW (fresh createdAt) but the
    // provider message is OLD. Trusting the insert time would confirm a
    // stale SIM against a newer pending — the provider clock must win.
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-11T15:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await seedAuthenticInbound(conv, 'SIM', 'waha:action:evt-delayed-old-1', {
      provider: 'waha',
      eventTimestamp: '2020-05-01T12:00:00Z',
    });

    const result = await runAction(
      processarConfirmacaoResposta,
      { conversationId: conv, eventId: 'waha:action:evt-delayed-old-1' },
      makeCtx() as any,
    );

    expect(result.ok).toBe(true);
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('Action path: fresh provider event with an old insert time still confirms', async () => {
    // Mirror image: persistence time must not veto a genuinely fresh event.
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-11T15:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await seedAuthenticInbound(conv, 'SIM', 'waha:action:evt-fresh-oldrow-1', {
      provider: 'waha',
      createdAt: '2020-01-01T00:00:00Z',
    });

    const result = await runAction(
      processarConfirmacaoResposta,
      { conversationId: conv, eventId: 'waha:action:evt-fresh-oldrow-1' },
      makeCtx() as any,
    );

    expect(result.ok).toBe(true);
    expect(await appointmentStatus(appt)).toBe('confirmed');
  });

  it('Action path: missing provider timestamp persists but never confirms (fail closed)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-11T15:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    // No authenticatedEventAt marker at all: the row persists, but no
    // mutation may follow. There is intentionally no fallback to the
    // insert timestamp.
    await seedAuthenticInbound(conv, 'SIM', 'waha:action:evt-no-ts-1', {
      provider: 'waha',
      eventTimestamp: null,
    });

    const result = await runAction(
      processarConfirmacaoResposta,
      { conversationId: conv, eventId: 'waha:action:evt-no-ts-1' },
      makeCtx() as any,
    );

    expect(result.ok).toBe(true);
    const data = (result as any).data ?? (result as any).value;
    expect(data).toMatchObject({ processed: false, reason: 'missing_event_time' });
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('Action path: patient/sender mismatch never mutates (recipient guard)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-11T16:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await seedAuthenticInbound(conv, 'SIM', 'waha:action:evt-mismatch-1', { provider: 'waha' });
    // Patient phone changes after the request: the trusted sender no
    // longer equals the appointment patient — consume must fail closed.
    await pool.query(`UPDATE patients SET phone = $1 WHERE id = $2`, ['+5511999999999', PATIENT_A]);
    try {
      const result = await runAction(
        processarConfirmacaoResposta,
        { conversationId: conv, eventId: 'waha:action:evt-mismatch-1' },
        makeCtx() as any,
      );
      expect(result.ok).toBe(true);
      expect(await appointmentStatus(appt)).toBe('scheduled');
    } finally {
      await pool.query(`UPDATE patients SET phone = $1 WHERE id = $2`, [`+${SENDER_A}`, PATIENT_A]);
    }
  });

  it('createConfirmationRequest rejects sender/patient mismatch at creation', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-11T18:00:00Z');
    await expect(createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SIMILAR_SENDER, expiresAt: new Date('2030-06-09T10:00:00Z'),
    })).rejects.toThrow();
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('Action path: duplicate event replays without a second mutation', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-11T17:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await seedAuthenticInbound(conv, 'SIM', 'waha:action:evt-dup-1', { provider: 'waha' });
    const input = { conversationId: conv, eventId: 'waha:action:evt-dup-1' };

    const first = await runAction(processarConfirmacaoResposta, input, makeCtx() as any);
    const second = await runAction(processarConfirmacaoResposta, input, makeCtx() as any);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM appointment_confirmation_requests
       WHERE clinic_id = $1 AND consumed_by_event = 'waha:action:evt-dup-1'`,
      [CLINIC_A],
    );
    expect(rows[0].n).toBe(1);
    expect(await appointmentStatus(appt)).toBe('confirmed');
  });

  it('waitlist: exact SIM + single notified entry → escalates concrete_offer_required, no appointment', async () => {
    const phone = uniquePhone(SENDER_A);
    await pool.query(`DELETE FROM patients WHERE phone = $1 AND clinic_id = $2`, [`+${phone}`, CLINIC_A]);
    const { rows: [wlPatient] } = await pool.query(
      `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, 'WL Patient', $2, 'wl@t.local') RETURNING id`,
      [CLINIC_A, `+${phone}`],
    );
    const conv = await makeConversation(CLINIC_A, phone);
    const { rows: [entry] } = await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00') RETURNING id`,
      [CLINIC_A, wlPatient.id],
    );

    const ok = await processTrustedWaitlistResponse(trusted(phone, conv, 'SIM', 'evt-wl-1'));
    // Scheduling DISABLED: preferences alone never book. Human escalation
    // with a concrete offer; zero writes.
    expect(ok).toMatchObject({ processed: false, reason: 'concrete_offer_required' });
    const { rows: st } = await pool.query(`SELECT status, scheduled_appointment_id FROM waitlist WHERE id = $1`, [entry.id]);
    expect(st[0].status).toBe('notified');
    expect(st[0].scheduled_appointment_id).toBeNull();

    // Fuzzy text creates nothing.
    const before = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    const fuzzy = await processTrustedWaitlistResponse(trusted(phone, conv, 'ok', 'evt-wl-2'));
    expect(fuzzy.processed).toBe(false);
    const after = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    expect(after.rows[0].n).toBe(before.rows[0].n);

    await pool.query(`DELETE FROM patients WHERE id = $1`, [wlPatient.id]);
  });

  it('waitlist: notified entries never book (concrete_offer_required)', async () => {
    const phone = uniquePhone(SENDER_A);
    const { rows: [wlPatient] } = await pool.query(
      `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, 'WL Amb', $2, 'wla@t.local') RETURNING id`,
      [CLINIC_A, `+${phone}`],
    );
    const conv = await makeConversation(CLINIC_A, phone);
    await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00'),
              ($1, $2, 'notified', NOW(), '2030-07-02T00:00:00Z', '10:00')`,
      [CLINIC_A, wlPatient.id],
    );
    const before = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);

    const result = await processTrustedWaitlistResponse(trusted(phone, conv, 'sim', 'evt-wl-amb-1'));

    expect(result.processed).toBe(false);
    expect(result.reason).toBe('concrete_offer_required');
    const after = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    expect(after.rows[0].n).toBe(before.rows[0].n);

    await pool.query(`DELETE FROM patients WHERE id = $1`, [wlPatient.id]);
  });

  it('waitlist: missing preferred time never books (concrete_offer_required)', async () => {
    const phone = uniquePhone(SENDER_A);
    await pool.query(`DELETE FROM patients WHERE phone = $1 AND clinic_id = $2`, [`+${phone}`, CLINIC_A]);
    const { rows: [wlPatient] } = await pool.query(
      `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, 'WL No Time', $2, 'wlnt@t.local') RETURNING id`,
      [CLINIC_A, `+${phone}`],
    );
    const conv = await makeConversation(CLINIC_A, phone);
    const { rows: [entry] } = await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', NULL) RETURNING id`,
      [CLINIC_A, wlPatient.id],
    );
    const before = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);

    const res = await processTrustedWaitlistResponse(trusted(phone, conv, 'SIM', 'evt-wl-no-time-1'));
    expect(res).toMatchObject({ processed: false, reason: 'concrete_offer_required' });

    const after = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
    const { rows: st } = await pool.query(`SELECT status, scheduled_appointment_id FROM waitlist WHERE id = $1`, [entry.id]);
    expect(st[0].status).toBe('notified');
    expect(st[0].scheduled_appointment_id).toBeNull();

    await pool.query(`DELETE FROM patients WHERE id = $1`, [wlPatient.id]);
  });

  it('waitlist: missing preferred date never books (concrete_offer_required)', async () => {
    const phone = uniquePhone(SENDER_A);
    await pool.query(`DELETE FROM patients WHERE phone = $1 AND clinic_id = $2`, [`+${phone}`, CLINIC_A]);
    const { rows: [wlPatient] } = await pool.query(
      `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, 'WL No Date', $2, 'wlnd@t.local') RETURNING id`,
      [CLINIC_A, `+${phone}`],
    );
    const conv = await makeConversation(CLINIC_A, phone);
    const { rows: [entry] } = await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), NULL, '09:00') RETURNING id`,
      [CLINIC_A, wlPatient.id],
    );

    const res = await processTrustedWaitlistResponse(trusted(phone, conv, 'SIM', 'evt-wl-no-date-1'));
    expect(res).toMatchObject({ processed: false, reason: 'concrete_offer_required' });

    const { rows: st } = await pool.query(`SELECT status, scheduled_appointment_id FROM waitlist WHERE id = $1`, [entry.id]);
    expect(st[0].status).toBe('notified');
    expect(st[0].scheduled_appointment_id).toBeNull();

    await pool.query(`DELETE FROM patients WHERE id = $1`, [wlPatient.id]);
  });

  it('waitlist: PG HH:mm:ss preference never books (concrete_offer_required)', async () => {
    const phone = uniquePhone(SENDER_A);
    await pool.query(`DELETE FROM patients WHERE phone = $1 AND clinic_id = $2`, [`+${phone}`, CLINIC_A]);
    const { rows: [wlPatient] } = await pool.query(
      `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, 'WL Exact', $2, 'wle@t.local') RETURNING id`,
      [CLINIC_A, `+${phone}`],
    );
    const conv = await makeConversation(CLINIC_A, phone);
    // Postgres returns `time` columns as zero-padded `HH:mm:ss`. This must
    // parse as-is — never with another `:00` appended.
    await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00:00') RETURNING id`,
      [CLINIC_A, wlPatient.id],
    );

    const beforeExact = await pool.query('SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1', [CLINIC_A]);
    const res = await processTrustedWaitlistResponse(trusted(phone, conv, 'SIM', 'evt-wl-exact-1'));
    expect(res).toMatchObject({ processed: false, reason: 'concrete_offer_required' });

    // Scheduling is DISABLED: a notified waitlist entry holds preferences
    // only (even an exact PG `HH:mm:ss` time), never a concrete slot — so a
    // SIM books nothing. Zero appointment rows for this patient, clinic
    // totals unchanged, waitlist row untouched.
    const { rows } = await pool.query(
      `SELECT a.id, a.scheduled_at FROM appointments a WHERE a.clinic_id = $1 AND a.patient_id = $2`,
      [CLINIC_A, wlPatient.id],
    );
    expect(rows.length).toBe(0);
    const afterExact = await pool.query('SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1', [CLINIC_A]);
    expect(afterExact.rows[0].n).toBe(beforeExact.rows[0].n);
    const { rows: st } = await pool.query(
      `SELECT status, scheduled_appointment_id FROM waitlist WHERE clinic_id = $1 AND patient_id = $2`,
      [CLINIC_A, wlPatient.id],
    );
    expect(st.length).toBe(1);
    expect(st[0].status).toBe('notified');
    expect(st[0].scheduled_appointment_id).toBeNull();

    await pool.query(`DELETE FROM patients WHERE id = $1`, [wlPatient.id]);
  });

  it('waitlist: fractional PG time preference never books (concrete_offer_required)', async () => {
    const phone = uniquePhone(SENDER_A);
    await pool.query(`DELETE FROM patients WHERE phone = $1 AND clinic_id = $2`, [`+${phone}`, CLINIC_A]);
    const { rows: [wlPatient] } = await pool.query(
      `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, 'WL Frac', $2, 'wlf@t.local') RETURNING id`,
      [CLINIC_A, `+${phone}`],
    );
    const conv = await makeConversation(CLINIC_A, phone);
    await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00:00.500') RETURNING id`,
      [CLINIC_A, wlPatient.id],
    );

    const beforeFrac = await pool.query('SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1', [CLINIC_A]);
    const res = await processTrustedWaitlistResponse({ ...trusted(phone, conv, 'SIM', 'evt-wl-frac-1') });
    expect(res).toMatchObject({ processed: false, reason: 'concrete_offer_required' });
    const { rows: afterFrac } = await pool.query('SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1', [CLINIC_A]);
    expect(afterFrac[0].n).toBe(beforeFrac.rows[0].n);

    await pool.query(`DELETE FROM patients WHERE id = $1`, [wlPatient.id]);
  });
});

describeOrSkip('resolver replay-first + provider/pending/button guards (DB-backed)', () => {
  it('same-event confirmation replay after commit still returns original when a waitlist candidate appears later', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-14T10:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    const first = await resolveInboundReply({ ...trusted(SENDER_A, conv, 'SIM', 'evt-replay-guard-1') });
    expect(first.kind).toBe('confirmed');

    // A waitlist offer arriving AFTER the commit must not hijack the replay:
    // same event replays the stored confirmation, no second scheduling.
    const { rows: [wl] } = await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00') RETURNING id`,
      [CLINIC_A, PATIENT_A],
    );
    const replay = await resolveInboundReply({ ...trusted(SENDER_A, conv, 'SIM', 'evt-replay-guard-1') });
    expect(replay.kind).toBe('confirmed');
    expect((replay as any).appointmentId).toBe(appt);
    expect(await appointmentStatus(appt)).toBe('confirmed');
    const { rows: st } = await pool.query(`SELECT status, scheduled_appointment_id FROM waitlist WHERE id = $1`, [wl.id]);
    expect(st[0].status).toBe('notified');
    expect(st[0].scheduled_appointment_id).toBeNull();
  });

  it('waitlist same-event replay never schedules: resolver escalates concrete_offer_required twice', async () => {
    const phone = uniquePhone(SENDER_A);
    const { rows: [wlPatient] } = await pool.query(
      `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, 'WL Replay', $2, 'wlr@t.local') RETURNING id`,
      [CLINIC_A, `+${phone}`],
    );
    const conv = await makeConversation(CLINIC_A, phone);
    const { rows: [entry] } = await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00') RETURNING id`,
      [CLINIC_A, wlPatient.id],
    );

    const before = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    const first = await resolveInboundReply({ ...trusted(phone, conv, 'SIM', 'evt-wl-replay-1') });
    expect(first).toMatchObject({ kind: 'escalate', reason: 'concrete_offer_required' });

    // A second notified row for the same patient appears afterwards; the same
    // event must still escalate — never book.
    await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-02T00:00:00Z', '10:00')`,
      [CLINIC_A, wlPatient.id],
    );
    const replay = await resolveInboundReply({ ...trusted(phone, conv, 'SIM', 'evt-wl-replay-1') });
    expect(replay).toMatchObject({ kind: 'escalate', reason: 'concrete_offer_required' });
    const after = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    expect(after.rows[0].n).toBe(before.rows[0].n);

    // Deprecated anchor seam is absent-by-design since scheduling was disabled.
    const reconciled = await reconcileWaitlistByEvent({
      clinicId: CLINIC_A, conversationId: conv, senderPhone: phone,
      externalProvider: 'waha', externalMessageId: 'evt-wl-replay-1',
    });
    expect(reconciled.found).toBe(false);
    const { rows: st } = await pool.query(`SELECT status FROM waitlist WHERE id = $1`, [entry.id]);
    expect(st[0].status).toBe('notified');

    await pool.query(`DELETE FROM patients WHERE id = $1`, [wlPatient.id]);
  });

  it('button SIM (allowWaitlist:false) never schedules a waitlist offer; escalates instead', async () => {
    const phone = uniquePhone(SENDER_A);
    const { rows: [wlPatient] } = await pool.query(
      `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, 'WL Button', $2, 'wlb@t.local') RETURNING id`,
      [CLINIC_A, `+${phone}`],
    );
    const conv = await makeConversation(CLINIC_A, phone);
    await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00')`,
      [CLINIC_A, wlPatient.id],
    );
    const before = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);

    const decision = await resolveInboundReply({ ...trusted(phone, conv, 'SIM', 'evt-btn-wl-1') }, { allowWaitlist: false });

    expect(decision.kind).toBe('escalate');
    const after = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    expect(after.rows[0].n).toBe(before.rows[0].n);

    await pool.query(`DELETE FROM patients WHERE id = $1`, [wlPatient.id]);
  });

  it('reply-like "impossível comparecer" with a pending escalates without mutation', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-14T11:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    for (const text of ['impossível comparecer', 'não consigo', 'não poderei']) {
      const decision = await resolveInboundReply({ ...trusted(SENDER_A, conv, text, `evt-neg-${text.length}-1`) });
      expect(decision.kind).toBe('escalate');
    }
    expect(await appointmentStatus(appt)).toBe('scheduled');
    expect((await requestState(req.id)).status).toBe('pending');
  });

  it('unauthenticated (evolution) SIM never mutates; escalates instead', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-14T12:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    const decision = await resolveInboundReply({
      clinicId: CLINIC_A, conversationId: conv, senderPhone: SENDER_A,
      content: 'SIM', externalProvider: 'evolution', externalMessageId: 'evt-leg-1',
      messageType: 'text',
    });
    expect(decision.kind).toBe('escalate');
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('direct Evolution invocation of the exported mutations cannot mutate (fail-closed provider guard)', async () => {
    // The resolver gates provider, but the mutation functions are public —
    // a direct caller bypassing the resolver must still fail closed with
    // zero writes, for both confirmation consume and waitlist scheduling.
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-14T15:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    const directConfirm = await processTrustedConfirmation({
      clinicId: CLINIC_A, conversationId: conv, senderPhone: SENDER_A,
      content: 'SIM', externalProvider: 'evolution', externalMessageId: 'evt-direct-evo-1',
      messageType: 'text',
    });
    expect(directConfirm).toMatchObject({ processed: false, reason: 'unauthenticated_provider' });
    expect(await appointmentStatus(appt)).toBe('scheduled');
    expect((await requestState(req.id)).status).toBe('pending');

    const phone = uniquePhone(SENDER_A);
    const { rows: [wlPatient] } = await pool.query(
      `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, 'WL Direct Evo', $2, 'wle@t.local') RETURNING id`,
      [CLINIC_A, `+${phone}`],
    );
    const wlConv = await makeConversation(CLINIC_A, phone);
    await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00')`,
      [CLINIC_A, wlPatient.id],
    );
    const before = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);

    const directWl = await processTrustedWaitlistResponse({
      clinicId: CLINIC_A, conversationId: wlConv, senderPhone: phone,
      content: 'SIM', externalProvider: 'evolution', externalMessageId: 'evt-direct-evo-wl-1',
      messageType: 'text',
    });
    expect(directWl).toMatchObject({ processed: false, reason: 'unauthenticated_provider' });
    const after = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
    const { rows: st } = await pool.query(
      `SELECT status, scheduled_appointment_id FROM waitlist WHERE clinic_id = $1 AND patient_id = $2`,
      [CLINIC_A, wlPatient.id],
    );
    expect(st.length).toBe(1);
    expect(st[0].status).toBe('notified');
    expect(st[0].scheduled_appointment_id).toBeNull();

    await pool.query(`DELETE FROM patients WHERE id = $1`, [wlPatient.id]);
  });

  it('concurrent pending creation vs processing serializes without double consume (barrier, no sleeps)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt1 = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-14T13:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt1, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    // Barrier: hold the clinic advisory lock on a dedicated connection while
    // the consume path starts on the pool — it must wait for the lock (READ
    // COMMITTED) and then produce exactly one effect after COMMIT. No sleeps.
    const holder = new Pool({ connectionString: process.env.DATABASE_URL! });
    try {
      await holder.query('BEGIN');
      await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended('synkroo:whatsapp-reply:' || $1::text, 0))`, [CLINIC_A]);
      const consumePromise = processTrustedConfirmation({ ...trusted(SENDER_A, conv, 'SIM', 'evt-conc-1') });
      await holder.query('COMMIT');
      const consumed = await consumePromise;
      expect(consumed).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt1 });
      expect(await appointmentStatus(appt1)).toBe('confirmed');
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM appointment_confirmation_requests
         WHERE clinic_id = $1 AND consumed_by_event = 'evt-conc-1'`,
        [CLINIC_A],
      );
      expect(rows[0].n).toBe(1);
    } finally {
      await holder.end().catch(() => undefined);
    }
  });
});

describeOrSkip('stale events, media types, and notify races (DB-backed)', () => {
  it('stale inbound job (event persisted before pending) dispatched after pending → escalated, no mutation', async () => {
    const phone = uniquePhone(SENDER_A);
    const patientId = await makePatient(CLINIC_A, phone, 'Stale Job Patient');
    // Event persisted first with an OLD provider timestamp (T0)...
    const stored = await persistInboundMessage({
      clinicId: CLINIC_A,
      channel: 'whatsapp',
      externalConversationId: phone,
      externalProvider: 'waha',
      externalMessageId: 'evt-stale-job-1',
      content: 'SIM',
      messageType: 'text',
      eventTimestamp: '2026-01-01T00:00:00Z',
      metadata: {},
    });
    expect(stored.deduped).toBe(false);
    if (stored.deduped || !stored.receivedAt) throw new Error('unreachable');
    // ...pending created afterwards (T1 > T0): the old SIM replays against
    // a future confirmation and must stay a no-op.
    const appt = await makeAppointment(CLINIC_A, patientId, DENTIST_A1, '2030-06-15T10:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: stored.conversationId,
      senderPhone: phone, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    await dispatchInboundMessageJob({
      id: 'job-stale-1',
      payload: {
        clinicId: CLINIC_A,
        conversationId: stored.conversationId,
        channel: 'whatsapp',
        externalConversationId: phone,
        externalProvider: 'waha',
        externalMessageId: 'evt-stale-job-1',
        content: 'SIM',
        messageType: 'text',
        messageKind: 'text',
        receivedAt: stored.receivedAt.toISOString(),
        metadata: {},
      },
    } as any);

    expect(await appointmentStatus(appt)).toBe('scheduled');
    expect((await requestState(req.id)).status).toBe('pending');
    expect(await conversationStatus(stored.conversationId)).toBe('escalated');
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it('dispatcher job without event time → escalated, no mutation', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-15T11:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    // Legacy job without persisted event time: fail closed, never mutate.
    const job = dispatchJob(conv, SENDER_A, 'SIM', 'evt-no-time-1');
    delete (job.payload as any).receivedAt;

    await dispatchInboundMessageJob(job);

    expect(await appointmentStatus(appt)).toBe('scheduled');
    expect((await requestState(req.id)).status).toBe('pending');
    expect(await conversationStatus(conv)).toBe('escalated');
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it('image caption exactly SIM never confirms; escalates without mutation', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-15T12:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    const decision = await resolveInboundReply({ ...trusted(SENDER_A, conv, 'SIM', 'evt-img-1'), messageType: 'image' });
    expect(decision.kind).toBe('escalate');
    expect((decision as { reason?: string }).reason).toBe('unsupported_message_type');
    expect(await appointmentStatus(appt)).toBe('scheduled');
    expect((await requestState(req.id)).status).toBe('pending');

    // Direct waitlist consume with a media type is rejected too.
    const direct = await processTrustedWaitlistResponse({ ...trusted(SENDER_A, conv, 'SIM', 'evt-img-2'), messageType: 'document' });
    expect(direct).toMatchObject({ processed: false, reason: 'unsupported_message_type' });
    expect(await appointmentStatus(appt)).toBe('scheduled');
  });

  it('button-kind content via the text channel escalates (never confirms)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-15T13:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    // A button tap misrouted through the text channel (allowWaitlist on)
    // must not confirm — only the button channel may consume it.
    const decision = await resolveInboundReply({ ...trusted(SENDER_A, conv, 'SIM', 'evt-btnchan-1'), messageKind: 'button' });
    expect(decision.kind).toBe('escalate');
    expect(await appointmentStatus(appt)).toBe('scheduled');
    expect((await requestState(req.id)).status).toBe('pending');

    // Direct waitlist scheduling from a button tap is rejected outright.
    const direct = await processTrustedWaitlistResponse({ ...trusted(SENDER_A, conv, 'SIM', 'evt-btnchan-2'), messageKind: 'button' });
    expect(direct).toMatchObject({ processed: false, reason: 'unsupported_message_type' });
  });

  it('create-vs-consume race serializes: second intent never overlaps, one consume effect (barrier, no sleeps)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt1 = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-16T10:00:00Z');
    const appt2 = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A2, '2030-06-16T11:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt1, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    // Barrier: both writers block on the same clinic advisory lock held by
    // this connection. After COMMIT they serialize in lock order — and the
    // single-intent invariant holds either way:
    // - consume wins first → appt1 confirmed, then the appt2 create fails
    //   on the prompt-window invariant (the consumed prompt keeps its
    //   original valid window open — handoff, no overlap);
    // - create wins first → it fails explicitly (appt1 pending), then the
    //   consume confirms appt1.
    // Either way: appt1 confirmed exactly once, appt2 never confirmed by
    // this event, at most one confirmed-consume record.
    const holder = new Pool({ connectionString: process.env.DATABASE_URL! });
    try {
      await holder.query('BEGIN');
      await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended('synkroo:whatsapp-reply:' || $1::text, 0))`, [CLINIC_A]);
      const consumeP = processTrustedConfirmation({ ...trusted(SENDER_A, conv, 'SIM', 'evt-race-create-1') });
      const createP = createConfirmationRequest({
        clinicId: CLINIC_A, appointmentId: appt2, conversationId: conv,
        senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
      }).then(
        (v) => ({ ok: true as const, value: v }),
        (e: unknown) => ({ ok: false as const, error: e }),
      );
      await holder.query('COMMIT');
      const [consumeRes, createRes] = await Promise.all([consumeP, createP]);
      expect(consumeRes).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt1 });
      if (!createRes.ok) {
        expect((createRes.error as Error).message).toMatch(/another conversation|valid window/);
      } else {
        expect(createRes.value.deduped).toBe(false);
      }
      expect(await appointmentStatus(appt1)).toBe('confirmed');
      expect(await appointmentStatus(appt2)).toBe('scheduled');
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM appointment_confirmation_requests
         WHERE clinic_id = $1 AND conversation_id = $2 AND status = 'consumed' AND outcome = 'confirmed'`,
        [CLINIC_A, conv],
      );
      expect(rows[0].n).toBeLessThanOrEqual(1);
    } finally {
      await holder.end().catch(() => undefined);
    }
  });

  it('notify-vs-consume race serializes via the shared clinic lock (barrier, no sleeps)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-16T12:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const { rows: [wl] } = await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'waiting', '2030-07-01T00:00:00Z', '09:00') RETURNING id`,
      [CLINIC_A, PATIENT_A],
    );
    // Barrier: the repository notify writer and the SIM consume race on
    // two separate connections under the same clinic advisory lock.
    // - notify wins → the offer is notified before consume's intent read →
    //   SIM escalates on coexistence, appointment untouched;
    // - consume wins → appointment confirmed, notify applies afterwards.
    // Both are safe: no double booking, no lost intent.
    const holder = new Pool({ connectionString: process.env.DATABASE_URL! });
    try {
      await holder.query('BEGIN');
      await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended('synkroo:whatsapp-reply:' || $1::text, 0))`, [CLINIC_A]);
      const notifyP = markNotified(wl.id);
      const consumeP = resolveInboundReply({ ...trusted(SENDER_A, conv, 'SIM', 'evt-race-notify-1') });
      await holder.query('COMMIT');
      const [, decision] = await Promise.all([notifyP, consumeP]);
      expect(['confirmed', 'escalate']).toContain(decision.kind);
      if (decision.kind === 'confirmed') {
        expect(await appointmentStatus(appt)).toBe('confirmed');
      } else {
        expect(await appointmentStatus(appt)).toBe('scheduled');
      }
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1 AND patient_id = $2 AND status = 'confirmed'`,
        [CLINIC_A, PATIENT_A],
      );
      expect(rows[0].n).toBeLessThanOrEqual(1);
    } finally {
      await holder.end().catch(() => undefined);
    }
  });
});

describeOrSkip('cross-intent event anchors (DB-backed)', () => {
  // Waitlist scheduling is DISABLED: the same event can never consume a
  // waitlist intent. The in-transaction confirmation anchor still fails
  // closed for an already-consumed confirmation event, and direct waitlist
  // calls fail closed with `concrete_offer_required` (zero writes).
  it('event consumed as confirmation cannot later book a waitlist intent', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-17T11:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const confirmRes = await processTrustedConfirmation({ ...trusted(SENDER_A, conv, 'SIM', 'evt-xanchor-2') });
    expect(confirmRes).toMatchObject({ processed: true, action: 'confirmed' });
    const before = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    const wlRes = await processTrustedWaitlistResponse({ ...trusted(SENDER_A, conv, 'SIM', 'evt-xanchor-2') });
    expect(wlRes).toMatchObject({ processed: false, reason: 'concrete_offer_required' });
    const after = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
  it('same waitlist event never schedules, even on replay', async () => {
    const phone = uniquePhone(SENDER_A);
    const wlPatientId = await makePatient(CLINIC_A, phone, 'XAnchor WL Replay');
    const conv = await makeConversation(CLINIC_A, phone);
    await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00')`,
      [CLINIC_A, wlPatientId],
    );
    const before = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    const first = await processTrustedWaitlistResponse({ ...trusted(phone, conv, 'SIM', 'evt-xanchor-3') });
    expect(first).toMatchObject({ processed: false, reason: 'concrete_offer_required' });
    const replay = await processTrustedWaitlistResponse({ ...trusted(phone, conv, 'SIM', 'evt-xanchor-3') });
    expect(replay).toMatchObject({ processed: false, reason: 'concrete_offer_required' });
    const after = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
    await pool.query(`DELETE FROM patients WHERE id = $1`, [wlPatientId]);
  });
  it('resolver fast-path: confirmation replay wins over a later notified row, waitlist SIM escalates', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-17T10:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const first = await resolveInboundReply({ ...trusted(SENDER_A, conv, 'SIM', 'evt-xanchor-both-resolver-1') });
    expect(first.kind).toBe('confirmed');
    await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00')`,
      [CLINIC_A, PATIENT_A],
    );
    // Same event replays the stored confirmation (no new intent).
    const replay = await resolveInboundReply({ ...trusted(SENDER_A, conv, 'SIM', 'evt-xanchor-both-resolver-1') });
    expect(replay.kind).toBe('confirmed');
    // A fresh event whose sole context is the notified row escalates.
    const fresh = await resolveInboundReply({ ...trusted(SENDER_A, conv, 'SIM', 'evt-xanchor-both-resolver-2') });
    expect(fresh).toMatchObject({ kind: 'escalate', reason: 'concrete_offer_required' });
  });
});describeOrSkip('conflicting and invalid event anchors fail closed (DB-backed)', () => {
  // The `accepted_*` waitlist anchors were removed with the disabled
  // scheduling effect, so no waitlist anchor can conflict. The remaining
  // confirmation anchor still fails closed on duplicates/mismatches, and
  // the resolver queries both anchor types (confirmation + deprecated
  // waitlist stub) before any early return.
  it('confirmation anchor bound to another conversation never confirms here', async () => {
    const convA = await makeConversation(CLINIC_A, SENDER_A);
    const apptA = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-17T15:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: apptA, conversationId: convA,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const first = await processTrustedConfirmation({ ...trusted(SENDER_A, convA, 'SIM', 'evt-xanchor-conv-1') });
    expect(first).toMatchObject({ processed: true, action: 'confirmed' });
    // Prompt-window invariant: the consumed prompt keeps its original valid
    // window open, so expire it explicitly before seeding the second intent
    // (the anchor-mismatch assertion below is not about window overlap).
    await pool.query(`UPDATE appointment_confirmation_requests SET expires_at = '2000-01-01T00:00:00Z' WHERE clinic_id = $1 AND consumed_by_event = 'evt-xanchor-conv-1'`, [CLINIC_A]);
    // A distinct conversation row (unique external_id): the anchor mismatch
    // is on conversation binding, not on the phone.
    const convB = await makeConversation(CLINIC_A, uniquePhone(SENDER_A));
    const apptB = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-17T16:00:00Z');
    const reqB = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: apptB, conversationId: convB,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const res = await processTrustedConfirmation({ ...trusted(SENDER_A, convB, 'SIM', 'evt-xanchor-conv-1') });
    expect(res).toMatchObject({ processed: false, reason: 'already_final' });
    expect(await appointmentStatus(apptB)).toBe('scheduled');
    expect((await requestState(reqB.id)).status).toBe('pending');
  });
  it('resolver checks both anchors before returning a replay (no bypass)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-17T17:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const first = await resolveInboundReply({ ...trusted(SENDER_A, conv, 'SIM', 'evt-xanchor-both-fast-1') });
    expect(first.kind).toBe('confirmed');
    // A notified row arriving later cannot hijack the same-event replay.
    await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00')`,
      [CLINIC_A, PATIENT_A],
    );
    const replay = await resolveInboundReply({ ...trusted(SENDER_A, conv, 'SIM', 'evt-xanchor-both-fast-1') });
    expect(replay.kind).toBe('confirmed');
  });
});describeOrSkip('dispatcher handoff (DB-backed)', () => {
  it('SIM without pending via dispatcher → escalated, appointment unchanged, no agent', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-12T10:00:00Z');

    await dispatchInboundMessageJob(dispatchJob(conv, SENDER_A, 'SIM', 'evt-d-esc-1'));

    expect(await appointmentStatus(appt)).toBe('scheduled');
    expect(await conversationStatus(conv)).toBe('escalated');
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it('OK with pending via dispatcher → escalated without mutation, request stays pending', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-12T11:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    await dispatchInboundMessageJob(dispatchJob(conv, SENDER_A, 'OK', 'evt-d-ok-1'));

    expect(await appointmentStatus(appt)).toBe('scheduled');
    expect((await requestState(req.id)).status).toBe('pending');
    expect(await conversationStatus(conv)).toBe('escalated');
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it('NÃO VOU without pending via dispatcher → escalated, unchanged, no agent', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-12T12:00:00Z');

    await dispatchInboundMessageJob(dispatchJob(conv, SENDER_A, 'NÃO VOU', 'evt-d-nao-1'));

    expect(await appointmentStatus(appt)).toBe('scheduled');
    expect(await conversationStatus(conv)).toBe('escalated');
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it('confirmation pending + waitlist offer coexist via dispatcher → escalated, both unchanged', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-12T13:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const { rows: [entry] } = await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00') RETURNING id`,
      [CLINIC_A, PATIENT_A],
    );

    await dispatchInboundMessageJob(dispatchJob(conv, SENDER_A, 'SIM', 'evt-d-coex-1'));

    expect(await appointmentStatus(appt)).toBe('scheduled');
    const { rows: st } = await pool.query(`SELECT status FROM waitlist WHERE id = $1`, [entry.id]);
    expect(st[0].status).toBe('notified');
    expect(await conversationStatus(conv)).toBe('escalated');
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it('unambiguous SIM via dispatcher → confirmed, conversation stays active', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-12T14:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    await dispatchInboundMessageJob(dispatchJob(conv, SENDER_A, 'sim', 'evt-d-ok2-1'));

    expect(await appointmentStatus(appt)).toBe('confirmed');
    expect(await conversationStatus(conv)).not.toBe('escalated');
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it('confirmed send fails → job rejects with generic retryable error; retry reconciles via replay', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-06-12T15:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    // First attempt: the mutation commits, then the outbound send fails.
    // The job must reject so the outbox retries instead of silently
    // dropping the reply — with a generic message (no PII).
    mockSendWhatsAppMessage.mockResolvedValueOnce({ success: false, error: 'boom' });
    const job = dispatchJob(conv, SENDER_A, 'sim', 'evt-d-sendfail-1');
    const err = await dispatchInboundMessageJob(job).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('INBOUND_REPLY_SEND_FAILED');
    expect((err as Error).message).not.toContain(SENDER_A);
    expect((err as Error).message).not.toContain('sim');
    expect(await appointmentStatus(appt)).toBe('confirmed');

    // Retry: the replay returns the same stored outcome; still exactly one
    // consumption record, no duplicate mutation.
    await dispatchInboundMessageJob(job);
    expect(await appointmentStatus(appt)).toBe('confirmed');
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM appointment_confirmation_requests
       WHERE clinic_id = $1 AND consumed_by_event = 'evt-d-sendfail-1'`,
      [CLINIC_A],
    );
    expect(rows[0].n).toBe(1);
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it('waitlist SIM via dispatcher escalates concrete_offer_required, no appointment, no crash', async () => {
    const phone = uniquePhone(SENDER_A);
    const { rows: [wlPatient] } = await pool.query(
      `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, 'WL Dispatch', $2, 'wld@t.local') RETURNING id`,
      [CLINIC_A, `+${phone}`],
    );
    const conv = await makeConversation(CLINIC_A, phone);
    await pool.query(
      `INSERT INTO waitlist (clinic_id, patient_id, status, notified_at, preferred_date, preferred_time_start)
       VALUES ($1, $2, 'notified', NOW(), '2030-07-01T00:00:00Z', '09:00')`,
      [CLINIC_A, wlPatient.id],
    );
    const before = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    await dispatchInboundMessageJob(dispatchJob(conv, phone, 'sim', 'evt-d-wl-escalate-1'));
    const after = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE clinic_id = $1`, [CLINIC_A]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
    expect(await conversationStatus(conv)).toBe('escalated');
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
    const { rows: st } = await pool.query(
      `SELECT status FROM waitlist WHERE clinic_id = $1 AND patient_id = $2`,
      [CLINIC_A, wlPatient.id],
    );
    expect(st[0].status).toBe('notified');
    await pool.query(`DELETE FROM patients WHERE id = $1`, [wlPatient.id]);
  });
});

describeOrSkip('authenticated HTTP webhook → outbox → dispatcher (DB-backed)', () => {
  const HMAC_KEY = 'waha-integration-test-hmac-key-at-least-32-chars';
  const SESSION = 'test-session';
  let originalHmacKey: string | undefined;

  beforeAll(async () => {
    if (SKIP) return;
    originalHmacKey = process.env.WAHA_WEBHOOK_HMAC_KEY;
    process.env.WAHA_WEBHOOK_HMAC_KEY = HMAC_KEY;
    await pool.query(
      `INSERT INTO channel_installations (clinic_id, provider, installation_id, secret_hash, enabled)
       VALUES ($1, 'waha', $2, 'deadbeef', true)
       ON CONFLICT (installation_id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, enabled = true`,
      [CLINIC_A, SESSION],
    );
    for (const moduleId of ['operacional', 'comercial', 'atendimento']) {
      await pool.query(
        `INSERT INTO instance_modules (module_id, enabled) VALUES ($1, true)
         ON CONFLICT (module_id) DO UPDATE SET enabled = true`,
        [moduleId],
      );
    }
  });

  afterAll(async () => {
    if (originalHmacKey === undefined) delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    else process.env.WAHA_WEBHOOK_HMAC_KEY = originalHmacKey;
  });

  function signedWahaRequest(phone: string, messageId: string, body: string): any {
    const now = Date.now();
    const envelope = {
      event: 'message',
      session: SESSION,
      timestamp: now,
      payload: {
        id: messageId,
        timestamp: Math.floor(now / 1000),
        from: `${phone}@c.us`,
        fromMe: false,
        body,
        hasMedia: false,
      },
    };
    const raw = JSON.stringify(envelope);
    const signature = createHmac('sha512', HMAC_KEY).update(raw).digest('hex');
    return new NextRequest('http://localhost/api/whatsapp/waha', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-hmac': signature,
        'x-webhook-hmac-algorithm': 'sha512',
      },
      body: raw,
    });
  }

  it('POST /api/whatsapp/waha (valid HMAC) → receberMensagem persists+enqueues → dispatch confirms', async () => {
    const phone = uniquePhone(SENDER_A);
    const syntheticPatientId = await makePatient(CLINIC_A, phone, 'WAHA HTTP Patient');
    const appt = await makeAppointment(CLINIC_A, syntheticPatientId, DENTIST_A1, '2030-06-13T10:00:00Z');
    // Seed ONLY the pending confirmation request. The conversation row,
    // inbound message and outbox job all come from the real HTTP route.
    const { rows: [convRow] } = await pool.query(
      `INSERT INTO conversations (clinic_id, channel, external_id, status)
       VALUES ($1, 'whatsapp', $2, 'active') RETURNING id`,
      [CLINIC_A, phone],
    );
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: convRow.id,
      senderPhone: phone, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });

    const messageId = `whtest-${convRow.id.slice(0, 8)}`;
    const res = await wahaPost(signedWahaRequest(phone, messageId, 'SIM'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok' });

    // The durable outbox work the route enqueued — dispatched for real.
    const businessKey = `waha:${SESSION}:${messageId}`;
    const { rows: jobs } = await pool.query(
      `SELECT id, payload FROM outbox_jobs WHERE clinic_id = $1 AND business_key = $2`,
      [CLINIC_A, businessKey],
    );
    expect(jobs.length).toBe(1);
    expect(jobs[0].payload.externalMessageId).toBe(businessKey);

    await dispatchInboundMessageJob({ id: jobs[0].id, payload: jobs[0].payload } as any);

    expect(await appointmentStatus(appt)).toBe('confirmed');
    expect(await conversationStatus(convRow.id)).not.toBe('escalated');
    const { rows: consumed } = await pool.query(
      `SELECT status FROM appointment_confirmation_requests
       WHERE clinic_id = $1 AND consumed_by_event = $2`,
      [CLINIC_A, businessKey],
    );
    expect(consumed.length).toBe(1);
    expect(consumed[0].status).toBe('consumed');
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it('replayed webhook event is deduped at persistence (no second outbox work)', async () => {
    const phone = uniquePhone(SENDER_A);
    const messageId = 'whtest-replay-1';
    const first = await wahaPost(signedWahaRequest(phone, messageId, 'Olá'));
    expect(first.status).toBe(200);
    const second = await wahaPost(signedWahaRequest(phone, messageId, 'Olá'));
    expect(second.status).toBe(200);

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM outbox_jobs WHERE clinic_id = $1 AND business_key = $2`,
      [CLINIC_A, `waha:${SESSION}:${messageId}`],
    );
    expect(rows[0].n).toBe(1);
  });

  it('provider event time is persisted as authenticatedEventAt and forwarded to the outbox (never insert time)', async () => {
    const phone = uniquePhone(SENDER_A);
    const messageId = 'whtest-evt-ts-1';
    const beforeMs = Date.now();
    const res = await wahaPost(signedWahaRequest(phone, messageId, 'SIM'));
    expect(res.status).toBe(200);

    const businessKey = `waha:${SESSION}:${messageId}`;
    const { rows: [job] } = await pool.query(
      `SELECT payload FROM outbox_jobs WHERE clinic_id = $1 AND business_key = $2`,
      [CLINIC_A, businessKey],
    );
    expect(job).toBeDefined();
    // Outbox carries the provider clock, not the insert time.
    expect(typeof job.payload.receivedAt).toBe('string');
    const receivedAt = new Date(job.payload.receivedAt);
    expect(Number.isNaN(receivedAt.getTime())).toBe(false);
    expect(Math.abs(receivedAt.getTime() - beforeMs)).toBeLessThan(120_000);

    // The persisted row anchors the same instant in metadata.
    const { rows: [msg] } = await pool.query(
      `SELECT created_at, metadata FROM messages WHERE external_provider = 'waha' AND external_message_id = $1`,
      [businessKey],
    );
    expect(msg.metadata?.authenticatedEventAt).toBe(job.payload.receivedAt);
  });
});

describeOrSkip('schedule snapshot contract (DB-backed)', () => {
  // Every intent stores the schedule it refers to (`appointment_scheduled_at`
  // + `clinic_timezone`). Consume requires exact snapshot equality under the
  // appointment row lock, and every replay formats from the STORED snapshot —
  // never from a later current time. Provider event times below are fixed
  // slightly in the future so the stale-replay guard (intent must predate
  // the event) is deterministic without sleeps.
  const freshEvent = () => new Date(Date.now() + 60_000);

  it('create captures schedule/timezone snapshot; unchanged appointment confirms from the snapshot', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-08-10T12:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(req.deduped).toBe(false);
    expect(new Date(req.appointmentScheduledAt).toISOString()).toBe('2030-08-10T12:00:00.000Z');
    expect(req.clinicTimezone).toBe('America/Sao_Paulo');
    const stored = await requestSnapshot(req.id);
    expect(new Date(stored.appointment_scheduled_at).toISOString()).toBe('2030-08-10T12:00:00.000Z');
    expect(stored.clinic_timezone).toBe('America/Sao_Paulo');

    const result = await processTrustedConfirmation(
      trusted(SENDER_A, conv, 'SIM', 'evt-snap-ok-1', CLINIC_A, { receivedAt: freshEvent() }),
    );
    expect(result).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt });
    // Rendered for the snapshot instant in the stored timezone
    // (12:00Z = 09:00 in America/Sao_Paulo, UTC-3 year-round).
    expect(result.responseMessage).toContain('Confirmado');
    expect(result.responseMessage).toContain('09:00');
    expect(await appointmentStatus(appt)).toBe('confirmed');
  });

  it('reschedule before SIM: SIM escalates, appointment stays scheduled at the new time', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-08-11T10:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    // Non-cooperative reschedule (direct SQL, no advisory lock): status
    // stays `scheduled` while the time moves — the exact HIGH finding.
    await pool.query(`UPDATE appointments SET scheduled_at = $1, updated_at = NOW() WHERE id = $2`, [
      '2030-08-11T14:00:00Z',
      appt,
    ]);

    const result = await processTrustedConfirmation(
      trusted(SENDER_A, conv, 'SIM', 'evt-snap-resched-1', CLINIC_A, { receivedAt: freshEvent() }),
    );
    expect(result.processed).toBe(false);
    expect(result.reason).toBe('appointment_changed');
    expect(result.responseMessage).toBeUndefined();
    const row = await appointmentRow(appt);
    expect(row.status).toBe('scheduled');
    expect(new Date(row.scheduled_at).toISOString()).toBe('2030-08-11T14:00:00.000Z');
    const stored = await requestSnapshot(req.id);
    expect(stored.status).toBe('consumed');
    expect(stored.outcome).toBe('appointment_changed');

    // Renewal in the same call is forbidden: the superseded prompt's
    // original valid window is still open, so creation signals handoff
    // instead of overlapping a fresh prompt the user cannot distinguish
    // from the stale one.
    await expect(createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    })).rejects.toThrow(/handoff/);

    // Once the OLD prompt's valid window has elapsed, an explicit new
    // create may proceed — and it is based on the NEW snapshot, never the
    // superseded one.
    await pool.query(`UPDATE appointment_confirmation_requests SET expires_at = '2000-01-01T00:00:00Z' WHERE id = $1`, [req.id]);
    const req2 = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(req2.deduped).toBe(false);
    expect(req2.id).not.toBe(req.id);
    expect(new Date(req2.appointmentScheduledAt).toISOString()).toBe('2030-08-11T14:00:00.000Z');

    // Re-creating while the CURRENT snapshot already has a pending dedupes.
    const req3 = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(req3).toMatchObject({ id: req2.id, deduped: true });
  });

  it('create-path supersede commits the invalidation before the handoff error (A→B→A still blocked)', async () => {
    // Commit-before-error proof for the create path (no prompt emitter):
    // a reschedule between prompts must expire the stale intent AND persist
    // that expiry even though the create call itself rejects. A second
    // overlapping prompt is never created while the old valid window is open.
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-08-11T10:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(req.deduped).toBe(false);

    // Schedule A→B via direct SQL (non-cooperative reschedule, status stays scheduled).
    await pool.query(`UPDATE appointments SET scheduled_at = $1, updated_at = NOW() WHERE id = $2`, [
      '2030-08-11T14:00:00Z',
      appt,
    ]);

    // The superseding create rejects with the terminal handoff signal…
    const err = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/handoff/);
    // …stable signal, no caller PII in the message.
    expect((err as Error).message).not.toContain(SENDER_A);

    // …but the invalidation COMMITTED despite the error (rollback would have
    // left the stale intent pending and the handoff state lost).
    const stored = await requestSnapshot(req.id);
    expect(stored.status).toBe('expired');
    expect(stored.outcome).toBe('appointment_changed');

    // Repeated create while the superseded prompt's original window is still
    // open is blocked the same way and creates no row.
    const { rows: [before] } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM appointment_confirmation_requests WHERE clinic_id = $1 AND appointment_id = $2`,
      [CLINIC_A, appt],
    );
    await expect(createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    })).rejects.toThrow(/handoff/);
    const { rows: [afterRepeat] } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM appointment_confirmation_requests WHERE clinic_id = $1 AND appointment_id = $2`,
      [CLINIC_A, appt],
    );
    expect(afterRepeat.n).toBe(before.n);

    // ABA within the old prompt's validity: back to the ORIGINAL time still
    // fails — the terminal supersede outcome persists, snapshot equality
    // alone cannot resurrect the expired prompt.
    await pool.query(`UPDATE appointments SET scheduled_at = $1, updated_at = NOW() WHERE id = $2`, [
      '2030-08-11T10:00:00Z',
      appt,
    ]);
    await expect(createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    })).rejects.toThrow(/handoff/);

    // Once the old window elapsed, an explicit create proceeds on the new snapshot.
    await pool.query(`UPDATE appointments SET scheduled_at = $1, updated_at = NOW() WHERE id = $2`, [
      '2030-08-11T14:00:00Z',
      appt,
    ]);
    await pool.query(`UPDATE appointment_confirmation_requests SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1`, [req.id]);
    const req2 = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(req2.deduped).toBe(false);
    expect(req2.id).not.toBe(req.id);
    expect(new Date(req2.appointmentScheduledAt).toISOString()).toBe('2030-08-11T14:00:00.000Z');
  });

  it('same-event retry after post-commit reschedule: escalates, no confirmation of the new time', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-08-12T10:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const first = await processTrustedConfirmation(
      trusted(SENDER_A, conv, 'SIM', 'evt-snap-retry-1', CLINIC_A, { receivedAt: freshEvent() }),
    );
    expect(first).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt });
    expect(first.responseMessage).toContain('09:00');

    // Reschedule AFTER the commit (send-failure window): the retry carries
    // the same event and must not echo a confirmation of the new time.
    await pool.query(`UPDATE appointments SET scheduled_at = $1, updated_at = NOW() WHERE id = $2`, [
      '2030-08-12T15:00:00Z',
      appt,
    ]);

    const retry = await processTrustedConfirmation(
      trusted(SENDER_A, conv, 'SIM', 'evt-snap-retry-1', CLINIC_A, { receivedAt: freshEvent() }),
    );
    expect(retry.processed).toBe(false);
    expect(retry.responseMessage).toBeUndefined();
    // The resolver likewise escalates instead of confirming the new time.
    const decision = await resolveInboundReply(
      trusted(SENDER_A, conv, 'SIM', 'evt-snap-retry-1', CLINIC_A, { receivedAt: freshEvent() }),
    );
    expect(decision.kind).toBe('escalate');
    // Commit-time state is untouched by the retries.
    expect((await appointmentRow(appt)).status).toBe('confirmed');
    expect(new Date((await appointmentRow(appt)).scheduled_at).toISOString()).toBe('2030-08-12T15:00:00.000Z');
  });

  it('same-event retry after post-commit cancel: escalates, no stale confirmation message', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-08-12T11:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const first = await processTrustedConfirmation(
      trusted(SENDER_A, conv, 'SIM', 'evt-snap-cancel-1', CLINIC_A, { receivedAt: freshEvent() }),
    );
    expect(first).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt });

    // Cancel AFTER the commit: the retry must not restate a confirmation.
    await pool.query(
      `UPDATE appointments SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [appt],
    );

    const retry = await processTrustedConfirmation(
      trusted(SENDER_A, conv, 'SIM', 'evt-snap-cancel-1', CLINIC_A, { receivedAt: freshEvent() }),
    );
    expect(retry.processed).toBe(false);
    expect(retry.responseMessage).toBeUndefined();
    const decision = await resolveInboundReply(
      trusted(SENDER_A, conv, 'SIM', 'evt-snap-cancel-1', CLINIC_A, { receivedAt: freshEvent() }),
    );
    expect(decision.kind).toBe('escalate');
    expect((await appointmentRow(appt)).status).toBe('cancelled');
  });

  it('reschedule-vs-consume race serializes: FOR UPDATE + snapshot revalidation (barrier, no sleeps)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-08-13T10:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    // Barrier: hold the clinic advisory lock on a dedicated connection while
    // the consume path starts on the pool — it must wait for the lock (READ
    // COMMITTED). A non-cooperative reschedule (direct SQL, no advisory
    // lock) commits in the meantime; after COMMIT the consume must observe
    // the new time under its row lock and refuse via `appointment_changed`.
    const holder = new Pool({ connectionString: process.env.DATABASE_URL! });
    try {
      await holder.query('BEGIN');
      await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended('synkroo:whatsapp-reply:' || $1::text, 0))`, [CLINIC_A]);
      const consumePromise = processTrustedConfirmation(
        trusted(SENDER_A, conv, 'SIM', 'evt-snap-race-1', CLINIC_A, { receivedAt: freshEvent() }),
      );
      await pool.query(`UPDATE appointments SET scheduled_at = $1, updated_at = NOW() WHERE id = $2`, [
        '2030-08-13T15:00:00Z',
        appt,
      ]);
      await holder.query('COMMIT');
      const consumed = await consumePromise;
      expect(consumed.processed).toBe(false);
      expect(consumed.reason).toBe('appointment_changed');
      expect(consumed.responseMessage).toBeUndefined();
      const row = await appointmentRow(appt);
      expect(row.status).toBe('scheduled');
      expect(new Date(row.scheduled_at).toISOString()).toBe('2030-08-13T15:00:00.000Z');
    } finally {
      await holder.end().catch(() => undefined);
    }
  });
});









describeOrSkip('patient binding + conversation dedupe + micros precision (DB-backed)', () => {
  // Provider event times are fixed in the future so the stale-replay guard
  // (intent must predate the event) is deterministic without sleeps.
  const freshIntentEvent = () => new Date(Date.now() + 60_000);

  it('create stores the snapshot patient; consume binds current patient id AND phone to sender', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-09-01T10:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(req.deduped).toBe(false);
    const stored = await requestSnapshot(req.id);
    expect(stored.patient_id).toBe(PATIENT_A);

    const result = await processTrustedConfirmation(
      trusted(SENDER_A, conv, 'SIM', 'evt-patient-bind-1', CLINIC_A, { receivedAt: freshIntentEvent() }),
    );
    expect(result).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt });
    expect(result.responseMessage).toContain('Patient A');
    expect(await appointmentStatus(appt)).toBe('confirmed');
  });

  it('patient reassignment to another patient with the SAME phone fails closed (no confirm, no leak)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-09-02T10:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    // Second patient row sharing the sender phone (remapped appointment).
    const { rows: [other] } = await pool.query(
      `INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, 'Patient A2', $2, $3) RETURNING id`,
      [CLINIC_A, `+${SENDER_A}`, `a2-${Date.now()}@t.local`],
    );
    await pool.query(`UPDATE appointments SET patient_id = $1, updated_at = NOW() WHERE id = $2`, [other.id, appt]);
    try {
      const result = await processTrustedConfirmation(
        trusted(SENDER_A, conv, 'SIM', 'evt-reassign-samephone-1', CLINIC_A, { receivedAt: freshIntentEvent() }),
      );
      expect(result.processed).toBe(false);
      expect(result.reason).toBe('sender_mismatch');
      expect(result.responseMessage).toBeUndefined();
      expect(await appointmentStatus(appt)).toBe('scheduled');
    } finally {
      await pool.query(`UPDATE appointments SET patient_id = $1 WHERE id = $2`, [PATIENT_A, appt]);
      await pool.query(`DELETE FROM patients WHERE id = $1`, [other.id]);
    }
  });

  it('phone change between consume and replay escalates without a stale message', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-09-03T10:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const first = await processTrustedConfirmation(
      trusted(SENDER_A, conv, 'SIM', 'evt-phonechange-1', CLINIC_A, { receivedAt: freshIntentEvent() }),
    );
    expect(first).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt });

    // Patient phone changes after the commit: the same-event replay must
    // not re-render the confirmation for a sender that no longer matches.
    await pool.query(`UPDATE patients SET phone = $1 WHERE id = $2`, ['+5511999999999', PATIENT_A]);
    try {
      const retry = await processTrustedConfirmation(
        trusted(SENDER_A, conv, 'SIM', 'evt-phonechange-1', CLINIC_A, { receivedAt: freshIntentEvent() }),
      );
      expect(retry.processed).toBe(false);
      expect(retry.responseMessage).toBeUndefined();
      const decision = await resolveInboundReply(
        trusted(SENDER_A, conv, 'SIM', 'evt-phonechange-1', CLINIC_A, { receivedAt: freshIntentEvent() }),
      );
      expect(decision.kind).toBe('escalate');
      expect(await appointmentStatus(appt)).toBe('confirmed');
    } finally {
      await pool.query(`UPDATE patients SET phone = $1 WHERE id = $2`, [`+${SENDER_A}`, PATIENT_A]);
    }
  });

  it('create for the same clinic/appointment/sender from ANOTHER conversation fails explicitly', async () => {
    const convA = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-09-04T10:00:00Z');
    const reqA = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: convA,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    // Distinct conversation row (unique external_id): the key collides on
    // (clinic, appointment, sender) but the conversation differs.
    const convB = await makeConversation(CLINIC_A, uniquePhone(SENDER_A));
    await expect(createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: convB,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    })).rejects.toThrow(/another conversation/);
    // The other conversation's intent is untouched: never replaced, never
    // reported as deduped success.
    expect((await requestState(reqA.id)).status).toBe('pending');
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM appointment_confirmation_requests
       WHERE clinic_id = $1 AND appointment_id = $2 AND status = 'pending'`,
      [CLINIC_A, appt],
    );
    expect(rows[0].n).toBe(1);
  });

  it('superseded prompt blocks renewal while its window is open; explicit create proceeds after expiry', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-09-05T10:00:00Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    // Supersede the intent by rescheduling, then consume the SIM: the event
    // anchors as `appointment_changed` with the ORIGINAL valid window.
    await pool.query(`UPDATE appointments SET scheduled_at = $1, updated_at = NOW() WHERE id = $2`, [
      '2030-09-05T14:00:00Z',
      appt,
    ]);
    const sim = await processTrustedConfirmation(
      trusted(SENDER_A, conv, 'SIM', 'evt-supersede-block-1', CLINIC_A, { receivedAt: freshIntentEvent() }),
    );
    expect(sim).toMatchObject({ processed: false, reason: 'appointment_changed' });

    // While the superseded window is still open, renewal fails explicitly.
    await expect(createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    })).rejects.toThrow(/handoff/);

    // Once the old window elapsed, an explicit create proceeds on the new snapshot.
    await pool.query(`UPDATE appointment_confirmation_requests SET expires_at = '2000-01-01T00:00:00Z' WHERE id = $1`, [req.id]);
    const req2 = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(req2.deduped).toBe(false);
    expect(req2.id).not.toBe(req.id);
    expect(new Date(req2.appointmentScheduledAt).toISOString()).toBe('2030-09-05T14:00:00.000Z');
  });

  it('microsecond-exact snapshot: unchanged micros confirm; same-millisecond change fails appointment_changed', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    // `.123456`: JS Date rounds to `.123`, but the snapshot stores exact micros.
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-09-06T10:00:00.123456Z');
    const req = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    // Proof the snapshot kept microsecond precision (not the JS-rounded ms).
    const { rows: [snapRow] } = await pool.query(
      `SELECT appointment_scheduled_at::text AS s FROM appointment_confirmation_requests WHERE id = $1`,
      [req.id],
    );
    expect(snapRow.s).toContain('.123456');

    // Unchanged microsecond value confirms.
    const ok = await processTrustedConfirmation(
      trusted(SENDER_A, conv, 'SIM', 'evt-micros-ok-1', CLINIC_A, { receivedAt: freshIntentEvent() }),
    );
    expect(ok).toMatchObject({ processed: true, action: 'confirmed', appointmentId: appt });
    // Prompt-window invariant: expire the consumed prompt's window before
    // seeding the second intent for the same sender.
    await pool.query(`UPDATE appointment_confirmation_requests SET expires_at = '2000-01-01T00:00:00Z' WHERE id = $1`, [req.id]);

    // Same millisecond, different microsecond (`.123789`): the old
    // getTime() comparison would wrongly match — SQL must refuse.
    const appt2 = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-09-06T11:00:00.123456Z');
    const conv2 = await makeConversation(CLINIC_A, uniquePhone(SENDER_A));
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt2, conversationId: conv2,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await pool.query(`UPDATE appointments SET scheduled_at = $1, updated_at = NOW() WHERE id = $2`, [
      '2030-09-06T11:00:00.123789Z',
      appt2,
    ]);
    const resched = await processTrustedConfirmation(
      trusted(SENDER_A, conv2, 'SIM', 'evt-micros-changed-1', CLINIC_A, { receivedAt: freshIntentEvent() }),
    );
    expect(resched.processed).toBe(false);
    expect(resched.reason).toBe('appointment_changed');
    expect(resched.responseMessage).toBeUndefined();
    expect(await appointmentStatus(appt2)).toBe('scheduled');
  });

  it('second consume record for the same provider event is rejected (unique anchor)', async () => {
    const conv = await makeConversation(CLINIC_A, SENDER_A);
    const appt = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-09-07T10:00:00Z');
    await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt, conversationId: conv,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    const confirmed = await processTrustedConfirmation(
      trusted(SENDER_A, conv, 'SIM', 'evt-unique-anchor-1', CLINIC_A, { receivedAt: freshIntentEvent() }),
    );
    expect(confirmed).toMatchObject({ processed: true, action: 'confirmed' });
    // Prompt-window invariant: expire the consumed prompt's window before
    // seeding the second intent for the same sender (the UNIQUE anchor
    // assertion below is not about window overlap).
    await pool.query(`UPDATE appointment_confirmation_requests SET expires_at = '2000-01-01T00:00:00Z' WHERE clinic_id = $1 AND consumed_by_event = 'evt-unique-anchor-1'`, [CLINIC_A]);

    // A second row anchored to the same provider event must violate the
    // UNIQUE partial index — duplicate anchors can never exist.
    const appt2 = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-09-07T11:00:00Z');
    const conv2 = await makeConversation(CLINIC_A, uniquePhone(SENDER_A));
    const req2 = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: appt2, conversationId: conv2,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    await expect(pool.query(
      `UPDATE appointment_confirmation_requests
       SET status = 'consumed', outcome = 'confirmed', consumed_at = NOW(),
           consumed_by_provider = 'waha', consumed_by_event = 'evt-unique-anchor-1', updated_at = NOW()
       WHERE id = $1`,
      [req2.id],
    )).rejects.toThrow();
    expect((await requestState(req2.id)).status).toBe('pending');
  });

  it('consumed confirmation keeps its prompt window open: second intent for same sender fails until expiry', async () => {
    // Prompt-window overlap (HIGH): after a normal confirmation is consumed,
    // its row is `consumed` but the ORIGINAL `expiresAt` may still be in the
    // future. A distinct late "SIM" (new event id, so the unique event anchor
    // does not help) replying to the still-valid old prompt text must never
    // confirm a newer intent created inside that window — so creating the
    // newer intent fails while the window is open. No prompt emitter and no
    // prompt-to-response correlation exist: late responses after expiration
    // still require out-of-band prompt correlation or a human handoff.
    const convA = await makeConversation(CLINIC_A, SENDER_A);
    const apptA = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-09-08T10:00:00Z');
    const reqA = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: apptA, conversationId: convA,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(reqA.deduped).toBe(false);
    const first = await processTrustedConfirmation(
      trusted(SENDER_A, convA, 'SIM', 'evt-prompt-window-1', CLINIC_A, { receivedAt: freshIntentEvent() }),
    );
    expect(first).toMatchObject({ processed: true, action: 'confirmed', appointmentId: apptA });
    expect(await appointmentStatus(apptA)).toBe('confirmed');

    // A second intent for the same sender (another appointment AND another
    // conversation) must fail while A's original valid window is still open.
    const convB = await makeConversation(CLINIC_A, uniquePhone(SENDER_A));
    const apptB = await makeAppointment(CLINIC_A, PATIENT_A, DENTIST_A1, '2030-09-08T11:00:00Z');
    const blocked = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: apptB, conversationId: convB,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    }).catch((e: unknown) => e);
    expect(blocked).toBeInstanceOf(Error);
    expect((blocked as Error).message).toMatch(/handoff/);
    // Static handoff signal: no caller PII in the message.
    expect((blocked as Error).message).not.toContain(SENDER_A);

    // A distinct late event inside the old window escalates and confirms
    // nothing (no appointment B was ever created to confirm).
    const late = await processTrustedConfirmation(
      trusted(SENDER_A, convB, 'SIM', 'evt-prompt-window-2', CLINIC_A, { receivedAt: freshIntentEvent() }),
    );
    expect(late.processed).toBe(false);
    expect(late.responseMessage).toBeUndefined();
    expect(await appointmentStatus(apptB)).toBe('scheduled');
    const decision = await resolveInboundReply(
      trusted(SENDER_A, convB, 'SIM', 'evt-prompt-window-2', CLINIC_A, { receivedAt: freshIntentEvent() }),
    );
    expect(decision.kind).toBe('escalate');

    // Once A's original window has elapsed, an explicit create proceeds.
    await pool.query(`UPDATE appointment_confirmation_requests SET expires_at = '2000-01-01T00:00:00Z' WHERE id = $1`, [reqA.id]);
    const reqB = await createConfirmationRequest({
      clinicId: CLINIC_A, appointmentId: apptB, conversationId: convB,
      senderPhone: SENDER_A, expiresAt: new Date('2030-06-09T10:00:00Z'),
    });
    expect(reqB.deduped).toBe(false);
    expect(reqB.id).not.toBe(reqA.id);
  });
});
