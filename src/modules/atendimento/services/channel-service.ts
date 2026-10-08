/**
 * Channel Service — atendimento module (P2 port).
 *
 * Ported from legacy @/services/whatsapp/whatsapp.service.ts and
 * @/services/whatsapp/index.ts (sendWhatsAppMessage facade).
 *
 * Provides:
 *  - WhatsAppService (HTTP client for VPS Playwright fallback sidecar)
 *  - sendWhatsAppMessage (provider-dispatching facade)
 *  - sendByChannel (channel abstraction for actions)
 *
 * vNext P3.1: concrete providers are reached through the provider registry
 * (`../integrations/whatsapp-provider-registry`) — this facade never imports a
 * provider leaf directly, and it keeps owning detection, fallback order and the
 * single idempotency claim that spans provider + sidecar fallback.
 *
 * WAHA-only (owner decision, commit 3863c4f): WAHA is the default outbound
 * channel — detection prefers it and `sendWhatsApp` tries it first. Evolution
 * remains as a DEPRECATED legacy path (same error contracts, no new behavior)
 * until the owner retires the provider and its inbound route
 * (`/api/whatsapp/evolution`).
 */

import { EventEmitter } from 'events';
import { dbLogger } from '@/lib/logger';
import { getWhatsAppProviderAdapter } from '../integrations/whatsapp-provider-registry';
import type {
  WhatsAppProviderAdapter,
  WhatsAppProviderId,
} from '../integrations/whatsapp-provider-registry';
import { fetchWithRetry, DEFAULT_EXTERNAL_TIMEOUT_MS } from '@/lib/http/fetch-with-retry';
import { withOutboundIdempotency, OutboundSendConflictError } from '@/lib/http/outbound-idempotency';

// ─── Types ─────────────────────────────────────────────────────

/** Alias kept for existing importers; canonical id union lives in the adapter contract. */
export type WhatsAppProvider = WhatsAppProviderId;

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  type: 'text' | 'image' | 'audio' | 'document';
  isFromMe: boolean;
}

export interface WhatsAppSession {
  isConnected: boolean;
  phoneNumber: string | null;
  lastActivity: Date | null;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** true quando a duplicata foi suprimida pelo claim de idempotência (A3). */
  deduplicated?: boolean;
}

// ─── Provider detection ────────────────────────────────────────

function detectProvider(): WhatsAppProvider {
  // WAHA-only (owner decision, commit 3863c4f): WAHA is the channel and wins
  // whenever it is configured; Evolution detection is legacy and stays only
  // for the deprecation transition.
  if (process.env.WAHA_API_URL && process.env.WAHA_API_KEY) return 'waha';
  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) return 'evolution';
  if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_TOKEN) return 'business-api';
  return 'playwright';
}

function isFallbackConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_FALLBACK_URL && process.env.WHATSAPP_FALLBACK_SECRET);
}

// ─── Provider registry seam (P3.1) ────────────────────────────────────────────

/**
 * Resolves the WAHA adapter through the provider registry. Returns `null`
 * when no adapter is registered or the underlying provider cannot be resolved
 * (missing/invalid `WAHA_*` config) — the caller then falls through to the
 * legacy Evolution path or the sidecar, exactly like the Evolution resolver.
 */
function resolveWahaAdapter(): WhatsAppProviderAdapter | null {
  const adapter = getWhatsAppProviderAdapter('waha');
  if (!adapter || !adapter.isAvailable()) return null;
  return adapter;
}

/**
 * Resolves the Evolution adapter through the provider registry. Returns `null`
 * when no adapter is registered or the underlying provider cannot be resolved —
 * the exact condition the facade previously expressed as "no Evolution leaf",
 * so detection/fallback order is unchanged.
 *
 * @deprecated Legacy path — WAHA is the channel (owner decision, commit
 * 3863c4f). Kept for the deprecation transition with identical contracts.
 */
function resolveEvolutionAdapter(): WhatsAppProviderAdapter | null {
  const adapter = getWhatsAppProviderAdapter('evolution');
  if (!adapter || !adapter.isAvailable()) return null;
  return adapter;
}

// ─── Unified send facade ───────────────────────────────────────

/**
 * Executa `op` sob UM único claim de idempotência (REVIEW-A2A3): Evolution +
 * fallback sidecar contam como UMA operação lógica — em falha ambígua da
 * Evolution o fallback continua, mas sob o mesmo claim (sem duplo-envio).
 * Conflito (`in_progress`/`retry_after`) propaga como
 * `OutboundSendConflictError` — o caller decide (retry do job / `conflict`).
 */
async function runIdempotentSend(
  idempotencyKey: string | undefined,
  op: () => Promise<SendResult>,
  opts?: { jobType?: string; completedTtlMs?: number },
): Promise<SendResult> {
  if (!idempotencyKey) return op();
  const guarded = await withOutboundIdempotency(idempotencyKey, op, {
    ...(opts?.jobType ? { jobType: opts.jobType } : {}),
    ...(opts?.completedTtlMs !== undefined ? { completedTtlMs: opts.completedTtlMs } : {}),
    isSuccess: (r) => r.success,
  });
  if (guarded.deduped) return { success: true, deduplicated: true };
  return guarded.result ?? { success: false, error: 'Idempotency claim failed' };
}

/**
 * Send a WhatsApp message using the configured provider.
 *
 * `idempotencyKey` (opcional, A3) ancora a operação lógica (ex.:
 * `whatsapp:send:<clinicId>:<messageId>` via `buildOutboundIdempotencyKey`).
 * Sem a chave, o comportamento é o legado (envio direto).
 */
export async function sendWhatsAppMessage(
  phone: string, message: string, idempotencyKey?: string,
): Promise<SendResult> {
  const provider = detectProvider();

  if (provider === 'waha') {
    let wahaAdapter: WhatsAppProviderAdapter | null = null;
    try {
      wahaAdapter = resolveWahaAdapter();
    } catch (err) {
      dbLogger.error('channel-service: waha resolve failed', err);
    }
    if (wahaAdapter) {
      // Claim único englobando WAHA + fallback (sem repasse da chave ao
      // leaf — o leaf mantém o param para chamadores diretos).
      const attempt = async (): Promise<SendResult> => {
        try {
          const result = await wahaAdapter.sendTextMessage(phone, message);
          if (result.success || !isFallbackConfigured()) return result;
          dbLogger.warn('channel-service: waha send failed; using WhatsApp sidecar fallback');
          return getWhatsAppService().sendMessage(phone, message);
        } catch (err) {
          if (!isFallbackConfigured()) throw err;
          dbLogger.error('channel-service: waha send failed', err);
          dbLogger.warn('channel-service: waha send threw; using WhatsApp sidecar fallback');
          return getWhatsAppService().sendMessage(phone, message);
        }
      };
      return runIdempotentSend(idempotencyKey, attempt);
    }

    if (isFallbackConfigured()) {
      return runIdempotentSend(idempotencyKey, () => getWhatsAppService().sendMessage(phone, message));
    }
  }

  if (provider === 'evolution') {
    let evolutionAdapter: WhatsAppProviderAdapter | null = null;
    try {
      evolutionAdapter = resolveEvolutionAdapter();
    } catch (err) {
      dbLogger.error('channel-service: evolution resolve failed', err);
    }
    if (evolutionAdapter) {
      // Claim único englobando Evolution + fallback (sem repasse da chave ao
      // leaf — o leaf mantém o param para chamadores diretos).
      const attempt = async (): Promise<SendResult> => {
        try {
          const result = await evolutionAdapter.sendTextMessage(phone, message);
          if (result.success || !isFallbackConfigured()) return result;
          dbLogger.warn('channel-service: evolution send failed; using WhatsApp sidecar fallback');
          return getWhatsAppService().sendMessage(phone, message);
        } catch (err) {
          if (!isFallbackConfigured()) throw err;
          dbLogger.error('channel-service: evolution send failed', err);
          dbLogger.warn('channel-service: evolution send threw; using WhatsApp sidecar fallback');
          return getWhatsAppService().sendMessage(phone, message);
        }
      };
      return runIdempotentSend(idempotencyKey, attempt);
    }

    if (isFallbackConfigured()) {
      return runIdempotentSend(idempotencyKey, () => getWhatsAppService().sendMessage(phone, message));
    }
  }

  if (provider === 'playwright') {
    const service = getWhatsAppService();
    return runIdempotentSend(idempotencyKey, () => service.sendMessage(phone, message));
  }

  return { success: false, error: 'No WhatsApp provider available' };
}

// ─── Channel abstraction ───────────────────────────────────────

/** Dispatch outbound message by channel. */
export async function sendByChannel(
  channel: 'whatsapp' | 'instagram' | 'web',
  to: string,
  text: string,
): Promise<SendResult> {
  switch (channel) {
    case 'whatsapp':
      return sendWhatsApp(to, text);
    case 'instagram':
      return sendInstagram(to, text);
    case 'web':
      return { success: false, error: 'Web widget is receive-only' };
  }
}

export async function sendWhatsApp(
  to: string,
  text: string,
  idempotencyKey?: string,
  opts?: { completedTtlMs?: number },
): Promise<SendResult> {
  // Claim único englobando WAHA (preferido) + Evolution legado + fallback
  // (sem repasse da chave aos leaves). WAHA-only (owner decision, 3863c4f):
  // com WAHA disponível o envio usa WAHA e NÃO recorre à Evolution; sem WAHA
  // o caminho legado da Evolution é preservado com contratos idênticos.
  const attempt = async (): Promise<SendResult> => {
    let wahaAdapter: WhatsAppProviderAdapter | null = null;
    try {
      wahaAdapter = resolveWahaAdapter();
    } catch (err: unknown) {
      dbLogger.error('channel-service: waha resolve failed', err);
      wahaAdapter = null;
    }
    if (wahaAdapter) {
      try {
        const result = await wahaAdapter.sendTextMessage(to, text);
        if (result.success || !isFallbackConfigured()) return result;
        dbLogger.warn('channel-service: waha send failed; using WhatsApp sidecar fallback');
        return getWhatsAppService().sendMessage(to, text);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        dbLogger.error('channel-service: waha send failed', err);
        if (isFallbackConfigured()) {
          dbLogger.warn('channel-service: waha send threw; using WhatsApp sidecar fallback');
          return getWhatsAppService().sendMessage(to, text);
        }
        return { success: false, error: msg };
      }
    }
    try {
      const evolutionAdapter = resolveEvolutionAdapter();
      if (!evolutionAdapter) {
        return isFallbackConfigured()
          ? getWhatsAppService().sendMessage(to, text)
          : { success: false, error: 'Evolution service not available' };
      }
      const result = await evolutionAdapter.sendTextMessage(to, text);
      if (result.success || !isFallbackConfigured()) return result;
      dbLogger.warn('channel-service: evolution send failed; using WhatsApp sidecar fallback');
      return getWhatsAppService().sendMessage(to, text);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      dbLogger.error('channel-service: evolution send failed', err);
      if (isFallbackConfigured()) {
        dbLogger.warn('channel-service: evolution send threw; using WhatsApp sidecar fallback');
        return getWhatsAppService().sendMessage(to, text);
      }
      return { success: false, error: msg };
    }
  };
  return runIdempotentSend(idempotencyKey, attempt, opts);
}

export async function sendInstagram(to: string, text: string, idempotencyKey?: string): Promise<SendResult> {
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accountId || !accessToken) {
    return { success: false, error: 'Instagram provider not configured' };
  }

  // A2: POST de envio com timeout obrigatório e SEM retry (mutação sem
  // chave de idempotência do provider). A3: claim local opt-in via chave.
  const send = async (): Promise<SendResult> => {
    const response = await fetchWithRetry(`https://graph.facebook.com/v18.0/${accountId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient: { id: to }, message: { text } }),
    }, { timeoutMs: DEFAULT_EXTERNAL_TIMEOUT_MS });
    if (!response.ok) return { success: false, error: 'Instagram provider request failed' };
    let payload: { message_id?: string };
    try {
      payload = await response.json() as { message_id?: string };
    } catch {
      payload = {};
    }
    return { success: true, messageId: payload.message_id };
  };

  try {
    return await runIdempotentSend(idempotencyKey, send, { jobType: 'instagram:outbound' });
  } catch (err: unknown) {
    if (err instanceof OutboundSendConflictError) throw err;
    dbLogger.error('channel-service: instagram send failed', err);
    return { success: false, error: 'Instagram provider request failed' };
  }
}

// ─── WhatsAppService (Client for VPS Playwright Fallback Sidecar) ────────────

export class WhatsAppService extends EventEmitter {
  private _isConnected: boolean = false;
  private sessionPath: string;
  private currentQRCode: string | null = null;
  private phoneNumber: string | null = null;
  private lastActivity: Date | null = null;

  constructor(sessionPath: string = process.env.WHATSAPP_SESSION_PATH || './.whatsapp-session') {
    super();
    this.sessionPath = sessionPath;
  }

  get isConnected(): boolean { return this._isConnected; }

  async initialize(): Promise<void> {
    const fallbackUrl = process.env.WHATSAPP_FALLBACK_URL;
    const fallbackSecret = process.env.WHATSAPP_FALLBACK_SECRET;

    if (!fallbackUrl || !fallbackSecret) {
      dbLogger.warn('channel-service: WHATSAPP_FALLBACK_URL or WHATSAPP_FALLBACK_SECRET not configured');
      return;
    }

    try {
      const res = await fetchWithRetry(`${fallbackUrl.replace(/\/+$/, '')}/api/v1/session/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fallbackSecret}`,
        },
      }, { timeoutMs: DEFAULT_EXTERNAL_TIMEOUT_MS });

      if (res.ok) {
        const data = await res.json() as { isConnected?: boolean; phoneNumber?: string | null };
        this._isConnected = Boolean(data.isConnected);
        this.phoneNumber = data.phoneNumber || null;
        if (this._isConnected) {
          this.emit('connected');
          dbLogger.info('channel-service: WhatsApp sidecar connected');
        }
      }
    } catch (err) {
      dbLogger.error('channel-service: failed to connect to WhatsApp sidecar', err);
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }

  async sendMessage(to: string, message: string): Promise<SendResult> {
    const fallbackUrl = process.env.WHATSAPP_FALLBACK_URL;
    const fallbackSecret = process.env.WHATSAPP_FALLBACK_SECRET;

    if (!fallbackUrl || !fallbackSecret) {
      return { success: false, error: 'WhatsApp fallback not configured: missing WHATSAPP_FALLBACK_URL or WHATSAPP_FALLBACK_SECRET' };
    }

    try {
      // A2: POST de envio com timeout obrigatório e SEM retry (mutação sem
      // idempotência no sidecar). O dedup por chave vive nas facades acima.
      const res = await fetchWithRetry(`${fallbackUrl.replace(/\/+$/, '')}/api/v1/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fallbackSecret}`,
        },
        body: JSON.stringify({ phone: to, message }),
      }, { timeoutMs: DEFAULT_EXTERNAL_TIMEOUT_MS });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({})) as { error?: string };
        return { success: false, error: errPayload.error || `HTTP ${res.status}` };
      }

      const result = await res.json() as SendResult;
      this.lastActivity = new Date();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dbLogger.error('channel-service: sidecar sendMessage failed', err);
      return { success: false, error: msg };
    }
  }

  getSession(): WhatsAppSession {
    return { isConnected: this._isConnected, phoneNumber: this.phoneNumber, lastActivity: this.lastActivity || new Date() };
  }

  async getQRCode(): Promise<string | null> {
    const fallbackUrl = process.env.WHATSAPP_FALLBACK_URL;
    const fallbackSecret = process.env.WHATSAPP_FALLBACK_SECRET;
    if (!fallbackUrl || !fallbackSecret) {
      return null;
    }
    try {
      const res = await fetchWithRetry(`${fallbackUrl.replace(/\/+$/, '')}/api/v1/session/qrcode`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${fallbackSecret}`,
        },
      }, { timeoutMs: DEFAULT_EXTERNAL_TIMEOUT_MS });
      if (!res.ok) return null;
      const data = await res.json() as { qrcode?: string | null };
      return data.qrcode ?? null;
    } catch {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    this.emit('disconnected');
  }
}

// ─── Singleton ──────────────────────────────────────────────────

let whatsappInstance: WhatsAppService | null = null;

export function getWhatsAppService(): WhatsAppService {
  if (!whatsappInstance) {
    whatsappInstance = new WhatsAppService(process.env.WHATSAPP_SESSION_PATH);
  }
  return whatsappInstance;
}
