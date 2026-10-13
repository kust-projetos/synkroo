/**
 * WahaAdapter — atendimento module (vNext P3.2, outbound text slice).
 *
 * Transport for the WAHA provider behind the neutral `WhatsAppProviderAdapter`
 * contract. SCOPE (this slice, deliberately minimal and DORMANT):
 *   - outbound TEXT only, via `POST /api/sendText`
 *     (https://waha.devlike.pro/how-to/send-messages/api-sendText);
 *   - configured session only (`WAHA_SESSION`) — the caller NEVER picks it;
 *   - direct-chat destinations only (phone → `<digits>@c.us`).
 *
 * Explicitly OUT of scope here (later P3 slices): inbound webhook/HMAC, media,
 * mark-read, session/QR lifecycle, health checks, activation in the facade,
 * provider selection or fallback, and any retry/resend decision.
 *
 * Security posture:
 * - config is server-only and read at call time (no startup network activity,
 *   no cached "configured" state); missing/invalid config fails closed;
 * - base URL must be HTTPS (http allowed only for loopback outside production)
 *   and free of userinfo/query/fragment/non-root path;
 * - `redirect: 'error'` so the API key and the message body are never
 *   forwarded to a redirect target;
 * - exactly ONE attempt — no retry, no fallback, no auto-resend. A deadline
 *   covers headers AND body consumption; exceeding it reports `delivery:
 *   'unknown'` for the caller to resolve;
 * - errors are typed and sanitized: no recipient, text, api key, provider
 *   body, URL or raw exception/cause ever reaches a message, a log or a stack.
 */

import { whatsappLogger } from '@/lib/logger';
import type {
  WhatsAppProviderAdapter,
  WhatsAppProviderSendResult,
} from './whatsapp-provider-adapter';

/** WAHA docs: POST /api/sendText → 201 with a WAMessage (root `id`). */
const SEND_TEXT_PATH = '/api/sendText';
/** WAHA direct chat JID suffix (individual chats). Groups/LID/broadcast are out of scope. */
const DIRECT_CHAT_SUFFIX = '@c.us';
/** Same default country code applied by the Evolution leaf. */
const DEFAULT_COUNTRY_CODE = '55';
/** E.164 upper bound — guards against nonsense input becoming a JID. */
const MAX_E164_DIGITS = 15;
/**
 * Conventional display formatting accepted before stripping: optional leading
 * `+` and otherwise digits, spaces, parentheses, dot and hyphen. Nothing else —
 * in particular no `@` (JID/groups/LID/broadcast) and no letters.
 */
const DISPLAY_PHONE_PATTERN = /^\+?[\d\s().-]+$/;
const DEFAULT_TIMEOUT_MS = 15_000;
/** Hard cap on the response we are willing to buffer/parse. */
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const textEncoder = new TextEncoder();

export type WahaProviderErrorCode =
  | 'not_configured'
  | 'invalid_config'
  | 'invalid_destination'
  | 'invalid_text'
  | 'timeout'
  | 'network_error'
  | 'http_error'
  | 'response_too_large'
  | 'invalid_response';

/**
 * Whether the message may have reached the provider. `not_attempted` = rejected
 * before any request; `unknown` = request dispatched but no confirmed delivery.
 */
export type WahaDeliveryState = 'not_attempted' | 'unknown';

/**
 * Sanitized, typed provider error. Carries only `code`, optional `status` and
 * `delivery` — never a provider body, recipient, text, api key, url or cause.
 */
export class WahaProviderError extends Error {
  readonly code: WahaProviderErrorCode;
  readonly status?: number;
  readonly delivery: WahaDeliveryState;

  constructor(args: {
    code: WahaProviderErrorCode;
    message: string;
    status?: number;
    delivery?: WahaDeliveryState;
  }) {
    super(args.message);
    this.name = 'WahaProviderError';
    this.code = args.code;
    this.delivery = args.delivery ?? 'not_attempted';
    if (args.status !== undefined) this.status = args.status;
  }
}

export interface WahaAdapterDeps {
  /** Injected transport (tests). Defaults to the runtime global `fetch`. */
  fetchImpl?: typeof fetch;
  /** End-to-end deadline for the whole attempt (headers + body). */
  timeoutMs?: number;
  /** Hard cap on the response bytes read from the provider. */
  maxResponseBytes?: number;
}

interface WahaConfig {
  baseUrl: string;
  apiKey: string;
  session: string;
}

type WahaConfigResult =
  | { ok: true; config: WahaConfig }
  | { ok: false; code: 'not_configured' | 'invalid_config' };

function trimmed(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validates the configured base URL and returns its origin, or `null`.
 *
 * Accepts HTTPS anywhere; `http` only for loopback hosts outside production.
 * Rejects userinfo (credentials in the url), query, fragment and any non-root
 * path — the API key must never travel through a surprise target.
 */
function normalizeBaseUrl(raw: string, isProduction: boolean): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.search || url.hash) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  if (url.protocol === 'https:') return url.origin;
  if (
    url.protocol === 'http:' &&
    !isProduction &&
    LOOPBACK_HOSTS.has(url.hostname.toLowerCase())
  ) {
    return url.origin;
  }
  return null;
}

/**
 * Reads server-only WAHA config from the environment at call time.
 * Partial config fails closed as `not_configured`; malformed base URL as
 * `invalid_config`. Nothing here performs I/O.
 */
function resolveWahaConfig(env: NodeJS.ProcessEnv = process.env): WahaConfigResult {
  const baseUrl = trimmed(env.WAHA_API_URL);
  const apiKey = trimmed(env.WAHA_API_KEY);
  const session = trimmed(env.WAHA_SESSION);
  if (!baseUrl || !apiKey || !session) return { ok: false, code: 'not_configured' };
  const origin = normalizeBaseUrl(baseUrl, env.NODE_ENV === 'production');
  if (!origin) return { ok: false, code: 'invalid_config' };
  return { ok: true, config: { baseUrl: origin, apiKey, session } };
}

/**
 * Maps a phone to a WAHA direct-chat JID.
 *
 * Accepts the conventional display formatting the Evolution leaf tolerates
 * (`(11) 98765-4321`, `+55 (11) 98765-4321`, …) and strips it, exactly like
 * `evolution-service.ts:219-224`; common display formatting is intentionally
 * kept, but the final E.164 length is stricter because Evolution does not
 * enforce that 15-digit bound. The
 * accepted FORM stays narrow: any `@` is rejected — group (`@g.us`), LID
 * (`@lid`), broadcast, newsletter and caller-supplied JIDs are out of this
 * slice — as are letters, a `+` anywhere but the start, formatting with no
 * digits at all, and anything longer than E.164. Digits without the `55` prefix
 * receive it — identical to the Evolution leaf (lines 219-237).
 */
function mapPhoneToDirectChatId(to: string): string {
  const invalid = (): never => {
    throw new WahaProviderError({
      code: 'invalid_destination',
      message: 'waha: sendText rejected an unsupported destination form',
    });
  };
  if (typeof to !== 'string') return invalid();
  const raw = to.trim();
  if (!raw || raw.includes('@')) return invalid();
  if (!DISPLAY_PHONE_PATTERN.test(raw)) return invalid();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return invalid();
  const normalized = digits.startsWith(DEFAULT_COUNTRY_CODE)
    ? digits
    : `${DEFAULT_COUNTRY_CODE}${digits}`;
  // E.164 is checked on the FINAL count: prefixing the default country code
  // must not push the JID past 15 digits (a 14/15-digit non-55 input would).
  if (normalized.length > MAX_E164_DIGITS) return invalid();
  return `${normalized}${DIRECT_CHAT_SUFFIX}`;
}

function tooLarge(maxBytes: number): WahaProviderError {
  return new WahaProviderError({
    code: 'response_too_large',
    message: `waha: sendText response exceeded the ${maxBytes} byte limit`,
    delivery: 'unknown',
  });
}

/** Declared `content-length`, or `null` when absent/unparseable. */
function declaredContentLength(response: Response): number | null {
  const raw = response.headers?.get?.('content-length');
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Best-effort release of a body/reader we are discarding.
 *
 * `cancel()` may return a promise that NEVER settles (stalled provider or
 * stream), so this never throws and returns a promise the caller must bound —
 * it must never be awaited unbounded. Callers either race it against the attempt
 * deadline or fire it without awaiting.
 */
function releaseBody(target: unknown): Promise<void> {
  const cancel = (target as { cancel?: (reason?: unknown) => unknown } | null | undefined)?.cancel;
  if (typeof cancel !== 'function') return Promise.resolve();
  try {
    const result = cancel.call(target);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      return Promise.resolve(result).then(
        () => undefined,
        () => undefined,
      );
    }
  } catch {
    // best effort: the stream is being discarded anyway
  }
  return Promise.resolve();
}

/**
 * Reads the response body under a hard byte cap.
 *
 * Prefers the stream so an oversized/unbounded body is abandoned early; falls
 * back to `text()` when the runtime exposes no readable stream. A DECLARED
 * oversize is rejected before this runs (the caller must release the body), so
 * the byte count here is the actual one. The body is only parsed here — the
 * caller's deadline still has to cover this await.
 */
async function readBoundedBody(
  response: Response,
  maxBytes: number,
  onOversize?: () => void,
): Promise<string> {
  const stream = (response as { body?: { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } | null })
    .body;
  if (!stream?.getReader) {
    const text = await response.text();
    if (textEncoder.encode(text).length > maxBytes) {
      // No unread transport is left open here (`text()` already consumed it),
      // but signal oversize so the caller can still tear down defensively.
      onOversize?.();
      throw tooLarge(maxBytes);
    }
    return text;
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      // Abort FIRST: the transport teardown must not depend on the release
      // below settling — `cancel()` may hang forever (stalled provider).
      // Fire-and-forget: this whole read is already raced against the deadline.
      onOversize?.();
      void releaseBody(reader);
      throw tooLarge(maxBytes);
    }
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

/**
 * Maps the provider payload to the provider message id. WAHA answers with a
 * WAMessage whose root `id` is the message id (identical across WEBJS/NOWEB/
 * GOWS). `_data` is engine-internal and must never be read or exposed; a
 * missing/blank/non-string id is a hard failure — we never fabricate one.
 */
function extractMessageId(rawBody: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }
  const id =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).id
      : undefined;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new WahaProviderError({
      code: 'invalid_response',
      message: 'waha: sendText response did not contain a usable message id',
      delivery: 'unknown',
    });
  }
  return id;
}

export class WahaAdapter implements WhatsAppProviderAdapter {
  readonly id = 'waha' as const;

  private readonly fetchImpl?: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(deps: WahaAdapterDeps = {}) {
    this.fetchImpl = deps.fetchImpl;
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResponseBytes = deps.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  }

  /** Cheap, synchronous, no I/O — same contract as every other adapter. */
  isAvailable(): boolean {
    return resolveWahaConfig().ok;
  }

  /**
   * Single-attempt outbound text. Throws `WahaProviderError` on every failure
   * (never fabricates a `messageId`); the caller keeps the fallback decision.
   */
  async sendTextMessage(to: string, text: string): Promise<WhatsAppProviderSendResult> {
    const resolved = resolveWahaConfig();
    if (!resolved.ok) {
      throw new WahaProviderError({
        code: resolved.code,
        message: `waha: adapter is not usable (${resolved.code})`,
      });
    }
    const { baseUrl, apiKey, session } = resolved.config;

    const chatId = mapPhoneToDirectChatId(to);
    if (typeof text !== 'string' || text.trim() === '') {
      throw new WahaProviderError({
        code: 'invalid_text',
        message: 'waha: sendText requires a non-empty text',
      });
    }

    const controller = new AbortController();
    let rejectDeadline: ((error: WahaProviderError) => void) | undefined;
    // The deadline is raced against BOTH the request and the body read, so a
    // stalled response cannot outlive it even if the transport ignores abort.
    const deadline = new Promise<never>((_resolve, reject) => {
      rejectDeadline = reject;
    });
    const timer = setTimeout(() => {
      rejectDeadline?.(
        new WahaProviderError({
          code: 'timeout',
          message: `waha: sendText exceeded the ${this.timeoutMs}ms deadline (delivery unknown)`,
          delivery: 'unknown',
        }),
      );
      controller.abort();
    }, this.timeoutMs);

    try {
      const sendImpl = this.fetchImpl ?? globalThis.fetch;
      const response = await Promise.race([
        sendImpl(`${baseUrl}${SEND_TEXT_PATH}`, {
          method: 'POST',
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ session, chatId, text }),
          // Never forward api key + message to a redirect target.
          redirect: 'error',
          signal: controller.signal,
        }),
        deadline,
      ]);

      if (!response.ok) {
        // Release the error body WITHOUT an unbounded await: the cancel is raced
        // against the SAME deadline, so a provider that stalls the release can
        // neither hang nor outlive the attempt (it then reports `timeout`).
        await Promise.race([
          releaseBody((response as { body?: unknown }).body),
          deadline,
        ]);
        throw new WahaProviderError({
          code: 'http_error',
          message: `waha: sendText failed (http_error: ${response.status})`,
          status: response.status,
          delivery: 'unknown',
        });
      }

      // A body we already know is oversized is never read: release it under the
      // SAME deadline (no unbounded await) and abort the transport in either
      // outcome, so no unread response is left open when the attempt ends.
      const declared = declaredContentLength(response);
      if (declared !== null && declared > this.maxResponseBytes) {
        try {
          await Promise.race([
            releaseBody((response as { body?: unknown }).body),
            deadline,
          ]);
        } finally {
          controller.abort();
        }
        throw tooLarge(this.maxResponseBytes);
      }

      const rawBody = await Promise.race([
        readBoundedBody(response, this.maxResponseBytes, () => controller.abort()),
        deadline,
      ]);

      return { success: true, messageId: extractMessageId(rawBody) };
    } catch (error) {
      const sanitized = this.sanitize(error);
      whatsappLogger.warn('waha adapter: sendText failed', {
        code: sanitized.code,
        status: sanitized.status,
        delivery: sanitized.delivery,
      });
      throw sanitized;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Maps any failure into a sanitized `WahaProviderError` (no cause chaining). */
  private sanitize(error: unknown): WahaProviderError {
    if (error instanceof WahaProviderError) return error;
    return new WahaProviderError({
      code: 'network_error',
      message: 'waha: sendText transport failure (delivery unknown)',
      delivery: 'unknown',
    });
  }
}

export const wahaWhatsAppProviderAdapter: WhatsAppProviderAdapter = new WahaAdapter();
