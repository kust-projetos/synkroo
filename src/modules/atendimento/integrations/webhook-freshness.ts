/**
 * Webhook freshness / replay guard for inbound transports.
 *
 * Evolution API has no native webhook HMAC: authentication here is the
 * per-installation shared secret (see `resolve-channel-installation.ts`) and
 * dedup by provider event id (`persistInboundMessage` → unique
 * `(externalProvider, externalMessageId)`). This module closes the remaining
 * audit gap: a freshness window so a captured, still-authenticated payload
 * cannot be replayed long after it was emitted.
 *
 * Never throws: every entry point returns `boolean` (`true` = fresh) or
 * `null` (no usable timestamp) and swallows malformed input fail-closed
 * (`false`) or as absent (`null`), letting callers decide.
 */

/** Default maximum age of an accepted webhook event (10 min). */
export const WEBHOOK_MAX_AGE_SEC = 600;

/** Default maximum accepted clock skew into the future (5 min). */
export const WEBHOOK_MAX_SKEW_SEC = 300;

export type FreshnessOptions = {
  maxAgeSec?: number;
  maxSkewSec?: number;
  /** Injected clock for deterministic tests. Defaults to `Date.now()`. */
  nowMs?: number;
};

export type FreshnessTimestampInput =
  | { timestampMs: unknown }
  | { timestampSec: unknown };

function toPositiveFiniteMs(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

function resolveLimits(options?: FreshnessOptions): { maxAgeSec: number; maxSkewSec: number; nowMs: number } {
  return {
    maxAgeSec: options?.maxAgeSec ?? resolveEnvPositiveInt('WEBHOOK_MAX_AGE_SEC') ?? WEBHOOK_MAX_AGE_SEC,
    maxSkewSec: options?.maxSkewSec ?? resolveEnvPositiveInt('WEBHOOK_MAX_SKEW_SEC') ?? WEBHOOK_MAX_SKEW_SEC,
    nowMs: options?.nowMs ?? Date.now(),
  };
}

function resolveEnvPositiveInt(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/**
 * Returns `true` when `timestampMs` (epoch milliseconds) is inside the
 * freshness window: not older than `maxAgeSec` and not more than
 * `maxSkewSec` in the future. Boundary is inclusive on both sides.
 * Never throws; malformed input returns `false`.
 */
export function assertWebhookFreshness(
  input: FreshnessTimestampInput,
  options?: FreshnessOptions,
): boolean {
  try {
    const { maxAgeSec, maxSkewSec, nowMs } = resolveLimits(options);
    if (!Number.isFinite(nowMs)) return false;
    let tsMs: number | null = null;
    if ('timestampMs' in input) {
      tsMs = toPositiveFiniteMs(input.timestampMs);
    } else if ('timestampSec' in input) {
      const sec = toPositiveFiniteMs(input.timestampSec);
      tsMs = sec === null ? null : sec * 1000;
    }
    if (tsMs === null) return false;
    const ageSec = (nowMs - tsMs) / 1000;
    // Future beyond skew → reject; past beyond window → reject.
    if (ageSec < -maxSkewSec) return false;
    if (ageSec > maxAgeSec) return false;
    return true;
  } catch {
    return false;
  }
}

/** Parses an ISO-8601 string to epoch ms. Returns `null` when unparseable. Never throws. */
export function parseIsoTimestampToMs(value: unknown): number | null {
  try {
    if (typeof value !== 'string' || value.trim() === '') return null;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return ms;
  } catch {
    return null;
  }
}

/**
 * Extracts the best available Evolution event timestamp (epoch ms).
 *
 * Prefers `data.messageTimestamp` (epoch **seconds**, the actual message
 * creation time — the replay-relevant clock) and falls back to the
 * top-level `date_time` (ISO-8601, Evolution server clock).
 * Returns `null` when no usable timestamp is present. Never throws.
 */
export function extractEvolutionTimestampMs(body: unknown): number | null {
  try {
    if (!body || typeof body !== 'object') return null;
    const root = body as Record<string, unknown>;
    const data = root.data;
    if (data && typeof data === 'object') {
      const msgTs = (data as Record<string, unknown>).messageTimestamp;
      const sec = toPositiveFiniteMs(msgTs);
      if (sec !== null) return sec * 1000;
    }
    const iso = parseIsoTimestampToMs(root.date_time);
    if (iso !== null) return iso;
    return null;
  } catch {
    return null;
  }
}
