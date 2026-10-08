/**
 * POST /api/whatsapp/waha — inbound WAHA webhook (vNext P3.3, DORMANT).
 *
 * Transport leaf for the WAHA provider inbound direction, mirroring the runbook
 * pipeline (docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md §7.3):
 *
 *   in-memory rate limit → bounded raw-body read → HMAC → parse/allowlist
 *   → atendimento module gate → enabled session/installation resolve
 *   → identify/normalize direct inbound message → signed freshness/replay
 *   → durable dedup + receberMensagem Action
 *
 * DORMANT BY DESIGN: nothing here registers WAHA as a provider, provisions a
 * secret or selects the engine. Without a `waha` channel installation and a
 * valid signature every request is denied/ignored, so the route can be deployed
 * and exercised locally without any live WAHA.
 *
 * Security posture (see the P3 security advisory):
 * - The in-memory webhook rate limiter runs FIRST, ahead of reading the body or
 *   computing the HMAC, so unauthenticated traffic with well-formed headers
 *   cannot repeatedly consume the byte/time budget. It is supplemental only
 *   (in-memory, per-instance): a Cloudflare edge rate limit stays an ops gate.
 *   In production its identity is `CF-Connecting-IP` alone — the spoofable
 *   `X-Forwarded-For`/`X-Real-IP` are never used, not even as a fallback.
 * - `WAHA_WEBHOOK_HMAC_KEY` is server-only and read INSIDE the handler, because
 *   OpenNext/Workers populates `process.env` per request and NOT at module-init.
 *   No dev bypass and no fallback: missing/short key fails closed with 503.
 * - The signature covers the EXACT raw POST bytes, so the body is read from the
 *   request stream under a hard byte cap AND a hard deadline (an oversized body
 *   is cancelled; a stalled one is abandoned as `timeout`/408), and the HMAC is
 *   verified BEFORE any JSON parse. `Content-Length` is never trusted: a
 *   lying/absent header changes nothing, and there is no whole-body
 *   `arrayBuffer()` fallback that would allocate past the cap.
 * - `session` — never a body/header `clinicId` — resolves the tenant through
 *   the STRICT `resolveWahaInstallationStrict({ provider: 'waha' })`, which
 *   distinguishes "unknown session" (acknowledge) from "lookup unavailable"
 *   (503, so the provider retries instead of the message being dropped).
 * - Only the `message` event with `fromMe === false` and a direct
 *   `<digits>@c.us` sender is processed; groups/broadcast/LID/newsletter and
 *   unknown ids are acknowledged with no side effect. No `@…` is stripped and
 *   `_data` is never read: engine-internal data can differ per engine and must
 *   never become a phone, a body or persisted state.
 * - Freshness uses the SIGNED root `timestamp` (milliseconds) only.
 *   `X-Webhook-Timestamp` is a separate UNSIGNED header and `payload.timestamp`
 *   is the message clock — neither may stand in for the signed root timestamp.
 *   It is checked after identification, so an event we would never store (echo,
 *   unsupported sender) is acknowledged once instead of being retried forever.
 * - Dedup identity is server-side and session-scoped (`${session}:${payload.id}`)
 *   so the same WAHA message id from two sessions never collides, and no
 *   header/request id ever becomes a message identity.
 * - A transient failure (tenant lookup or durable persistence) answers a generic
 *   retryable 503 rather than a 200: acknowledging an unstored message would
 *   lose it permanently, and inbound dedup makes the retry safe.
 * - Responses are minimal acks (no internal conversation/message ids) and logs
 *   carry fixed reason/event categories only — never a secret, signature,
 *   body, phone, session, `_data` or media URL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { whatsappLogger } from '@/lib/logger';
import { apiRateLimited, generateRequestId } from '@/lib/api/response';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { runAtendimentoSystemActionResult } from '@/modules/atendimento/ui/route-adapter';
import { resolveWahaInstallationStrict } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { assertWebhookFreshness } from '@/modules/atendimento/integrations/webhook-freshness';
import { receberMensagem } from '@/modules/atendimento/actions/receber-mensagem';
import { withModuleRoute } from '@/core/modules/gates';

export const dynamic = 'force-dynamic';

/** Hard cap on the raw request body we are willing to buffer (256 KiB). */
const MAX_BODY_BYTES = 256 * 1024;
/**
 * End-to-end deadline for the pre-HMAC body read.
 *
 * A provider that opens the request and then stalls would otherwise pin a
 * worker on an unbounded `reader.read()`. This bounds the whole read, so a
 * slowloris-style POST cannot hold a runtime slot open indefinitely.
 */
const BODY_READ_DEADLINE_MS = 10_000;
/** A short webhook secret is a configuration error, not a usable key. */
const MIN_HMAC_KEY_LENGTH = 32;
/** WAHA signs with sha512 and labels the algorithm explicitly. */
const HMAC_ALGORITHM = 'sha512';
/** sha512 → 64 bytes → 128 hex characters. */
const HMAC_HEX_LENGTH = 128;
/** WAHA direct chat JID suffix; groups/LID/broadcast/newsletter are out of scope. */
const DIRECT_CHAT_SUFFIX = '@c.us';
/** E.164 upper bound for the sender digits. */
const MAX_E164_DIGITS = 15;
/**
 * Exactly `<digits>@c.us`, built from the bounds above so the pattern and the
 * documented limits cannot drift apart. The `.` is escaped on purpose: an
 * unescaped one would also accept `@cXus`.
 */
const DIRECT_CHAT_PATTERN = new RegExp(`^(\\d{1,${MAX_E164_DIGITS}})${DIRECT_CHAT_SUFFIX.replace('.', '\\.')}$`);

/** Session names are provider-side labels, not free-form text. */
const MAX_SESSION_LENGTH = 64;
const SESSION_PATTERN = new RegExp(`^[A-Za-z0-9._-]{1,${MAX_SESSION_LENGTH}}$`);
/** Bounded so `${session}:${id}` always fits the Action's 255-char dedup id. */
const MAX_MESSAGE_ID_LENGTH = 160;
const MAX_EXTERNAL_MESSAGE_ID_LENGTH = 255;
/** Bound of the inbound Action (`receberMensagem`) message field. */
const MAX_CONTENT_CHARS = 32_000;
/**
 * Appended when content is cut, so a truncated message is never mistaken for a
 * complete one by the agent that reads it downstream.
 */
const TRUNCATION_MARKER = '…';

/** Only `message` is allowlisted; every other event is acknowledged, never processed. */
const ALLOWED_EVENT = 'message';

/**
 * Cloudflare's client-IP header on the Workers/OpenNext path.
 *
 * Cloudflare sets it from the real TCP peer and Cloudflare recommends it over
 * `X-Forwarded-For`, which any client can set. It is the ONLY identity the
 * limiter is allowed to trust in production.
 */
const CF_CLIENT_IP_HEADER = 'cf-connecting-ip';
/**
 * Upper bound for the accepted CF client IP.
 *
 * Comfortably above the longest textual IPv6 form and below anything an
 * attacker would use to grow a key, so a hostile header can never become an
 * unbounded limiter key.
 */
const MAX_CF_CLIENT_IP_LENGTH = 64;
/**
 * The single fail-safe bucket for requests with no usable CF client IP.
 *
 * A fixed value — never derived from anything in the request — so a missing or
 * malformed header collapses every unidentified caller into ONE shared quota
 * instead of handing each forged `X-Forwarded-For` a fresh one. A misrouted
 * origin (traffic that never crossed the edge) costs shared capacity; that is
 * the intended trade, and it is loud in the logs rather than silent.
 */
const MISSING_CF_CLIENT_IP_KEY = 'unknown-cf-client';

const DOCUMENT_MIMETYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
]);

type MessageType = 'text' | 'image' | 'audio' | 'document';

type RawBody =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: 'too_large' | 'timeout' | 'unreadable' };

type NormalizedContent = { content: string; messageType: MessageType };

/** Minimal acks: no internal conversation/message identifier ever leaves here. */
const ACK_OK = { status: 'ok' } as const;
const ACK_IGNORED = { status: 'ignored' } as const;
/**
 * Generic retryable failure.
 *
 * Deliberately identical for a resolver outage and a persistence failure: the
 * provider only needs to know to retry, and a shared opaque body keeps the
 * endpoint from reporting which internal dependency is unhealthy.
 */
const GENERIC_UNAVAILABLE = { error: 'Unable to process message' } as const;

/**
 * A transient internal failure — the message was NOT durably stored, so the
 * provider must retry. Acknowledging it with 200 would drop the message for
 * good; inbound dedup makes the retry safe.
 */
function unavailableResponse(): NextResponse {
  return NextResponse.json(GENERIC_UNAVAILABLE, { status: 503 });
}

/**
 * Reads the server-only HMAC key at CALL TIME.
 *
 * `process.env` is populated per request under OpenNext/Workers, so reading it
 * here is what makes the key reachable; reading it at module scope would freeze
 * an empty value. Missing or short key fails closed — there is no dev bypass.
 */
function resolveHmacKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = typeof env.WAHA_WEBHOOK_HMAC_KEY === 'string' ? env.WAHA_WEBHOOK_HMAC_KEY.trim() : '';
  return raw.length >= MIN_HMAC_KEY_LENGTH ? raw : null;
}

/** Denies with a fixed, non-revealing category. Never logs the key. */
function logDenied(reason: string): void {
  whatsappLogger.warn('waha webhook denied', { event: ALLOWED_EVENT, reason });
}

/**
 * Best-effort release of a stream we are discarding.
 *
 * `cancel()` may return a promise that never settles, so it is never awaited and
 * never allowed to throw — the body is being abandoned either way.
 */
function cancelQuietly(reader: { cancel?: (reason?: unknown) => unknown } | null): void {
  try {
    const result = reader?.cancel?.();
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      void (result as Promise<unknown>).catch(() => undefined);
    }
  } catch {
    // best effort: the stream is already abandoned
  }
}

/**
 * Buffers the ACTUAL request bytes under a hard cap and a hard deadline.
 *
 * Streams only: the declared `Content-Length` is never consulted (it is
 * attacker- and proxy-controlled) and there is deliberately NO `arrayBuffer()`
 * fallback, because that would allocate the entire body before the cap could be
 * applied. A runtime with no readable stream fails closed instead.
 *
 * Obtaining the reader is itself guarded: `getReader()` throws SYNCHRONOUSLY on
 * a locked/disturbed stream, and an unguarded call would escape as a framework
 * 500 instead of a controlled denial. It happens before the deadline timer
 * exists, so this path has nothing to clean up.
 *
 * Every in-flight `read()` carries a rejection handler from the moment it is
 * created, so abandoning it at the deadline cannot later surface as an
 * unhandled rejection.
 */
async function readRawBody(request: Request, maxBytes: number, deadlineMs: number): Promise<RawBody> {
  const stream = (request as { body?: { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } | null }).body;
  if (!stream?.getReader) return { ok: false, reason: 'unreadable' };

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = stream.getReader();
  } catch {
    // Locked/disturbed stream (or a hostile one): fail closed as unreadable.
    // The thrown value is dropped here — never logged, never returned.
    return { ok: false, reason: 'unreadable' };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new Error('waha: body read deadline exceeded'));
    }, deadlineMs);
  });

  const readChunk = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
    const pending = reader.read();
    // `Promise.race` already subscribes to `pending`, so the handler exists
    // implicitly; this makes the guarantee explicit at the point where the
    // promise is abandoned, so a later refactor of the race cannot silently
    // reintroduce an unhandled rejection.
    void pending.catch(() => undefined);
    return Promise.race([pending, deadline]);
  };

  try {
    for (;;) {
      const { done, value } = await readChunk();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        cancelQuietly(reader);
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    if (timedOut) cancelQuietly(reader);
    return { ok: false, reason: timedOut ? 'timeout' : 'unreadable' };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/**
 * The rate-limit identity for this PUBLIC webhook.
 *
 * In production only `CF-Connecting-IP` is trusted, and only when it is
 * present, bounded and free of whitespace/comma (so a header carrying a
 * list — the shape `X-Forwarded-For` uses — can never smuggle a chosen key in).
 * `X-Forwarded-For`/`X-Real-IP` are NOT consulted as a fallback: on this
 * public route they are client-settable, so honouring them would let any
 * caller mint an unlimited number of quotas with one header and defeat the
 * limiter that guards the body read and the HMAC. Anything unusable collapses
 * into one shared sentinel bucket, which over-limits rather than under-limits.
 *
 * Outside production the existing `getClientIdentifier(request)` behaviour is
 * preserved unchanged, so local/dev tooling keeps working. That helper is read
 * from its source (never redefined here) so its other callers are unaffected.
 */
function resolveRateLimitKey(request: NextRequest): string {
  if (process.env.NODE_ENV !== 'production') return getClientIdentifier(request);

  const raw = request.headers.get(CF_CLIENT_IP_HEADER) ?? '';
  const candidate = raw.trim();
  if (!candidate || candidate.length > MAX_CF_CLIENT_IP_LENGTH || /\s|,/.test(candidate)) {
    return MISSING_CF_CLIENT_IP_KEY;
  }
  return candidate;
}

/** Signature header must be exactly 128 hex characters before we compute anything. */
function hasWellFormedSignature(signature: string): boolean {
  return signature.length === HMAC_HEX_LENGTH && /^[0-9a-f]+$/.test(signature.toLowerCase());
}

/**
 * Verifies the HMAC over the exact raw bytes with a constant-time comparison.
 *
 * The algorithm header must be present and exactly `sha512`: an absent or
 * different label is a mismatch, never a hint to "try the named algorithm".
 */
function verifyWahaHmac(key: string, rawBody: Uint8Array, signature: string, algorithm: string | null): boolean {
  if (algorithm === null || algorithm.trim() !== HMAC_ALGORITHM) return false;
  if (!hasWellFormedSignature(signature)) return false;
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  const expected = createHmac(HMAC_ALGORITHM, key).update(rawBody).digest();
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/**
 * Maps a WAHA sender to E.164 digits — only for a DIRECT chat.
 *
 * The accepted form is exactly `<digits>@c.us` with at most 15 digits. Nothing is
 * stripped to reach that shape: `@g.us` (group), `@broadcast`, `@newsletter`,
 * `@lid` and `@s.whatsapp.net` are all rejected rather than coerced, and no
 * `@…` is cut off a caller-supplied value.
 */
function extractDirectChatPhone(from: unknown): string | null {
  if (typeof from !== 'string') return null;
  const match = DIRECT_CHAT_PATTERN.exec(from.trim());
  return match ? match[1] : null;
}

/**
 * Bounds content to the Action contract.
 *
 * Truncation is explicit rather than silent: the cut lands on a code-point
 * boundary (never between a high/low surrogate pair, which would produce a
 * corrupt character downstream) and an ellipsis marks that text was dropped.
 * Only a fixed reason is logged — never the content, sender or session.
 */
function boundContent(value: string): string {
  if (value.length <= MAX_CONTENT_CHARS) return value;

  let cut = MAX_CONTENT_CHARS - TRUNCATION_MARKER.length;
  // A high surrogate at the cut boundary means its partner is at `cut`; step
  // back so the pair is either kept whole or dropped whole.
  if (cut > 0 && isHighSurrogate(value.charCodeAt(cut - 1))) cut -= 1;

  whatsappLogger.warn('waha webhook content truncated', {
    event: ALLOWED_EVENT,
    reason: 'content_truncated',
  });
  return value.slice(0, cut) + TRUNCATION_MARKER;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/**
 * Normalizes an allowlisted text/image/audio/document message.
 *
 * `media.url` is deliberately never read and `_data` is never inspected — no
 * media is downloaded in this slice, so the URL is dead weight that would only
 * become a stored third-party reference. An unsupported mimetype fails closed.
 */
function normalizeMessageContent(payload: Record<string, unknown>): NormalizedContent | null {
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';

  if (payload.hasMedia !== true) {
    if (!body) return null;
    return { content: boundContent(body), messageType: 'text' };
  }

  const media = payload.media && typeof payload.media === 'object' && !Array.isArray(payload.media)
    ? payload.media as Record<string, unknown>
    : null;
  const mimetype = typeof media?.mimetype === 'string' ? media.mimetype.trim().toLowerCase() : '';
  const filename = typeof media?.filename === 'string' ? media.filename.trim() : '';

  if (mimetype.startsWith('image/')) return { content: boundContent(body || '[Image]'), messageType: 'image' };
  if (mimetype.startsWith('audio/')) return { content: boundContent(body || '[Audio]'), messageType: 'audio' };
  if (DOCUMENT_MIMETYPES.has(mimetype)) {
    return { content: boundContent(filename || body || '[Document]'), messageType: 'document' };
  }
  return null;
}

/** The single generic freshness denial — it never distinguishes missing from stale. */
function staleEventResponse(): NextResponse {
  return NextResponse.json({ error: 'Stale webhook event' }, { status: 409 });
}

/**
 * Stage 2 — every step that touches the database.
 *
 * Runs behind `withModuleRoute('atendimento')`, so the module gate is evaluated
 * BEFORE installation resolution and before the Action, exactly as it would be
 * for an authenticated user route. The gate is deliberately not removed or
 * bypassed: it is only *reordered* so that unauthenticated traffic cannot make
 * it query the module manifest at all.
 */
async function handleAuthenticatedMessage(
  root: Record<string, unknown>,
  session: string,
): Promise<NextResponse> {
  // An outage is retryable; an unknown session is a legitimate ignore.
  let installation;
  try {
    installation = await resolveWahaInstallationStrict({ installationId: session });
  } catch {
    logDenied('installation_lookup_failed');
    return unavailableResponse();
  }
  if (!installation) {
    logDenied('unknown_installation');
    return NextResponse.json(ACK_IGNORED);
  }

  const payload = root.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json(ACK_IGNORED);
  }
  const message = payload as Record<string, unknown>;

  // Identify BEFORE freshness. Everything rejected here is a message we were
  // never going to store, so acknowledging it is final: returning 409 would
  // only make the provider retry an event that can never succeed.
  // Outbound echo (and any non-`false` fromMe) is acknowledged without
  // processing. Signature and module-gate checks above still precede this.
  if (message.fromMe !== false) return NextResponse.json(ACK_IGNORED);

  const messageId = typeof message.id === 'string' ? message.id.trim() : '';
  if (!messageId || messageId.length > MAX_MESSAGE_ID_LENGTH) {
    return NextResponse.json(ACK_IGNORED);
  }

  const phone = extractDirectChatPhone(message.from);
  if (!phone) {
    return NextResponse.json(ACK_IGNORED);
  }

  // Replay guard on the SIGNED root timestamp (ms), now that we know this is
  // a storable inbound message. Missing/invalid/stale all fail closed — an
  // event with no usable clock is never worth a side effect.
  if (!assertWebhookFreshness({ timestampMs: root.timestamp })) {
    logDenied('stale_event');
    return staleEventResponse();
  }

  // Dedup identity: stable and session-scoped so the same provider message id
  // from two sessions cannot collide in `(externalProvider, externalMessageId)`.
  const externalMessageId = `${session}:${messageId}`;
  if (externalMessageId.length > MAX_EXTERNAL_MESSAGE_ID_LENGTH) {
    return NextResponse.json(ACK_IGNORED);
  }

  const normalized = normalizeMessageContent(message);
  if (!normalized) return NextResponse.json(ACK_IGNORED);

  // Inbound Action with the RESOLVED clinic and an allowlisted metadata set
  // (session + WAHA message id) — no payload, no URL, no headers, no `_data`.
  try {
    const result = await runAtendimentoSystemActionResult(receberMensagem, {
      externalConversationId: phone,
      externalProvider: 'waha',
      externalMessageId,
      message: normalized.content,
      channel: 'whatsapp',
      messageType: normalized.messageType,
      metadata: { session: installation.installationId, waha_message_id: messageId },
    }, installation.clinicId);

    // ok:false here means the message was NOT durably stored. Answering 200 would
    // drop it permanently, so the provider is asked to retry instead; inbound
    // dedup on (externalProvider, externalMessageId) keeps the retry safe.
    if (!result.ok) {
      logDenied('persistence_failed');
      return unavailableResponse();
    }
  } catch {
    logDenied('persistence_failed');
    return unavailableResponse();
  }

  return NextResponse.json(ACK_OK);
}

/**
 * The module gate, applied to stage 2 only.
 *
 * `withModuleRoute` builds a manifest and queries it on every call, so wrapping
 * the WHOLE handler would let anonymous or bad-HMAC traffic reach the database
 * and would let a manifest failure escape as a framework 500. Wrapping only the
 * DB-touching stage keeps both properties: unauthenticated traffic never reaches
 * the manifest, and any manifest throw is caught by the caller's try/catch.
 */
const gatedAuthenticatedMessage = withModuleRoute('atendimento')(handleAuthenticatedMessage);

/**
 * Stage 1 — limiter plus cryptographic validation, all before any DB access.
 *
 * Everything here is authenticated-by-HMAC or trivially cheap, and each rejection
 * returns without touching the database.
 */
async function handlePOST(request: NextRequest) {
  // 0. Rate limit FIRST, before any body byte is read or any HMAC is computed.
  //    This endpoint is public and the expensive work below (up to 256 KiB of
  //    buffering plus a sha512 over it, with a 10s deadline) is reachable with
  //    only well-formed headers — i.e. by traffic that has NOT authenticated.
  //    Blocking here means such traffic cannot repeatedly consume that budget.
  //    Blocked requests short-circuit: no body read, no HMAC, no manifest, no
  //    tenant lookup, no Action.
  //
  //    IDENTITY — in production the key is `CF-Connecting-IP` only (see
  //    `resolveRateLimitKey`). Anything missing/malformed shares ONE sentinel
  //    bucket, so this check cannot be evaded by spoofing a header.
  //
  //    OPS GATE — this limiter is SUPPLEMENTAL ONLY: the store is in-memory and
  //    per-instance, so it does not bound aggregate/distributed traffic and is
  //    lost on every deploy. A Cloudflare edge rate-limit rule on
  //    `POST /api/whatsapp/waha` remains REQUIRED before cutover (see
  //    docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md §13).
  const clientId = resolveRateLimitKey(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.webhook, keyPrefix: 'waha-webhook' });
  if (!rateLimit.allowed) {
    logDenied('rate_limited');
    // Canonical 429: Retry-After lives in the header only (ADR-BASE-10).
    return apiRateLimited(generateRequestId(), rateLimit.retryAfter);
  }

  // 1. HMAC — key first (fail closed), then the signed raw bytes.
  const hmacKey = resolveHmacKey();
  if (!hmacKey) {
    logDenied('not_configured');
    return NextResponse.json({ error: 'Webhook unavailable' }, { status: 503 });
  }

  const algorithm = request.headers.get('x-webhook-hmac-algorithm');
  const signature = request.headers.get('x-webhook-hmac') ?? '';
  if (algorithm === null || algorithm.trim() !== HMAC_ALGORITHM || !hasWellFormedSignature(signature)) {
    logDenied('invalid_signature_headers');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const raw = await readRawBody(request, MAX_BODY_BYTES, BODY_READ_DEADLINE_MS);
  if (!raw.ok) {
    logDenied(`body_${raw.reason}`);
    if (raw.reason === 'too_large') return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    if (raw.reason === 'timeout') return NextResponse.json({ error: 'Request timeout' }, { status: 408 });
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!verifyWahaHmac(hmacKey, raw.bytes, signature, algorithm)) {
    logDenied('signature_mismatch');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  // 2. Only now may the body be parsed.
  let envelope: unknown;
  try {
    envelope = JSON.parse(new TextDecoder().decode(raw.bytes));
  } catch {
    logDenied('invalid_json');
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    logDenied('invalid_envelope');
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const root = envelope as Record<string, unknown>;

  // 3. Event allowlist — cheap, so an unknown event never reaches the DB.
  if (root.event !== ALLOWED_EVENT) {
    return NextResponse.json(ACK_IGNORED);
  }

  // 4. Session syntax. `session` is a provider label, never a clinic selector.
  const session = typeof root.session === 'string' ? root.session.trim() : '';
  if (!SESSION_PATTERN.test(session) || session.length > MAX_SESSION_LENGTH) {
    return NextResponse.json(ACK_IGNORED);
  }

  // 5. Hand off to the gated stage. The gate still precedes installation
  //    resolution and the Action; it simply runs only for an authenticated,
  //    allowlisted event whose session is syntactically usable.
  try {
    return await gatedAuthenticatedMessage(root, session);
  } catch {
    // `withModuleRoute` can throw before the inner handler runs (manifest DB
    // failure). Fail closed with the same opaque retryable 503 as any other
    // transient dependency, and never surface the driver error.
    logDenied('module_gate_failed');
    return unavailableResponse();
  }
}

export const POST = handlePOST;
