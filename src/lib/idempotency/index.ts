/**
 * Idempotency Helper (ADR-BASE-13: Cloudflare Queues)
 *
 * Garante at-least-once com idempotency key em todo side effect assíncrono.
 * Usado por jobs enfileirados via Cloudflare Queues.
 *
 * Padrão: producer gera idempotency key, consumer verifica antes de executar.
 */

import { getDb } from '@/lib/db/client';
import { idempotencyKeys } from '@/lib/db/schema/infra';
import { eq, and } from 'drizzle-orm';
import { dbLogger } from '@/lib/logger';

/**
 * Check if an idempotency key has already been processed.
 * Returns true if the key exists and was successfully processed.
 */
export async function isIdempotencyKeyProcessed(key: string): Promise<boolean> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ status: idempotencyKeys.status })
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key))
      .limit(1);
    return row?.status === 'completed';
  } catch {
    return false;
  }
}

/**
 * Claim an idempotency key atomically.
 * Returns true if this caller successfully claimed the key.
 * If the key already exists (completed or in-progress), returns false.
 */
export async function tryClaimIdempotencyKey(
  key: string,
  jobType: string,
  ttlSeconds = 3600,
): Promise<boolean> {
  const db = getDb();
  try {
    // INSERT ... ON CONFLICT DO NOTHING — atomic claim
    await db
      .insert(idempotencyKeys)
      .values({
        key,
        jobType,
        status: 'in_progress',
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      })
      .onConflictDoNothing();
    return true;
  } catch (err) {
    // If duplicate key error, someone else claimed it
    dbLogger.warn('Idempotency key conflict', { key, jobType });
    return false;
  }
}

/**
 * Mark an idempotency key as completed.
 */
export async function markIdempotencyKeyCompleted(key: string): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(idempotencyKeys)
      .set({ status: 'completed' })
      .where(eq(idempotencyKeys.key, key));
  } catch (err) {
    dbLogger.error('Failed to mark idempotency key completed', err, { key });
  }
}

/**
 * Mark an idempotency key as failed (allows retry if not expired).
 */
export async function markIdempotencyKeyFailed(key: string, error: string): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(idempotencyKeys)
      .set({ status: 'failed', error })
      .where(eq(idempotencyKeys.key, key));
  } catch (err) {
    dbLogger.error('Failed to mark idempotency key failed', err, { key });
  }
}

/**
 * Execute a job with idempotency guarantee.
 * If the key was already processed, returns 'already_processed'.
 * If the key was claimed by another instance, returns 'conflict'.
 * Otherwise, executes the handler and marks completed/failed.
 */
export async function withIdempotency<T>(
  key: string,
  jobType: string,
  handler: () => Promise<T>,
): Promise<{ status: 'completed' | 'already_processed' | 'conflict'; result?: T }> {
  // Already done?
  if (await isIdempotencyKeyProcessed(key)) {
    return { status: 'already_processed' };
  }

  // Claim it
  const claimed = await tryClaimIdempotencyKey(key, jobType);
  if (!claimed) {
    return { status: 'conflict' };
  }

  // Execute
  try {
    const result = await handler();
    await markIdempotencyKeyCompleted(key);
    return { status: 'completed', result };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await markIdempotencyKeyFailed(key, errorMsg);
    throw err; // Re-throw for Queue retry
  }
}
