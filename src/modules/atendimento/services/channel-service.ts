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
 */

import { EventEmitter } from 'events';
import { dbLogger } from '@/lib/logger';
import { getEvolutionService } from './evolution-service';
import { fetchWithRetry, DEFAULT_EXTERNAL_TIMEOUT_MS } from '@/lib/http/fetch-with-retry';
import { withOutboundIdempotency } from '@/lib/http/outbound-idempotency';

// ─── Types ─────────────────────────────────────────────────────

export type WhatsAppProvider = 'evolution' | 'playwright' | 'business-api';

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
  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) return 'evolution';
  if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_TOKEN) return 'business-api';
  return 'playwright';
}

function isFallbackConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_FALLBACK_URL && process.env.WHATSAPP_FALLBACK_SECRET);
}

// ─── Unified send facade ───────────────────────────────────────

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

  if (provider === 'evolution') {
    const evolutionService = getEvolutionService();
    if (evolutionService) {
      try {
        // Claim acontece dentro de sendTextMessage; fallback usa outro
        // transporte e por isso não compartilha a mesma chave.
        const result = idempotencyKey
          ? await evolutionService.sendTextMessage(phone, message, { idempotencyKey })
          : await evolutionService.sendTextMessage(phone, message);
        if (result.success || !isFallbackConfigured()) return result;
        dbLogger.warn('channel-service: evolution send failed; using WhatsApp sidecar fallback');
        return getWhatsAppService().sendMessage(phone, message);
      } catch (err) {
        if (!isFallbackConfigured()) throw err;
        dbLogger.error('channel-service: evolution send failed', err);
        dbLogger.warn('channel-service: evolution send threw; using WhatsApp sidecar fallback');
        return getWhatsAppService().sendMessage(phone, message);
      }
    }

    if (isFallbackConfigured()) return getWhatsAppService().sendMessage(phone, message);
  }

  if (provider === 'playwright') {
    const service = getWhatsAppService();
    if (!idempotencyKey) return service.sendMessage(phone, message);
    const guarded = await withOutboundIdempotency(
      idempotencyKey,
      () => service.sendMessage(phone, message),
      { isSuccess: (r) => r.success },
    );
    if (guarded.deduped) return { success: true, deduplicated: true };
    return guarded.result ?? { success: false, error: 'Idempotency claim failed' };
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

export async function sendWhatsApp(to: string, text: string, idempotencyKey?: string): Promise<SendResult> {
  try {
    const evolution = getEvolutionService();
    if (!evolution) {
      if (!isFallbackConfigured()) {
        return { success: false, error: 'Evolution service not available' };
      }
      // Sem Evolution, o sidecar é o único transporte: o claim ancora aqui.
      if (!idempotencyKey) return getWhatsAppService().sendMessage(to, text);
      const guarded = await withOutboundIdempotency(
        idempotencyKey,
        () => getWhatsAppService().sendMessage(to, text),
        { isSuccess: (r) => r.success },
      );
      if (guarded.deduped) return { success: true, deduplicated: true };
      return guarded.result ?? { success: false, error: 'Idempotency claim failed' };
    }
    const result = idempotencyKey
      ? await evolution.sendTextMessage(to, text, { idempotencyKey })
      : await evolution.sendTextMessage(to, text);
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
    if (!idempotencyKey) return await send();
    const guarded = await withOutboundIdempotency(idempotencyKey, send, {
      jobType: 'instagram:outbound',
      isSuccess: (r) => r.success,
    });
    if (guarded.deduped) return { success: true, deduplicated: true };
    return guarded.result ?? { success: false, error: 'Idempotency claim failed' };
  } catch (err: unknown) {
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
