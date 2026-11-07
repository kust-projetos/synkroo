/**
 * Static lock-order / transaction-safety characterization for the WhatsApp
 * reply path (no DB required — runs in the default unit suite).
 *
 * Universal rule under test: the per-clinic advisory lock
 * (`acquireClinicLock`) is acquired BEFORE any business row lock
 * (`FOR UPDATE`) in every cooperative writer. The inverse order (row lock
 * → advisory lock) deadlocks against the reply consumers, which take the
 * advisory lock first.
 *
 * Also pins two Postgres-correctness invariants:
 * - `createConfirmationRequest` never catches a 23505 inside the open
 *   transaction (that aborts it; later statements fail with 25P02). The
 *   conflict path is `ON CONFLICT DO NOTHING` on the partial unique index
 *   plus a re-read under the same lock.
 * - `processTrustedConfirmation` requires exactly one row from the
 *   conditional appointment update before persisting a `confirmed` outcome.
 * - `processTrustedWaitlistResponse` is DISABLED: it fails closed with
 *   `concrete_offer_required` before any DB write and never books from
 *   waitlist preferences (no `accepted_*` anchors, no appointment insert).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(__dirname, rel), 'utf8');
}

function fnBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  if (start < 0) throw new Error(`function ${name} not found`);
  const next = source.indexOf('\nexport ', start + 1);
  return next < 0 ? source.slice(start) : source.slice(start, next);
}

function stripComments(code: string): string {
  // Doc wording legitimately mentions row-lock syntax ("FOR UPDATE"), so
  // both sides of the ordering check must use comment-stripped coordinates —
  // mixing raw indexes (lock) with stripped indexes (row locks) reports a
  // false inversion whenever a comment block precedes the lock call.
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^\S\r\n])\/\/.*$/gm, '$1');
}

function rowLockIndexes(body: string): number[] {
  const code = stripComments(body);
  return [
    code.indexOf(".for('update')"),
    code.indexOf('.for("update")'),
    code.indexOf('FOR UPDATE'),
  ].filter((i) => i >= 0);
}

function expectLockBeforeRowLocks(body: string, label: string): void {
  const lockAt = stripComments(body).indexOf('acquireClinicLock');
  expect(lockAt).toBeGreaterThan(-1);
  for (const rowAt of rowLockIndexes(body)) {
    expect(rowAt).toBeGreaterThan(lockAt);
  }
}

// Confirmation writers serialize on the shared per-clinic reply lock
// (`acquireClinicReplyLock`), the same cooperative contract as the waitlist
// writers above (different helper name, same lock family). Both writers must
// take it before any business row lock (`.for('update')` / `FOR UPDATE`).
// Coordinates use the comment-stripped body on both sides so doc wording
// that mentions row-lock syntax never reports a false inversion. String
// literals are code here (SQL templates carry the real `FOR UPDATE`), not
// prose. Pre-transaction read-only fast paths in `processTrustedConfirmation`
// (pending pre-count, reconcile replay check) intentionally run outside the
// lock and are re-validated under it — only in-transaction row locks are
// pinned here.
function expectReplyLockBeforeRowLocks(body: string, label: string): void {
  const lockAt = stripComments(body).indexOf('acquireClinicReplyLock');
  expect(lockAt).toBeGreaterThan(-1);
  for (const rowAt of rowLockIndexes(body)) {
    expect(rowAt).toBeGreaterThan(lockAt);
  }
}

describe('whatsapp reply lock order + transaction safety (static)', () => {
  const legacyRepo = readSrc('../waitlist/index.ts');
  const scopedRepo = readSrc('../../modules/operacional/repositories/waitlist-repository.ts');
  const confirmations = readSrc('../../modules/operacional/services/confirmation-service.ts');

  it('legacy waitlist writers take the advisory lock before any row lock', () => {
    expectLockBeforeRowLocks(fnBody(legacyRepo, 'updateEntry'), 'updateEntry');
    expectLockBeforeRowLocks(fnBody(legacyRepo, 'markNotified'), 'markNotified');
  });

  it('scoped waitlist writers take the advisory lock before any row lock', () => {
    expectLockBeforeRowLocks(fnBody(scopedRepo, 'updateWaitlist'), 'updateWaitlist');
    const scopedBody = fnBody(scopedRepo, 'updateWaitlistScoped');
    expect(scopedBody.indexOf('acquireClinicLock')).toBeGreaterThan(-1);
    expectLockBeforeRowLocks(scopedBody, 'updateWaitlistScoped');
  });

  it('confirmation writers take the clinic reply lock before any row lock', () => {
    expectReplyLockBeforeRowLocks(fnBody(confirmations, 'createConfirmationRequest'), 'createConfirmationRequest');
    expectReplyLockBeforeRowLocks(fnBody(confirmations, 'processTrustedConfirmation'), 'processTrustedConfirmation');
  });

  it('insertWaitlist rejects direct notified creation (no unserialized intent)', () => {
    const body = fnBody(scopedRepo, 'insertWaitlist');
    expect(body).toContain('notified');
    expect(body).toContain('must be created as waiting');
    expect(body).toContain("throw new ActionError('invalid_input'");
  });

  it('createConfirmationRequest uses ON CONFLICT DO NOTHING, never a 23505 catch in-tx', () => {
    const body = fnBody(confirmations, 'createConfirmationRequest');
    expect(body).toContain('ON CONFLICT');
    expect(body).toContain('DO NOTHING');
    expect(body).not.toContain('23505');
    expect(body).not.toContain('catch');
  });

  it('confirmation consume requires exactly one conditional appointment update', () => {
    const body = fnBody(confirmations, 'processTrustedConfirmation');
    expect(body).toContain('.returning({ id: appointments.id })');
    expect(body).toContain('length !== 1');
    expect(body).toContain('already_final');
  });

  it('disabled waitlist response fails closed with concrete_offer_required before any write', () => {
    const body = fnBody(confirmations, 'processTrustedWaitlistResponse');
    expect(body).toContain('concrete_offer_required');
    expect(body).not.toContain('.insert(appointments)');
    expect(body).not.toContain('acceptedByProvider');
    expect(body).not.toContain('accepted_by_provider');
    expect(body).not.toContain('WAITLIST_RACE_ROLLBACK');
  });

  it('createConfirmationRequest persists the exact snapshot via INSERT...SELECT (never a JS Date param)', () => {
    const body = fnBody(confirmations, 'createConfirmationRequest');
    expect(body).toContain('INSERT INTO appointment_confirmation_requests');
    expect(body).toContain('a.patient_id');
    expect(body).toContain('a.scheduled_at');
    expect(body).toContain('ON CONFLICT');
    // The snapshot timestamp must never travel as a JS Date parameter:
    // timestamptz microseconds would round to milliseconds.
    expect(body).not.toContain('${appointmentScheduledAt}');
  });

  it('createConfirmationRequest fails closed on conversation mismatch and superseded prompts', () => {
    const body = fnBody(confirmations, 'createConfirmationRequest');
    expect(body).toContain('another conversation');
    expect(body).toContain('handoff required');
    expect(body).toContain('appointment_changed');
  });

  it('snapshot replay requires trusted sender + SQL column equality + patient binding', () => {
    const start = confirmations.indexOf('async function buildSnapshotReplayMessage');
    expect(start).toBeGreaterThan(-1);
    const next = confirmations.indexOf('\nexport ', start + 1);
    const body = next < 0 ? confirmations.slice(start) : confirmations.slice(start, next);
    expect(body).toContain('trustedSenderPhone');
    expect(body).toContain('snapshotPatientId');
    expect(body).toContain('= ${appointmentConfirmationRequests.appointmentScheduledAt}');
  });

  it('event anchor is a UNIQUE partial index (one consume record per provider event)', () => {
    const schema = readSrc('../../modules/operacional/schema/appointments.ts');
    expect(schema).toContain(`uniqueIndex('appt_confirm_event_idx')`);
    expect(schema).toContain('IS NOT NULL');
  });
});
