import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { appointmentConfirmationRequests, appointments, patients, waitlist } from '@/modules/operacional/schema';
import { clinics } from '@/lib/db/schema/core';
import { resolveClinicTimezone } from '@/lib/timezone';
import { getClinicTimezone } from './availability-service';
import { dbLogger } from '@/lib/logger';

/**
 * WhatsApp appointment confirmation — exact-match path (P0).
 *
 * Rules (hard requirements, not heuristics):
 * 1. Only an EXACT full-message reply counts ("sim" after deterministic
 *    normalization). No includes/fuzzy/partial phrase matching — "ok",
 *    "não vou", "sim, obrigado" and friends are NOT confirmations and
 *    NEVER cancel anything.
 * 2. Unconfirmed replies NEVER fall through to the agent silently: exact
 *    "sim" without an unambiguous pending context, and reply-like
 *    non-exact text, escalate the conversation to a human
 *    (status='escalated', no mutation, no agent processing). A notified
 *    waitlist row is preferences only (never a concrete slot) and likewise
 *    escalates with `concrete_offer_required` — never an appointment.
 * 3. No partial phone matching: sender identity is exact normalized digits.
 * 4. Identity binds ONLY to the authenticated webhook sender + trusted
 *    clinic/conversation context. Appointment/clinic/person ids supplied by
 *    the model are never trusted.
 * 5. At most one unexpired pending confirmation request exists per
 *    (clinic, sender), regardless of appointment/conversation: a second
 *    prompt for the same sender never overlaps the first (creation fails
 *    explicitly). Exactly one pending is required to consume. Zero →
 *    escalate; more than one (legacy rows) → ambiguous, escalate. A sole
 *    pending bound to ANOTHER conversation than the inbound one never
 *    confirms (`conversation_mismatch`, no mutation). No arbitrary
 *    selection. A coexisting notified waitlist row for the same sender
 *    also forces escalation (preferences are not a concrete slot).
 * 6. Single consumption: atomic transaction + row lock + conditional
 *    appointment update + inbound-event consumption record. Duplicate
 *    events and concurrent replies produce exactly one effect.
 * 7. Unknown persistence outcome reconciles by inbound event/consumption
 *    record before any retry — never a blind repeat.
 * 8. Schedule + patient snapshot: every intent stores the appointment's
 *    `scheduledAt` (via INSERT ... SELECT from the locked row — exact
 *    timestamptz microseconds, never a JS Date parameter), `patient_id`,
 *    + clinic timezone at creation. Consume requires exact snapshot
 *    equality under the appointment row lock — timestamp via SQL
 *    column-to-column comparison, patient id plus current patient phone
 *    against the trusted sender (`appointment_changed`/`sender_mismatch`
 *    otherwise, zero mutation) — and EVERY delivery (fresh consume and
 *    replay) formats via the shared snapshot validator AFTER commit from
 *    the stored snapshot — never from a later current time. No response
 *    text is persisted (snapshot + outcome suffice; avoids an extra PII
 *    copy); a null validator result means do-not-send (escalate, never a
 *    stale message). Residual: the validator read and the external send are
 *    not atomic (no DB lock is ever held across network I/O).
 * 9. Creation never overlaps prompts: at most one pending intent exists
 *    per (clinic, sender), regardless of appointment/conversation. A
 *    create for another appointment or conversation while one is pending
 *    fails explicitly (never deduped or replaced); a same-appointment
 *    intent in the SAME conversation WITH a matching schedule + patient
 *    + timezone snapshot dedupes; a pending whose snapshot no longer
 *    matches the live row is invalidated WITHOUT creating a replacement
 *    (terminal handoff signal), and renewal stays blocked while the
 *    superseded prompt's original valid window is still open. No prompt
 *    emitter exists and no prompt-to-response correlation is assumed:
    A consumed prompt keeps its window open until `expiresAt`: no second
    prompt overlaps an earlier valid window, regardless of outcome.
 *    persisted (snapshot + outcome suffice; avoids an extra PII copy);
  *    a null validator result means do-not-send (escalate, never a stale
  *    message). Residual: the validator read and the external send are not
  *    atomic (no DB lock is ever held across network I/O).
 */

export type ReplyMessageKind = 'text' | 'button';

export interface TrustedConfirmationInput {
  clinicId: string;
  conversationId: string;
  /** Trusted webhook sender (e.g. Evolution remoteJid phone / Meta `from`). Never model-supplied. */
  senderPhone: string;
  /** Raw inbound message text. */
  content: string;
  /** Inbound event identity — anchors idempotent consume + reconcile. */
  externalProvider: string;
  externalMessageId: string;
  /**
   * Canonical persisted message type (messages.message_type). Only plain
   * 'text' is consumable: image/audio/document/video captions never
   * confirm or schedule, even when the caption normalizes to exactly SIM.
   */
  messageType: string;
  /**
   * Button-tap marker derived at persistence time (metadata flag), never
   * from client-supplied ids. Button display-text may only confirm through
   * the button channel (`allowWaitlist: false`).
   */
  messageKind?: ReplyMessageKind;
  /**
   * Authenticated inbound event time: ISO-8601 of the provider message
   * clock (e.g. `messages.metadata.authenticatedEventAt`), never the DB
   * insert time. REQUIRED for any mutation: a missing/invalid event time
   * fails closed, and pending requests created AFTER the provider event
   * are stale replays of an old SIM against a future confirmation and are
   * rejected without mutation.
   */
  receivedAt?: Date | string | null;
}

export interface ConfirmationResult {
  processed: boolean;
  action?: 'confirmed' | 'no_action';
  appointmentId?: string;
  responseMessage?: string;
  /** Machine-readable reason when processed === false (observability, never shown as mutation). */
  reason?: string;
}

// ─── Deterministic normalization (exact-match only) ────────────────────

/**
 * Deterministic normalization for confirmation text: lowercase, strip
 * diacritics, trim, collapse internal whitespace. Matching is then EXACT
 * equality against the single accepted token — never `includes`.
 */
export function normalizeConfirmationText(message: string): string {
  return (message || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** The ONLY text that confirms: exactly "sim" after normalization. */
export function isExactConfirmationText(message: string): boolean {
  return normalizeConfirmationText(message) === 'sim';
}

/**
 * Reply-like but non-exact text: short acknowledgments, negations and
 * embedded/ambiguous yes-variants. These NEVER confirm and NEVER reach the
 * agent — the caller escalates them to a human without mutation.
 *
 * Classification (never confirmation) may use exact-set + word-boundary
 * matching; only confirmation itself is exact-equality-only.
 */
const REPLY_LIKE_EXACT = new Set([
  'ok', 'nao', 'nao vou', 'nao posso', 'nao consigo', 'nao conseguirei', 'nao poderei',
  'nao podera comparecer', 'impossivel comparecer', 'cancelar', 'cancelado', 'cancelada',
  'desmarcar', 'desmarquei', 'confirmo', 'confirmar', 'confirmado',
  'confirmada', 'combinado', 'combinada', 'certo', 'vou', 'yes', 'no',
  'cancel', 'confirm', 'blz', 'beleza', 'fechado', 'entendido',
]);

const REPLY_LIKE_PATTERN = /\b(sim|ok|confirm\w*|cancel\w*|desmarc\w*|nao|impossivel|consig\w*|poderei|podera|posso|possa|comparecer)\b/;

/** Inbound providers with webhook-authenticated mutation authority (waha/meta only). */
export const AUTHENTICATED_REPLY_PROVIDERS = ['waha', 'meta'] as const;

export function isAuthenticatedReplyProvider(provider: string): boolean {
  return (AUTHENTICATED_REPLY_PROVIDERS as readonly string[]).includes(provider);
}

/**
 * Parse the authenticated inbound event time. Returns null for missing,
 * non-string/non-Date, or invalid values — callers fail closed on null
 * (escalate, never mutate).
 */
export function parseEventTime(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Stale-event comparison at provider-clock resolution.
 *
 * Provider message timestamps carry whole seconds while DB rows carry
 * milliseconds. Both sides are floored to whole seconds to match what the
 * provider clock can actually distinguish. Fail-closed on ties: an intent
 * created in the SAME second as the event is treated as stale — a `SIM`
 * cannot consume a confirmation prompt (or offer) stamped with the same
 * second when ordering is unverifiable. Only an event from a strictly
 * LATER second than the intent counts as fresh. Genuinely old replays
 * (minutes or more) are unaffected.
 */
export function isEventTimeStale(intentTime: Date, eventTime: Date): boolean {
  if (Number.isNaN(intentTime.getTime()) || Number.isNaN(eventTime.getTime())) return false;
  return Math.floor(intentTime.getTime() / 1000) >= Math.floor(eventTime.getTime() / 1000);
}

/**
 * Deterministic per-clinic advisory transaction lock for the WhatsApp reply
 * path (READ COMMITTED). Acquire FIRST inside every mutation transaction on
 * this path — before intent selection/reads — so concurrent writers for the
 * same clinic serialize. Cooperative only: it does not constrain direct-SQL
 * writers that never take the lock (noted as residual risk).
 */
export async function acquireClinicReplyLock(tx: any, clinicId: string): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${'synkroo:whatsapp-reply:' + clinicId}, 0))`,
  );
}

export function isReplyLikeText(message: string): boolean {
  const normalized = normalizeConfirmationText(message);
  if (!normalized) return false;
  if (normalized === 'sim' || REPLY_LIKE_EXACT.has(normalized)) return true;
  return REPLY_LIKE_PATTERN.test(normalized);
}

/**
 * Parse a waitlist time-of-day into canonical `HH:mm:ss`.
 *
 * Accepts exactly `HH:mm`, `HH:mm:ss` and `HH:mm:ss` with up to six
 * fractional digits (the forms PostgreSQL `time` columns can return —
 * always zero-padded, seconds included). Fractional digits are truncated to
 * whole seconds. Anything else (missing value,
 * wrong shape, out-of-range fields, a second `:00` appended onto an
 * already-complete `HH:mm:ss`) returns null so the caller escalates
 * instead of booking a wrong or invalid instant. Never invents a time.
 */
export function parseWaitlistTimeOfDay(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,6})?)?$/);
  if (!m) return null;
  return `${m[1]}:${m[2]}:${m[3] ?? '00'}`;
}

/**
 * Sender normalization: digits only, strip a single leading BR country
 * code when present. Comparison is ALWAYS exact equality — no `includes`
 * in either direction, so similar phones never collide.
 */
export function normalizeSenderPhone(phone: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.substring(2);
  return digits;
}

// ─── Pending-request creation (reminder/seed seam) ─────────────────────

/**
 * Record a consumable pending confirmation. Called when a confirmation
 * prompt is sent (or by tests seeding the pending state). At most one
 * pending intent exists per (clinic, sender), regardless of
 * appointment/conversation: re-sending a prompt for the same sender
 * does NOT duplicate intent (same appointment + conversation + snapshot
 * dedupes) and a second prompt for another appointment or conversation
 * fails explicitly — the partial unique index keeps a single pending
 * row per (clinic, sender).
 *
 * Stale (expired-but-still-pending) rows are expired first: the partial
 * unique index covers `status='pending'`, so without this step an expired
 * row would block renewal forever and be returned as a misleading dedupe.
 * Dedupe only ever reports a still-valid row for the SAME conversation
 * WITH a matching schedule + patient + timezone snapshot. A pending row
 * bound to ANOTHER appointment or conversation fails explicitly (never
 * deduped, replaced, or superseded here); a pending row whose snapshot
 * differs from the live appointment (reschedule, patient remap, or
 * clinic timezone change between prompts) is expired as
 * `appointment_changed` and NO replacement is created in the same
 * call — the caller gets a terminal handoff signal and retries
 * explicitly only after the old prompt's valid window has elapsed
 * (a second prompt overlapping the first is indistinguishable
 * delivery-side without a prompt-delivery record, deliberately not
 * built here: no new schema, no sender changes). While ANY prior
 * non-pending prompt's original `expiresAt` is still open (any outcome —
 * `confirmed`, `appointment_changed`, `already_final`, ...) any new
 *    create for the same (clinic, sender) fails explicitly the same way.
  *
  *    The returned `appointmentScheduledAt` + `clinicTimezone` are the EXACT
  *    presented time: any future prompt emitter must render exactly these
  *    values. No production emitter or prompt-to-intent correlation exists
  *    in this task — if an already-presented prompt is superseded, the
  *    caller (not this seam) must hand off to a human / send a correction:
  *    a stale prompt text in the user's hands is indistinguishable here from
  *    a renewed one without a prompt-delivery record (deliberately not
  *    built: no new schema, no sender changes in this task).
 *
 * The appointment must be currently `scheduled` under its row lock: its
 * live `scheduled_at` (exact timestamptz, via INSERT ... SELECT from the
 * locked row) plus its live `patient_id` plus the resolved clinic timezone
 * are stored as the snapshot this intent refers to, and returned so a
 * future emitter can render exactly those values. No production prompt
 * emitter exists in this task — this seam only records the snapshot for a
 * future emitter.
 */
export async function createConfirmationRequest(input: {
  clinicId: string;
  appointmentId: string;
  conversationId: string;
  senderPhone: string;
  expiresAt: Date;
}): Promise<{ id: string; deduped: boolean; appointmentScheduledAt: Date; clinicTimezone: string }> {
  const senderNormalized = normalizeSenderPhone(input.senderPhone);
  if (!senderNormalized) throw new Error('senderPhone normalizes to empty');
  const db = getDb();
  type CreateTxResult =
    | { kind: 'created'; value: { id: string; deduped: boolean; appointmentScheduledAt: Date; clinicTimezone: string } }
    | { kind: 'superseded' };
  // Serialize per clinic: concurrent creation vs consume/notify must not
  // interleave intent selection. Lock first, then read + write atomically.
  // Commit-before-error: the superseded branch mutates (expires the stale
  // intent as `appointment_changed`) and MUST commit that mutation. Throwing
  // inside the callback would roll the invalidation back (Drizzle aborts the
  // transaction), leaving the stale intent pending and the handoff state
  // lost. The callback therefore returns a discriminated result and the
  // terminal handoff error is raised only AFTER the transaction commits.
  const txResult: CreateTxResult = await db.transaction(async (tx: any): Promise<CreateTxResult> => {
    await acquireClinicReplyLock(tx, input.clinicId);
    // Identity guard (creation): the pending sender must exactly equal the
    // referenced appointment's patient phone. A mismatch is a caller bug —
    // fail closed instead of seeding an unconsumable (or hijackable) intent.
    // The appointment row is locked here and must be `scheduled`: its live
    // `scheduled_at` and `patient_id` become the snapshot this intent
    // refers to (persisted via INSERT ... SELECT below).
    const [owner] = await tx.select({
      patientId: appointments.patientId,
      patientPhone: patients.phone,
      status: appointments.status,
    })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(and(
        eq(appointments.id, input.appointmentId),
        eq(appointments.clinicId, input.clinicId),
      ))
      .limit(1)
      .for('update');
    if (!owner) throw new Error('createConfirmationRequest: appointment not found');
    if (normalizeSenderPhone(owner.patientPhone || '') !== senderNormalized) {
      throw new Error('createConfirmationRequest: sender does not match appointment patient');
    }
    if ((owner as any).status !== 'scheduled') {
      throw new Error('createConfirmationRequest: appointment is not scheduled');
    }
    // The snapshot patient is the appointment's CURRENT patient under the
    // row lock taken above. The snapshot timestamp is persisted via
    // INSERT ... SELECT straight from the locked row (never via a JS Date
    // parameter, which rounds timestamptz microseconds to milliseconds).
    // Read-only clinic lookup stored with the snapshot so every later
    // render uses the timezone the prompt referred to. Resolved through
    // the OPEN transaction executor (same pool connection): a separate
    // getDb() handle here (e.g. getClinicTimezone) would wait on the
    // Workers Hyperdrive pool (max: 1, already held by this transaction)
    // until connection timeout. Fallback to the default only when the
    // tenant row is unexpectedly absent (clinic FK should normally ensure
    // one).
    const [clinicRow] = await tx.select({
      timezone: clinics.timezone,
      settings: clinics.settings,
    })
      .from(clinics)
      .where(eq(clinics.id, input.clinicId))
      .limit(1);
    const clinicTimezone = resolveClinicTimezone(
      (clinicRow ?? null) as { timezone?: string | null; settings?: unknown } | null,
    );
    // Single-intent invariant: at most one pending row per (clinic,
    // sender), regardless of appointment/conversation. Expire stale rows
    // for the whole sender scope before inserting: an expired row must
    // never block renewal. The partial unique index only covers
    // `status='pending'`, so this step also guarantees any conflicting
    // row below is still valid.
    const senderScope = and(
      eq(appointmentConfirmationRequests.clinicId, input.clinicId),
      eq(appointmentConfirmationRequests.senderNormalized, senderNormalized),
      eq(appointmentConfirmationRequests.status, 'pending'),
    );
    await tx.update(appointmentConfirmationRequests).set({
      status: 'expired', outcome: 'expired', updatedAt: new Date(),
    } as any).where(and(
      senderScope,
      lte(appointmentConfirmationRequests.expiresAt, new Date()),
    ));
    // Pending-row read with snapshot comparison at PostgreSQL precision:
    // timestamp equality is computed SQL-side (column-to-column), because a
    // JS Date parameter rounds timestamptz microseconds to milliseconds.
    // The appointments row is re-read here under the same clinic lock (it is
    // already locked by the owner read above; re-locking is a no-op).
    // Scope is the whole (clinic, sender): ANY other pending intent —
    // another appointment or another conversation — blocks creation, so a
    // SIM can never answer the wrong prompt.
    const compared = await tx.execute(sql`
      SELECT r.id AS id,
              r.appointment_id AS "appointmentId",
              r.conversation_id AS "conversationId",
              r.clinic_timezone AS "intentTimezone",
              r.appointment_scheduled_at AS "intentScheduledAt",
              (a.scheduled_at = r.appointment_scheduled_at) AS "timeSame",
              (a.patient_id = r.patient_id) AS "patientSame"
      FROM appointment_confirmation_requests r
      JOIN appointments a ON a.id = r.appointment_id AND a.clinic_id = ${input.clinicId}
      WHERE r.clinic_id = ${input.clinicId}
        AND r.sender_normalized = ${senderNormalized}
        AND r.status = 'pending'
        AND r.expires_at > NOW()
      ORDER BY r.created_at ASC
      LIMIT 2
      FOR UPDATE`);
    const comparedRows = (((compared as any)?.rows ?? []) as Array<{
      id: string; appointmentId: string; conversationId: string; intentTimezone: string; intentScheduledAt: unknown; timeSame: boolean; patientSame: boolean;
    }>);
    if (comparedRows.length > 1) {
      // Legacy corruption (multiple pendings predate the single-intent
      // unique index): never select, dedupe, or replace — handoff required.
      throw new Error('createConfirmationRequest: multiple pending requests for sender — handoff required');
    }
    const existing = comparedRows[0] ?? null;
    if (existing) {
      // Single-intent binding: a pending intent for ANOTHER appointment or
      // conversation is never deduped, replaced, or superseded here —
      // fail explicitly so the caller correlates prompts out-of-band
      // (handoff).
      if (String(existing.appointmentId) !== String(input.appointmentId) ||
        String(existing.conversationId) !== String(input.conversationId)) {
        throw new Error('createConfirmationRequest: conflicting pending for another conversation or appointment');
      }
      const snapshotSame = existing.timeSame === true
        && existing.patientSame === true
        && String(existing.intentTimezone) === clinicTimezone;
      if (snapshotSame) {
        return {
          kind: 'created',
          value: {
            id: String(existing.id),
            deduped: true,
            appointmentScheduledAt: new Date(existing.intentScheduledAt as any),
            clinicTimezone,
          },
        };
      }
      // Superseded prompt: the live appointment (schedule, patient, or clinic
      // timezone) no longer matches the snapshot this intent refers to. The
      // old and new prompts are uncorrelated delivery-side (no
      // prompt-to-response correlation exists), so creating a new intent in
      // this same call would leave two overlapping valid prompts. Invalidate
      // the superseded intent WITHOUT creating a new one and signal handoff;
      // the caller retries explicitly once the old prompt's valid window has
      // elapsed (see the supersede block below). Returned (not thrown) so
      // the expiry commits; the handoff error is raised after commit.
      await tx.update(appointmentConfirmationRequests).set({
        status: 'expired', outcome: 'appointment_changed', updatedAt: new Date(),
      } as any).where(eq(appointmentConfirmationRequests.id, existing.id));
      return { kind: 'superseded' };
    }
    // Prompt-window block (runs AFTER the pending checks above, so no
    // active pending exists here): ANY prior non-pending row for this
    // (clinic, sender) whose ORIGINAL valid window is still open blocks a
    // fresh prompt — regardless of outcome (`confirmed`,
    // `appointment_changed`, `already_final`, `expired`, ...). A consumed
    // confirmation keeps its original window open until `expiresAt`, and a
    // distinct late "SIM" (new event id, no anchor help) answering the
    // still-valid old prompt text must never confirm a newer intent
    // created inside that window. Fail explicitly (handoff) until every
    // earlier window has elapsed; then an explicit new create may proceed
    // on the new snapshot. Clinic-scoped: other tenants are never
    // blocked. Late responses after expiration still require out-of-band
    // prompt correlation or a human handoff — no emitter and no
    // correlation are built here.
    const blockedRows = ((((await tx.execute(sql`
      SELECT r.id AS id
      FROM appointment_confirmation_requests r
      WHERE r.clinic_id = ${input.clinicId}
        AND r.sender_normalized = ${senderNormalized}
        AND r.status != 'pending'
        AND r.expires_at > NOW()
      LIMIT 1`)) as any)?.rows ?? []) as Array<unknown>);
    if (blockedRows.length > 0) {
      throw new Error('createConfirmationRequest: prior prompt still within its valid window — handoff required');
    }
    // Insert with ON CONFLICT DO NOTHING on the partial unique index
    // (clinic, sender WHERE status='pending'). Trapping a
    // unique-violation inside this open transaction is forbidden: PostgreSQL
    // marks the whole transaction aborted and every later statement fails
    // with 25P02. DO NOTHING never raises, so the transaction stays usable
    // either way.
    //
    // The snapshot timestamp is persisted via INSERT ... SELECT straight
    // from the locked appointment row: the EXACT timestamptz (microsecond
    // precision) — never a JS Date parameter, which rounds to milliseconds.
    // The snapshot patient is the appointment's CURRENT patient under the
    // row lock taken above.
    const inserted = await tx.execute(sql`
      INSERT INTO appointment_confirmation_requests
        (clinic_id, appointment_id, patient_id, conversation_id, sender_normalized, appointment_scheduled_at, clinic_timezone, status, expires_at)
      SELECT ${input.clinicId}, ${input.appointmentId}, a.patient_id, ${input.conversationId}, ${senderNormalized}, a.scheduled_at, ${clinicTimezone}, 'pending', ${input.expiresAt}
      FROM appointments a
      WHERE a.id = ${input.appointmentId} AND a.clinic_id = ${input.clinicId}
      ON CONFLICT (clinic_id, sender_normalized) WHERE status = 'pending' DO NOTHING
      RETURNING id, appointment_scheduled_at AS "snapshotAt"`);
    const insertedRows = (((inserted as any)?.rows ?? []) as Array<{ id: string; snapshotAt: unknown }>);
    if (insertedRows.length === 1 && insertedRows[0]?.id) {
      return {
        kind: 'created',
        value: {
          id: String(insertedRows[0].id),
          deduped: false,
          appointmentScheduledAt: new Date(insertedRows[0].snapshotAt as any),
          clinicTimezone,
        },
      };
    }
    throw new Error('createConfirmationRequest: conflicting row appeared under lock and could not be resolved');
  });
  if (txResult.kind === 'superseded') {
    throw new Error('createConfirmationRequest: superseded intent expired as appointment_changed — handoff required, no new intent created');
  }
  return txResult.value;
}

// ─── Reconcile by inbound event (unknown-outcome path) ─────────────────

/**
 * Reconcile an unknown persistence outcome by inbound event identity:
 * if this event already has a consumption record for the SAME trusted
 * (clinic, conversation, sender), return the recorded outcome WITHOUT
 * mutating. Scoping to conversation+sender (not just clinic+event) keeps
 * a replayed event id from ever returning another conversation's patient
 * details. Callers must invoke this before any retry.
 */
export async function reconcileConfirmationByEvent(input: {
  clinicId: string;
  conversationId: string;
  senderPhone: string;
  externalProvider: string;
  externalMessageId: string;
}): Promise<{
  found: boolean;
  outcome?: string | null;
  appointmentId?: string;
  /** Consumed row holding the snapshot — validators re-read from it. */
  requestId?: string;
  appointmentScheduledAt?: Date | string | null;
  clinicTimezone?: string | null;
}> {
  const db = getDb();
  const [row] = await db.select({
    id: appointmentConfirmationRequests.id,
    appointmentId: appointmentConfirmationRequests.appointmentId,
    outcome: appointmentConfirmationRequests.outcome,
    appointmentScheduledAt: appointmentConfirmationRequests.appointmentScheduledAt,
    clinicTimezone: appointmentConfirmationRequests.clinicTimezone,
  }).from(appointmentConfirmationRequests).where(and(
    eq(appointmentConfirmationRequests.clinicId, input.clinicId),
    eq(appointmentConfirmationRequests.conversationId, input.conversationId),
    eq(appointmentConfirmationRequests.senderNormalized, normalizeSenderPhone(input.senderPhone)),
    eq(appointmentConfirmationRequests.consumedByProvider, input.externalProvider),
    eq(appointmentConfirmationRequests.consumedByEvent, input.externalMessageId),
  )).limit(1);
  if (!row) return { found: false };
  return {
    found: true,
    outcome: row.outcome,
    appointmentId: row.appointmentId,
    requestId: row.id,
    appointmentScheduledAt: row.appointmentScheduledAt as Date | string | null,
    clinicTimezone: row.clinicTimezone as string | null,
  };
}

/**
 * Deprecated waitlist-anchor reconciliation (scheduling DISABLED).
 *
 * Waitlist rows store only preferences (`preferred_date`/`preferred_time`),
 * never a concrete offered slot, and no production confirmation-prompt
 * emitter exists. A `SIM` that could answer a waitlist notification must
 * escalate with `concrete_offer_required` — never create an appointment.
 * The `accepted_*` anchor columns were removed with that effect, so there
 * is no waitlist event anchor left to reconcile: this seam always reports
 * "not found" without touching the database. Kept only so existing
 * importers keep compiling; new code must not rely on it.
 */
export async function reconcileWaitlistByEvent(_input: {
  clinicId: string;
  conversationId: string;
  senderPhone: string;
  externalProvider: string;
  externalMessageId: string;
}): Promise<{ found: boolean; appointmentId?: string }> {
  return { found: false };
}

/**
 * Transaction-scoped event-anchor read for use INSIDE mutation
 * transactions, immediately after `acquireClinicReplyLock` and before any
 * candidate selection or insert.
 *
 * The resolver's pre-lock replay check is only a fast path: two deliveries
 * of the same event can both pass it before either commits. Re-reading the
 * confirmation anchor under the shared clinic lock closes the
 * interleaving: a second handler can never mutate a different intent
 * for an already-consumed event — it returns the stored outcome (same
 * response) or fails closed.
 *
 * Waitlist scheduling is disabled and its `accepted_*` anchors were
 * removed, so only the confirmation anchor remains. Duplicate or
 * mismatched confirmation anchors still fail closed (never absent).
 *
 * Local to confirmation-service by design; takes the caller's transaction
 * executor so the read participates in the same snapshot/lock ordering.
 */
type InTxEventAnchor =
  | { found: false }
  | {
    found: true;
    kind: 'confirmation';
    requestId: string;
    outcome: string | null;
    appointmentId: string | null;
    appointmentScheduledAt: Date | string | null;
    clinicTimezone: string | null;
  }
  | { found: true; kind: 'conflict'; reason: string };

async function findEventAnchorInTx(tx: any, input: {
  clinicId: string;
  conversationId: string;
  senderPhone: string;
  externalProvider: string;
  externalMessageId: string;
}): Promise<InTxEventAnchor> {
  const senderNormalized = normalizeSenderPhone(input.senderPhone);
  if (!senderNormalized) return { found: false };
  // Read the confirmation anchor clinic-scoped by provider event identity
  // (limit 2 to detect duplicates). Conversation/sender binding is
  // validated below — a consumption recorded for another conversation is
  // "consumed elsewhere", never absent — so a redelivered event can never
  // select a new intent.
  const crows = await tx.select({
    id: appointmentConfirmationRequests.id,
    appointmentId: appointmentConfirmationRequests.appointmentId,
    outcome: appointmentConfirmationRequests.outcome,
    conversationId: appointmentConfirmationRequests.conversationId,
    senderNormalized: appointmentConfirmationRequests.senderNormalized,
    appointmentScheduledAt: appointmentConfirmationRequests.appointmentScheduledAt,
    clinicTimezone: appointmentConfirmationRequests.clinicTimezone,
  }).from(appointmentConfirmationRequests).where(and(
    eq(appointmentConfirmationRequests.clinicId, input.clinicId),
    eq(appointmentConfirmationRequests.consumedByProvider, input.externalProvider),
    eq(appointmentConfirmationRequests.consumedByEvent, input.externalMessageId),
  )).limit(2);
  // Duplicate consumption records for one event: ambiguous, fail closed.
  if (crows.length > 1) {
    return { found: true, kind: 'conflict', reason: 'duplicate_anchor' };
  }
  const crow = crows[0];
  if (crow) {
    // Binding must match this handler's trusted context — a consumption
    // recorded for another conversation/sender is "consumed elsewhere".
    if (String((crow as any).conversationId) !== String(input.conversationId) ||
      normalizeSenderPhone((crow as any).senderNormalized || '') !== senderNormalized) {
      return { found: true, kind: 'conflict', reason: 'confirmation_anchor_mismatch' };
    }
    return {
      found: true,
      kind: 'confirmation',
      requestId: String((crow as any).id),
      outcome: crow.outcome ?? null,
      appointmentId: crow.appointmentId ?? null,
      appointmentScheduledAt: (crow as any).appointmentScheduledAt ?? null,
      clinicTimezone: (crow as any).clinicTimezone ?? null,
    };
  }
  return { found: false };
}

/**
 * Shared snapshot validator/formatter — the SINGLE point every
 * delivery path (fresh consume, pre-lock replay, in-transaction replay,
 * catch/reconcile) uses to turn a stored `confirmed` anchor into a
 * patient-facing message.
 *
 * Returns a confirmation message ONLY when ALL of the following hold for
 * the consumed request row:
 * - the anchor row is still `consumed` with outcome `confirmed`,
 * - the CURRENT appointment still exists and is `confirmed`,
 * - the CURRENT `scheduled_at` EXACTLY equals the stored snapshot via SQL
 *   column-to-column comparison (PostgreSQL timestamptz precision —
 *   never JS `Date.getTime()`, which rounds microseconds to milliseconds),
 * - the CURRENT patient is still the snapshot patient (a remap to another
 *   patient with the same phone must not send the new patient's name to the
 *   original sender),
 * - the CURRENT patient phone still EXACTLY equals the trusted sender that
 *   answered the prompt.
 * Anything else yields null so the caller escalates instead of rendering a
 * stale confirmation from a changed/cancelled/remapped current row. This is
 * the SINGLE check-to-send for EVERY delivery (fresh consume, same-event
 * replay, catch/reconcile): no caller formats a confirmation any other way.
 *
 * Rendering uses the STORED snapshot instant (JS Date is display-only here)
 * + stored timezone, with an explicit `timeZone` — never the process
 * default. No response text is persisted: snapshot + outcome are sufficient
 * (avoids an extra PII copy); the message is rebuilt deterministically per
 * delivery.
 */
async function buildSnapshotReplayMessage(input: {
  clinicId: string;
  appointmentId: string;
  /** Consumed `confirmed` row holding the snapshot + patient binding. */
  requestId: string;
  /** Trusted webhook sender that answered the prompt (never model-supplied). */
  trustedSenderPhone: string;
}): Promise<string | null> {
  const senderNormalized = normalizeSenderPhone(input.trustedSenderPhone || '');
  if (!senderNormalized) return null;
  const db = getDb();
  const [row] = await db.select({
    appointmentId: appointments.id,
    status: appointments.status,
    patientId: appointments.patientId,
    patientName: patients.name,
    patientPhone: patients.phone,
    snapshotAt: appointmentConfirmationRequests.appointmentScheduledAt,
    snapshotPatientId: appointmentConfirmationRequests.patientId,
    snapshotTimezone: appointmentConfirmationRequests.clinicTimezone,
    snapshotStatus: appointmentConfirmationRequests.status,
    snapshotOutcome: appointmentConfirmationRequests.outcome,
  }).from(appointmentConfirmationRequests)
    .innerJoin(appointments, and(
      eq(appointments.id, appointmentConfirmationRequests.appointmentId),
      eq(appointments.clinicId, input.clinicId),
    ))
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(
      eq(appointmentConfirmationRequests.id, input.requestId),
      eq(appointmentConfirmationRequests.clinicId, input.clinicId),
      eq(appointments.id, input.appointmentId),
      // Integrity comparison at timestamptz microsecond precision, computed
      // SQL-side. JS Date.getTime() would round both sides to milliseconds
      // and wrongly match `.123456` against `.123789`.
      sql`${appointments.scheduledAt} = ${appointmentConfirmationRequests.appointmentScheduledAt}`,
    ))
    .limit(1);
  if (!row) return null;
  if ((row as any).snapshotStatus !== 'consumed' || (row as any).snapshotOutcome !== 'confirmed') return null;
  if ((row as any).status !== 'confirmed') return null;
  if (String((row as any).patientId) !== String((row as any).snapshotPatientId)) return null;
  if (normalizeSenderPhone((row as any).patientPhone || '') !== senderNormalized) return null;
  const snapshotAt = new Date((row as any).snapshotAt as any);
  if (Number.isNaN(snapshotAt.getTime())) return null;
  const timeZone = typeof (row as any).snapshotTimezone === 'string' && (row as any).snapshotTimezone
    ? (row as any).snapshotTimezone as string
    : await getClinicTimezone(input.clinicId);
  return formatConfirmedMessage((row as any).patientName as string, snapshotAt, timeZone);
}

/**
 * Format a patient-facing confirmation message in the clinic's timezone.
 * Every `toLocale*` call carries an explicit `{ timeZone }` — never the
 * process default — so a UTC process still renders a Sao Paulo
 * appointment (12:00Z) as 09:00 local.
 */
export function formatConfirmedMessage(patientName: string, scheduledAt: Date, timeZone: string): string {
  const dateStr = scheduledAt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone });
  const timeStr = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone });
  return `✅ Confirmado, ${patientName}!\n\nSua consulta está confirmada:\n\n📅 ${dateStr}\n⏰ às ${timeStr}\n\nVocê receberá um lembrete no dia anterior. Até logo!`;
}

// ─── Trusted consume path ──────────────────────────────────────────────

export async function processTrustedConfirmation(
  input: TrustedConfirmationInput,
): Promise<ConfirmationResult> {
  // Trust boundary: only webhook-authenticated providers (waha/meta) carry
  // mutation authority. The resolver gates this too, but this export is
  // public — a direct caller must never consume with an unauthenticated or
  // forged provider (e.g. deprecated `evolution`). Fail closed with zero DB
  // work, before replay reads or intent selection.
  if (!isAuthenticatedReplyProvider(input.externalProvider)) {
    return { processed: false, action: 'no_action', reason: 'unauthenticated_provider' };
  }
  // Media-type boundary: only plain persisted 'text' is consumable. An
  // image/audio/document/video caption that normalizes to exactly SIM must
  // never confirm — it escalates for human review instead.
  if (input.messageType !== 'text') {
    return { processed: false, action: 'no_action', reason: 'unsupported_message_type' };
  }
  // Event-time boundary: a missing/invalid inbound event timestamp fails
  // closed — without a trustworthy event time the stale-replay guard below
  // cannot run, so no mutation is allowed.
  const eventTime = parseEventTime(input.receivedAt);
  if (!eventTime) {
    return { processed: false, action: 'no_action', reason: 'missing_event_time' };
  }
  // Rule 1: exact text only. Anything else is not a confirmation and —
  // critically — never a cancellation. Fall through to agent/human.
  if (!isExactConfirmationText(input.content)) {
    return { processed: false, action: 'no_action', reason: 'not_confirmation' };
  }
  const senderNormalized = normalizeSenderPhone(input.senderPhone);
  if (!senderNormalized) {
    return { processed: false, action: 'no_action', reason: 'sender_mismatch' };
  }

  const db = getDb();

  // Idempotent replay: same inbound event already consumed for this
  // (clinic, conversation, sender) → recorded outcome, zero mutation. A
  // `confirmed` anchor re-renders ONLY from its stored snapshot (validated
  // against the current row): a reschedule/cancel after the commit never
  // produces a stale confirmation of the new state.
  const replay = await reconcileConfirmationByEvent({
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    senderPhone: input.senderPhone,
    externalProvider: input.externalProvider,
    externalMessageId: input.externalMessageId,
  });
  if (replay.found && replay.outcome === 'confirmed' && replay.appointmentId) {
    const responseMessage = await buildSnapshotReplayMessage({
      clinicId: input.clinicId,
      appointmentId: replay.appointmentId,
      requestId: replay.requestId as string,
      trustedSenderPhone: input.senderPhone,
    });
    if (responseMessage) {
      return { processed: true, action: 'confirmed', appointmentId: replay.appointmentId, responseMessage };
    }
    return { processed: false, action: 'no_action', reason: 'already_final' };
  }
  if (replay.found) {
    return { processed: false, action: 'no_action', reason: 'already_final' };
  }

  // Rule 4: at most one unexpired pending request exists per (clinic,
  // sender), regardless of appointment/conversation. Zero → nothing to
  // confirm; more than one (legacy rows) → ambiguous, human decides. A
  // sole pending bound to ANOTHER conversation than the inbound one never
  // confirms (`conversation_mismatch`, no mutation): the SIM may answer a
  // different prompt. Never pick arbitrarily.
  const pending = await db.select({
    id: appointmentConfirmationRequests.id,
    conversationId: appointmentConfirmationRequests.conversationId,
    createdAt: appointmentConfirmationRequests.createdAt,
  }).from(appointmentConfirmationRequests).where(and(
    eq(appointmentConfirmationRequests.clinicId, input.clinicId),
    eq(appointmentConfirmationRequests.senderNormalized, senderNormalized),
    eq(appointmentConfirmationRequests.status, 'pending'),
    gt(appointmentConfirmationRequests.expiresAt, new Date()),
  ));
  if (pending.length === 0) {
    return { processed: false, action: 'no_action', reason: 'no_pending' };
  }
  if (pending.length > 1) {
    dbLogger.warn('Ambiguous confirmation: multiple pending requests, routing to human', {
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      count: pending.length,
    });
    return { processed: false, action: 'no_action', reason: 'ambiguous' };
  }
  if (String((pending[0] as any).conversationId) !== String(input.conversationId)) {
    dbLogger.warn('Confirmation conversation mismatch: pending belongs to another conversation, routing to human', {
      clinicId: input.clinicId,
      conversationId: input.conversationId,
    });
    return { processed: false, action: 'no_action', reason: 'conversation_mismatch' };
  }
  // Event-time guard: an old SIM replayed against a future confirmation
  // request (request created after the inbound event) is stale — no
  // mutation. eventTime is guaranteed valid here (checked above).
  const requestedAt = new Date(pending[0].createdAt as any);
  if (isEventTimeStale(requestedAt, eventTime)) {
    return { processed: false, action: 'no_action', reason: 'no_pending' };
  }
  const requestId = pending[0].id;

  // Rule 5: single atomic consume — row lock + conditional appointment
  // update + event-anchored consumption record.
  try {
    const result = await db.transaction(async (tx: any) => {
      // Serialize per clinic BEFORE any intent read: concurrent creation,
      // consume, or waitlist-notify for this clinic waits here (READ COMMITTED).
      await acquireClinicReplyLock(tx, input.clinicId);
      // In-lock anchor re-read: the same event may have been consumed (as a
      // confirmation OR a waitlist scheduling — outcomes live in different
      // tables) after the resolver's pre-lock replay check. Never mutate a
      // different intent for a consumed event: return the stored outcome,
      // or fail closed.
      const anchor = await findEventAnchorInTx(tx, {
        clinicId: input.clinicId,
        conversationId: input.conversationId,
        senderPhone: input.senderPhone,
        externalProvider: input.externalProvider,
        externalMessageId: input.externalMessageId,
      });
      if (anchor.found) {
        if (anchor.kind === 'confirmation' && anchor.outcome === 'confirmed' && anchor.appointmentId) {
          // Return the committed identity plus its consumed row; the
          // patient-facing message is formatted AFTER commit through the
          // shared snapshot validator (no DB/format I/O inside the lock
          // beyond this identity return).
          return {
            outcome: 'confirmed' as const,
            appointmentId: anchor.appointmentId,
            requestId: anchor.requestId,
          };
        }
        // Consumed as a non-confirmed confirmation outcome, or a
        // conflicting/invalid anchor (duplicates, mismatched consumption):
        // a second mutation would be a different intent for the same event
        // — fail closed without writes.
        return { outcome: 'already_final' as const };
      }
      const [locked] = await tx.select({
        id: appointmentConfirmationRequests.id,
        appointmentId: appointmentConfirmationRequests.appointmentId,
        patientId: appointmentConfirmationRequests.patientId,
        status: appointmentConfirmationRequests.status,
        expiresAt: appointmentConfirmationRequests.expiresAt,
        createdAt: appointmentConfirmationRequests.createdAt,
        appointmentScheduledAt: appointmentConfirmationRequests.appointmentScheduledAt,
        clinicTimezone: appointmentConfirmationRequests.clinicTimezone,
      }).from(appointmentConfirmationRequests).where(and(
        eq(appointmentConfirmationRequests.id, requestId),
        eq(appointmentConfirmationRequests.clinicId, input.clinicId),
      )).for('update');
      if (!locked || locked.status !== 'pending') {
        return { outcome: 'already_final' as const };
      }
      // Re-check event-time inside the lock: the request must not postdate
      // the authenticated inbound event (stale replay guard).
      const lockedCreated = new Date(locked.createdAt as any);
      if (isEventTimeStale(lockedCreated, eventTime)) {
        return { outcome: 'no_pending' as const };
      }
      if (new Date(locked.expiresAt as any).getTime() <= Date.now()) {
        await tx.update(appointmentConfirmationRequests).set({
          status: 'expired', outcome: 'expired', updatedAt: new Date(),
        } as any).where(eq(appointmentConfirmationRequests.id, requestId));
        return { outcome: 'expired' as const };
      }
      // Re-read total eligible intent UNDER the clinic lock: exactly one
      // unexpired pending for (clinic, sender) — any appointment or
      // conversation — bound to THIS conversation, and no notified
      // waitlist rival for the same patient. The resolver's pre-count is only
      // a fast path — this is the authoritative serialization point.
      const pendingsUnderLock = await tx.select({
        id: appointmentConfirmationRequests.id,
        conversationId: appointmentConfirmationRequests.conversationId,
      })
        .from(appointmentConfirmationRequests).where(and(
          eq(appointmentConfirmationRequests.clinicId, input.clinicId),
          eq(appointmentConfirmationRequests.senderNormalized, senderNormalized),
          eq(appointmentConfirmationRequests.status, 'pending'),
          gt(appointmentConfirmationRequests.expiresAt, new Date()),
        ));
      if (pendingsUnderLock.length === 0) {
        return { outcome: 'no_pending' as const };
      }
      if (pendingsUnderLock.length > 1) {
        return { outcome: 'ambiguous' as const };
      }
      if (String((pendingsUnderLock[0] as any).conversationId) !== String(input.conversationId)) {
        return { outcome: 'conversation_mismatch' as const };
      }
      // Conditional update: only scheduled → confirmed. Already
      // confirmed/cancelled/completed appointments are left untouched.
      // Patient name is NOT selected here: the post-commit message is rendered
      // via the shared snapshot validator (fresh patient read), so no PII copy
      // travels through the transaction result.
      const [appt] = await tx.select({
        id: appointments.id,
        patientId: appointments.patientId,
        scheduledAt: appointments.scheduledAt,
        status: appointments.status,
        patientPhone: patients.phone,
      }).from(appointments)
        .innerJoin(patients, eq(patients.id, appointments.patientId))
        .where(and(
          eq(appointments.id, locked.appointmentId),
          eq(appointments.clinicId, input.clinicId),
        ))
        .limit(1)
        .for('update');
      // Recipient guard (consume): lock the patient row and require the
      // appointment's patient phone to EXACTLY equal the trusted sender.
      if (appt) {
        const [patientLocked] = await tx.select({ phone: patients.phone })
          .from(patients)
          .where(and(
            eq(patients.id, appt.patientId),
            eq(patients.clinicId, input.clinicId),
          ))
          .limit(1)
          .for('update');
        const lockedPhone = normalizeSenderPhone((patientLocked as any)?.phone || (appt as any).patientPhone || '');
        if (lockedPhone !== senderNormalized) {
          return { outcome: 'sender_mismatch' as const };
        }
        // Patient binding (consume): the appointment's CURRENT patient must
        // still be the snapshot patient. Remapping the appointment to another
        // patient — even one with the same phone — must not send the new
        // patient's name to the original sender. Mismatch fails closed with
        // zero mutation (the stale-event guard keeps redeliveries from
        // falling through onto a newer intent).
        if (String((appt as any).patientId) !== String((locked as any).patientId)) {
          return { outcome: 'sender_mismatch' as const };
        }
      } else {
        // Appointment vanished under lock: consume the stale intent so a
        // redelivery reconciles instead of retrying forever.
        await tx.update(appointmentConfirmationRequests).set({
          status: 'consumed',
          outcome: 'already_final',
          consumedAt: new Date(),
          consumedByProvider: input.externalProvider,
          consumedByEvent: input.externalMessageId,
          updatedAt: new Date(),
        } as any).where(eq(appointmentConfirmationRequests.id, requestId));
        return { outcome: 'already_final' as const };
      }
      // Coexistence guard: a waitlist offer for the same patient that
      // appeared after routing must not be silently overridden — abort
      // WITHOUT writes so the caller escalates instead of double-acting.
      const rivals = await tx.select({ id: waitlist.id }).from(waitlist).where(and(
        eq(waitlist.clinicId, input.clinicId),
        eq(waitlist.patientId, appt.patientId),
        eq(waitlist.status, 'notified'),
      )).limit(1);
      if (rivals.length > 0) {
        return { outcome: 'ambiguous' as const };
      }
      if (appt.status !== 'scheduled') {
        await tx.update(appointmentConfirmationRequests).set({
          status: 'consumed',
          outcome: 'already_final',
          consumedAt: new Date(),
          consumedByProvider: input.externalProvider,
          consumedByEvent: input.externalMessageId,
          updatedAt: new Date(),
        } as any).where(eq(appointmentConfirmationRequests.id, requestId));
        return { outcome: 'already_final' as const };
      }
      // Schedule-snapshot guard: the appointment row is locked (`FOR
      // UPDATE`) and still `scheduled`, but its time must EXACTLY equal the
      // snapshot captured when the intent was created — compared SQL-side,
      // column-to-column, at PostgreSQL timestamptz microsecond precision
      // (never JS `Date.getTime()`, which rounds `.123456` and `.123789` to
      // the same millisecond). A reschedule after the prompt (same status,
      // new `scheduledAt`) means this SIM answers a superseded prompt:
      // consume/anchor the inbound event with `appointment_changed` and
      // mutate NOTHING, so the event can never fall through onto a newer
      // intent. The caller escalates.
      //
      // Residual limitation (by design, no new framework): appointment
      // updates are plain UPDATEs on the same row and the existing
      // `FOR UPDATE` serializes cooperative writers — reschedule writers
      // needed no change for this guarantee. Two races remain: (a) ABA —
      // A→B→A is indistinguishable without monotonic versioning (snapshot
      // equality alone cannot tell a return-to-original apart); (b)
      // check-to-send — a reschedule can land after this final DB
      // validation (or after the post-commit validator read on the fresh
      // path) but before the external send, and DB locks are never
      // held across network I/O. Both escalate-or-accept on redelivery via
      // the snapshot validator; they are not closed here.
      const timeCheck = await tx.execute(sql`
        SELECT (a.scheduled_at = r.appointment_scheduled_at) AS "same"
        FROM appointments a
        JOIN appointment_confirmation_requests r ON r.id = ${requestId}
        WHERE a.id = ${locked.appointmentId} AND a.clinic_id = ${input.clinicId}`);
      const timeSame = ((((timeCheck as any)?.rows ?? []) as Array<{ same: unknown }>)[0]?.same) === true;
      if (!timeSame) {
        await tx.update(appointmentConfirmationRequests).set({
          status: 'consumed',
          outcome: 'appointment_changed',
          consumedAt: new Date(),
          consumedByProvider: input.externalProvider,
          consumedByEvent: input.externalMessageId,
          updatedAt: new Date(),
        } as any).where(eq(appointmentConfirmationRequests.id, requestId));
        return { outcome: 'appointment_changed' as const };
      }
      const updatedAppt = await tx.update(appointments).set({
        status: 'confirmed', updatedAt: new Date(),
      } as any).where(and(
        eq(appointments.id, locked.appointmentId),
        eq(appointments.clinicId, input.clinicId),
        eq(appointments.status, 'scheduled'),
      )).returning({ id: appointments.id });
      if (updatedAppt.length !== 1) {
        // The row changed after our read (concurrent cancel/confirm): the
        // conditional update touched nothing. Consume the stale intent as
        // already_final so redelivery reconciles — and NEVER persist a
        // `confirmed` outcome without the actual row change.
        await tx.update(appointmentConfirmationRequests).set({
          status: 'consumed',
          outcome: 'already_final',
          consumedAt: new Date(),
          consumedByProvider: input.externalProvider,
          consumedByEvent: input.externalMessageId,
          updatedAt: new Date(),
        } as any).where(eq(appointmentConfirmationRequests.id, requestId));
        return { outcome: 'already_final' as const };
      }
      await tx.update(appointmentConfirmationRequests).set({
        status: 'consumed',
        outcome: 'confirmed',
        consumedAt: new Date(),
        consumedByProvider: input.externalProvider,
        consumedByEvent: input.externalMessageId,
        updatedAt: new Date(),
      } as any).where(eq(appointmentConfirmationRequests.id, requestId));
      // Return committed identity + consumed row only. The patient-facing
      // message is built AFTER commit through the shared snapshot validator
      // (no DB lock held during external I/O): a reschedule/cancel/remap
      // landing after this commit yields null and the caller escalates
      // instead of sending a stale confirmation.
      return {
        outcome: 'confirmed' as const,
        appointmentId: locked.appointmentId as string,
        requestId: requestId as string,
      };
    });

    if (result.outcome === 'confirmed') {
      dbLogger.info(`Appointment ${result.appointmentId} confirmed via WhatsApp (exact)`, {
        conversationId: input.conversationId,
      });
      // Fresh consume and same-event replay share one check-to-send: re-validate
      // the CURRENT row against the STORED snapshot AFTER commit (no lock
      // held across this read/send). A reschedule/cancel/remap landing after
      // the commit yields null — do not send; the caller escalates instead of
      // echoing stale state. Residual: this read and the external send are
      // not atomic (no DB lock is ever held across network I/O) — a writer
      // landing between them is caught on redelivery via the same validator.
      const responseMessage = await buildSnapshotReplayMessage({
        clinicId: input.clinicId,
        appointmentId: result.appointmentId,
        requestId: (result as { requestId: string }).requestId,
        trustedSenderPhone: input.senderPhone,
      });
      if (!responseMessage) {
        return { processed: false, action: 'no_action', reason: 'already_final' };
      }
      return {
        processed: true,
        action: 'confirmed',
        appointmentId: result.appointmentId,
        responseMessage,
      };
    }
    return { processed: false, action: 'no_action', reason: result.outcome };
  } catch (err) {
    // Rule 7: unknown persistence outcome — reconcile by inbound event
    // BEFORE any retry. If the event was recorded, honor it; otherwise
    // surface the failure so the outbox redelivers (redelivery replays
    // through the consumption record, never a blind repeat).
    const reconciled = await reconcileConfirmationByEvent({
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      senderPhone: input.senderPhone,
      externalProvider: input.externalProvider,
      externalMessageId: input.externalMessageId,
    });
    if (reconciled.found && reconciled.outcome === 'confirmed' && reconciled.appointmentId && reconciled.requestId) {
      // Unknown-outcome path: the commit may have landed while the response
      // was lost. Re-render ONLY through the shared snapshot validator — a
      // reschedule/cancel/remap between commit and retry yields no stale message.
      const responseMessage = await buildSnapshotReplayMessage({
        clinicId: input.clinicId,
        appointmentId: reconciled.appointmentId,
        requestId: reconciled.requestId,
        trustedSenderPhone: input.senderPhone,
      });
      if (responseMessage) {
        return { processed: true, action: 'confirmed', appointmentId: reconciled.appointmentId, responseMessage };
      }
    }
    if (reconciled.found) {
      return { processed: false, action: 'no_action', reason: 'already_final' };
    }
    throw err;
  }
}

// ─── Shared reply decision (single routing point) ────────────────────

export type ReplyDecision =
  | { kind: 'confirmed'; appointmentId: string; responseMessage: string }
  | { kind: 'waitlist_scheduled'; responseMessage: string }
  | { kind: 'escalate'; reason: string }
  | { kind: 'agent'; reason: string };

/**
 * Unexpired pending confirmations for the trusted (clinic, sender) —
 * across ALL appointments/conversations. A same-conversation pending never
 * hides another conversation's intent: any second pending (or a sole
 * pending bound elsewhere) forces handoff before any consume is attempted.
 */
async function describeConfirmationPendings(input: {
  clinicId: string;
  conversationId: string;
  senderNormalized: string;
}): Promise<{ total: number; soleConversationId: string | null }> {
  const db = getDb();
  const rows = await db.select({
    id: appointmentConfirmationRequests.id,
    conversationId: appointmentConfirmationRequests.conversationId,
  })
    .from(appointmentConfirmationRequests).where(and(
      eq(appointmentConfirmationRequests.clinicId, input.clinicId),
      eq(appointmentConfirmationRequests.senderNormalized, input.senderNormalized),
      eq(appointmentConfirmationRequests.status, 'pending'),
      gt(appointmentConfirmationRequests.expiresAt, new Date()),
    ));
  return {
    total: rows.length,
    soleConversationId: rows.length === 1 ? String((rows[0] as any).conversationId) : null,
  };
}

/**
 * Waitlist candidacy for the trusted sender: 'none' (no patient or no
 * eligible notified entry), 'one' (exactly one patient with exactly one
 * notified entry), or 'ambiguous' (multiple patients or multiple entries).
 *
 * Eligibility is time-bound: only entries notified at or before the
 * authenticated inbound event qualify. An offer created after the event
 * (or with no notify timestamp) can never be accepted by that event — a
 * stale SIM must not consume a fresh offer.
 */
async function describeWaitlistCandidacy(input: {
  clinicId: string;
  senderNormalized: string;
  receivedAt: Date;
}): Promise<'none' | 'one' | 'ambiguous'> {
  const db = getDb();
  // Exact sender equality only — no partial/substring phone matching.
  const fullRows = await db.select({
    id: patients.id, phone: patients.phone,
  }).from(patients).where(eq(patients.clinicId, input.clinicId));
  const exact = fullRows.filter((row) => normalizeSenderPhone(row.phone || '') === input.senderNormalized);
  if (exact.length !== 1) return exact.length === 0 ? 'none' : 'ambiguous';
  const entries = await db.select({ id: waitlist.id, notifiedAt: waitlist.notifiedAt }).from(waitlist).where(and(
    eq(waitlist.clinicId, input.clinicId),
    eq(waitlist.status, 'notified'),
    eq(waitlist.patientId, exact[0].id),
  ));
  if (entries.length !== 1) return entries.length === 0 ? 'none' : 'ambiguous';
  // Single notified entry: it must have been notified at or before the
  // inbound event (compared at provider-clock resolution — see
  // isEventTimeStale). Otherwise the event predates the offer — stale.
  const notifiedAt = entries[0].notifiedAt ? new Date(entries[0].notifiedAt as any) : null;
  if (!notifiedAt || isEventTimeStale(notifiedAt, input.receivedAt)) {
    return 'none';
  }
  return 'one';
}

/**
 * Single routing point for an authenticated inbound WhatsApp reply.
 *
 * - Exact "sim" with exactly one pending confirmation for (clinic, sender)
 *   bound to this conversation and no notified waitlist rival → consume
 *   (confirmed) or escalate on consume failure.
 * - Exact "sim" whose sole plausible context is a notified waitlist row
 *   (preferences only, never a concrete slot) → escalate with
 *   `concrete_offer_required`, no appointment, no writes.
 * - Anything else on the exact-"sim" path (zero/multiple pendings,
 *   coexistence, expired/already-final) → escalate, no mutation.
 * - Reply-like non-exact text ("ok", "não vou", embedded yes) →
 *   escalate without mutation, with or without pending context.
 * - Anything else → 'agent' (normal conversation, existing flow).
 *
 * The function itself performs at most the single atomic consume it was
 * built for; escalation (status change) is the caller's job in the
 * atendimento layer, so this seam never imports cross-module repositories.
 */
export async function resolveInboundReply(
  input: TrustedConfirmationInput,
  opts?: { allowWaitlist?: boolean },
): Promise<ReplyDecision> {
  const allowWaitlist = opts?.allowWaitlist !== false;
  const senderNormalized = normalizeSenderPhone(input.senderPhone);
  if (!senderNormalized) return { kind: 'agent', reason: 'sender_mismatch' };
  const exact = isExactConfirmationText(input.content);
  if (!exact) {
    // Non-exact text never mutates. Reply-like phrases always escalate;
    // any other non-exact text escalates while a confirmation pending
    // exists (the sender is answering the prompt, not chatting) and only
    // reaches the agent with no pending context.
    if (isReplyLikeText(input.content)) return { kind: 'escalate', reason: 'reply_like' };
    const pendings = await describeConfirmationPendings({
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      senderNormalized,
    });
    if (pendings.total > 0) return { kind: 'escalate', reason: 'reply_like' };
    return { kind: 'agent', reason: 'not_reply' };
  }
  // Exact "SIM": mutation authority requires a webhook-authenticated
  // provider (waha/meta). The deprecated unauthenticated `evolution`
  // processor never consumes — escalate without mutation.
  // Media-type boundary: only plain persisted 'text' reaches intent
  // selection. A media caption that normalizes to exactly SIM escalates
  // for human review instead of confirming or scheduling.
  if (input.messageType !== 'text') {
    return { kind: 'escalate', reason: 'unsupported_message_type' };
  }
  // Event-time boundary: mutation requires a trustworthy inbound event
  // time. Missing/invalid → escalate, never mutate.
  const eventTime = parseEventTime(input.receivedAt);
  if (!eventTime) {
    return { kind: 'escalate', reason: 'missing_event_time' };
  }
  // Button boundary: button display-text is only consumable through the
  // button channel (allowWaitlist: false). A button-kind message arriving
  // via the text channel is a routing anomaly — escalate.
  if (input.messageKind === 'button' && allowWaitlist) {
    return { kind: 'escalate', reason: 'unsupported_message_type' };
  }
  if (!isAuthenticatedReplyProvider(input.externalProvider)) {
    return { kind: 'escalate', reason: 'unauthenticated_provider' };
  }
  // Replay BEFORE content/intent routing: the same inbound event
  // redelivered after a commit — even if a new waitlist offer or a new
  // pending appeared afterwards — returns the stored result instead of
  // selecting a new intent. BOTH anchor types are queried before any early
  // return: the confirmation anchor (authoritative) and the deprecated
  // waitlist anchor (always absent since scheduling was disabled). If both
  // are ever found, or either reports an invalid/mismatched anchor, the
  // resolver escalates fail-closed rather than returning one result.
  const confirmReplay = await reconcileConfirmationByEvent({
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    senderPhone: input.senderPhone,
    externalProvider: input.externalProvider,
    externalMessageId: input.externalMessageId,
  });
  const wlReplay = allowWaitlist
    ? await reconcileWaitlistByEvent({
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      senderPhone: input.senderPhone,
      externalProvider: input.externalProvider,
      externalMessageId: input.externalMessageId,
    })
    : { found: false as const };
  if (confirmReplay.found && (wlReplay as { found?: boolean }).found) {
    return { kind: 'escalate', reason: 'already_final' };
  }
  if (confirmReplay.found && confirmReplay.outcome === 'confirmed' && confirmReplay.appointmentId && confirmReplay.requestId) {
    // Same-event replay of a committed consume: ONLY the stored snapshot
    // (validated against the current row, patient, and trusted sender) may
    // re-render. A reschedule, cancel, or patient remap after the commit
    // escalates instead of echoing stale state.
    const responseMessage = await buildSnapshotReplayMessage({
      clinicId: input.clinicId,
      appointmentId: confirmReplay.appointmentId,
      requestId: confirmReplay.requestId,
      trustedSenderPhone: input.senderPhone,
    });
    if (responseMessage) {
      return { kind: 'confirmed', appointmentId: confirmReplay.appointmentId, responseMessage };
    }
    return { kind: 'escalate', reason: 'already_final' };
  }
  if (confirmReplay.found) {
    return { kind: 'escalate', reason: 'already_final' };
  }
  if ((wlReplay as { found?: boolean }).found) {
    return { kind: 'escalate', reason: 'already_final' };
  }
  const pendings = await describeConfirmationPendings({
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    senderNormalized,
  });
  const wl = allowWaitlist
    ? await describeWaitlistCandidacy({
      clinicId: input.clinicId,
      senderNormalized,
      receivedAt: eventTime,
    })
    : 'none';
  if (pendings.total === 1 && wl === 'none') {
    // The sole pending must belong to THIS conversation: a SIM arriving
    // on another conversation may answer a different prompt — handoff
    // before any consume is attempted.
    if (pendings.soleConversationId !== null && pendings.soleConversationId !== String(input.conversationId)) {
      return { kind: 'escalate', reason: 'conversation_mismatch' };
    }
    const res = await processTrustedConfirmation(input);
    if (res.processed && res.responseMessage) {
      return { kind: 'confirmed', appointmentId: res.appointmentId as string, responseMessage: res.responseMessage };
    }
    return { kind: 'escalate', reason: res.reason ?? 'consume_failed' };
  }
  if (pendings.total === 0 && wl === 'one') {
    // Waitlist scheduling is DISABLED: waitlist rows store only preferences
    // (`preferred_date`/`preferred_time`), never a concrete offered slot,
    // and no production confirmation-prompt emitter exists. A SIM that could
    // answer a notified waitlist entry escalates for a human with a concrete
    // offer — it never creates an appointment. No writes are performed here
    // or in `processTrustedWaitlistResponse`.
    return { kind: 'escalate', reason: 'concrete_offer_required' };
  }
  // Zero/multiple pendings, any ambiguity, coexistence of a confirmation
  // pending with a waitlist offer, or a button tap with no single valid
  // pending (allowWaitlist=false): escalate, never select arbitrarily and
  // never run both parsers.
  if (pendings.total > 1 || wl === 'ambiguous' || (pendings.total >= 1 && wl !== 'none')) {
    return { kind: 'escalate', reason: 'ambiguous' };
  }
  return { kind: 'escalate', reason: 'no_pending' };
}

// ─── Waitlist (DISABLED — preferences are not an offer) ────────────────

/**
 * Disabled waitlist response path.
 *
 * Waitlist rows store only preferences (`preferred_date`/
 * `preferred_time_start`), never a concrete offered slot, and no production
 * confirmation-prompt emitter exists — so a preference can never imply a
 * concrete slot is offered. A `SIM` that could answer a notified waitlist
 * entry escalates with `concrete_offer_required` and never creates an
 * appointment, until a concrete offer contract exists (not built here: no
 * offer schema/sender/discovery in this task).
 *
 * This export is kept so direct callers cannot bypass the resolver: it
 * fails closed BEFORE any database write with
 * `{ processed: false, reason: 'concrete_offer_required' }` for exact-SIM
 * input. Trust/media/event guards run first (same as confirmation) so
 * unauthenticated, non-text, button, dateless, or non-SIM input keeps its
 * specific fail-closed reason — still with zero writes.
 */
export async function processTrustedWaitlistResponse(
  input: TrustedConfirmationInput,
): Promise<{ processed: boolean; scheduled?: boolean; responseMessage?: string; reason?: string }> {
  if (!isAuthenticatedReplyProvider(input.externalProvider)) {
    return { processed: false, reason: 'unauthenticated_provider' };
  }
  if (input.messageType !== 'text') {
    return { processed: false, reason: 'unsupported_message_type' };
  }
  if (input.messageKind === 'button') {
    return { processed: false, reason: 'unsupported_message_type' };
  }
  if (!parseEventTime(input.receivedAt)) {
    return { processed: false, reason: 'missing_event_time' };
  }
  if (!isExactConfirmationText(input.content)) {
    return { processed: false, reason: 'not_confirmation' };
  }
  if (!normalizeSenderPhone(input.senderPhone)) {
    return { processed: false, reason: 'sender_mismatch' };
  }
  // Exact SIM from a trusted sender: preferences alone never authorize a
  // booking. Escalate for a human with a concrete offer. No DB I/O, no writes.
  return { processed: false, reason: 'concrete_offer_required' };
}
export interface AuthenticInboundEvent {
  messageId: string;
  conversationId: string;
  content: string;
  externalProvider: string;
  externalMessageId: string;
  createdAt: Date | null;
  eventTime: Date | null;
  senderPhone: string;
  messageType: string;
  messageKind: 'text' | 'button';
}

const AUTHENTICATED_INBOUND_PROVIDERS = ['waha', 'meta'] as const;

export async function findAuthenticInboundEvent(
  clinicId: string,
  conversationId: string,
  externalMessageId: string,
): Promise<AuthenticInboundEvent | null> {
  if (!clinicId || !conversationId || !externalMessageId) return null;
  const db = getDb();
  const result = await db.execute(sql`
    SELECT m.id AS "messageId", m.conversation_id AS "conversationId", m.content, m.direction,
           m.external_provider AS "externalProvider", m.external_message_id AS "externalMessageId",
           m.created_at AS "createdAt", m.message_type AS "messageType", m.metadata,
           c.external_id AS "senderPhone", c.channel, c.clinic_id AS "clinicId"
    FROM messages m
    INNER JOIN conversations c ON c.id = m.conversation_id
    WHERE c.id = ${conversationId} AND c.clinic_id = ${clinicId}
      AND m.conversation_id = ${conversationId} AND m.external_message_id = ${externalMessageId}
    LIMIT 2`);
  const rows = (((result as any)?.rows ?? []) as Array<any>);
  if (rows.length !== 1) return null;
  const r = rows[0] as any;
  if (String(r.channel) !== 'whatsapp') return null;
  if (String(r.direction) !== 'inbound') return null;
  if (!(AUTHENTICATED_INBOUND_PROVIDERS as readonly string[]).includes(String(r.externalProvider))) return null;
  if (String(r.clinicId) !== String(clinicId)) return null;
  if (!r.content || typeof r.content !== 'string') return null;
  if (!r.senderPhone || typeof r.senderPhone !== 'string' || !r.senderPhone) return null;
  const meta = (r.metadata ?? {}) as Record<string, unknown>;
  const rawEventTime = meta.authenticatedEventAt;
  let eventTime: Date | null = null;
  if (typeof rawEventTime === 'string' && rawEventTime.length > 0) {
    const parsed = new Date(rawEventTime);
    if (!Number.isNaN(parsed.getTime())) eventTime = parsed;
  }
  return {
    messageId: String(r.messageId),
    conversationId: String(r.conversationId),
    content: r.content as string,
    externalProvider: String(r.externalProvider),
    externalMessageId: String(r.externalMessageId),
    createdAt: (r.createdAt as Date | null) ?? null,
    eventTime,
    senderPhone: r.senderPhone as string,
    messageType: typeof r.messageType === 'string' ? r.messageType : 'text',
    messageKind: (r.metadata as Record<string, unknown> | null)?.button_response === true ? 'button' : 'text',
  };
}

export const obterEventoInboundAutentico = findAuthenticInboundEvent;
