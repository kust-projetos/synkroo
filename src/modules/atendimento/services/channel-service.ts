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
  /**
   * E4 — estado de entrega do efeito (contrato anti-duplicate-send do facade).
   * Definido SOMENTE quando relevante para o chamador decidir entre retry,
   * fallback ou reconciliação manual:
   * - omitido em `success: true` (entrega confirmada) e em falha determinística
   *   conhecida (nada despachado) — avaliação `internal` na action;
   * - `'unknown'` = o dispatch ocorreu mas a entrega NÃO foi confirmada
   *   (timeout/exceção após possível envio). NUNCA reenviar nem trocar de
   *   provider por inferência — mapeia para `ActionError('unknown_effect')`
   *   (E3) nas actions de envio, sem retry automático.
   */
  delivery?: 'sent' | 'failed' | 'unknown';
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

/**
 * E4 — a falha do provider é determinística PRÉ-dispatch (seguro recorrer ao
 * sidecar) ou ambígua (o dispatch pode ter ocorrido)?
 *
 * Checagem ESTRUTURAL, sem importar o leaf: somente um erro que carregue
 * `delivery === 'not_attempted'` (a WAHA o emite em rejeições antes de qualquer
 * requisição — config inválida, destino/texto inválido) confirma que nada
 * partiu para a rede. Qualquer outro caso (timeout, exceção após dispatch,
 * `unknown`, ou um erro sem esse marcador) é ambíguo. Idempotência local não
 * prova que o outro provider não entregou — por isso o fallback só sobrevive
 * para `not_attempted`.
 */
function isDeterministicPreDispatch(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { delivery?: unknown }).delivery === 'not_attempted'
  );
}

/** Razão sanitizada de um erro de provider (mensagem do Error ou String). */
function providerErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * E4 — anti-duplicate-send: um provider DISPONÍVEL só recorre ao fallback
 * sidecar (um SEGUNDO provider) quando a falha é determinística PRÉ-dispatch.
 *
 * - `success: true` → devolve o resultado (entrega confirmada; sem `delivery`).
 * - throw `not_attempted` + sidecar configurado → falha conhecida antes de
 *   qualquer envio → fallback sidecar é seguro.
 * - throw `not_attempted` SEM sidecar → falha conhecida (nada foi enviado).
 * - throw ambíguo OU `success: false` retornado sem confirmação de não-dispatch
 *   (inclui a Evolution, que converte falha de transporte em `success: false`)
 *   → `delivery: 'unknown'` SEM fallback, com log sanitizado. Sem retry.
 */
async function dispatchWithSidecarFallback(
  label: 'waha' | 'evolution',
  to: string,
  text: string,
  send: () => Promise<SendResult>,
): Promise<SendResult> {
  try {
    const result = await send();
    if (result.success) return result;
    dbLogger.warn(
      `channel-service: ${label} reported failure without non-dispatch confirmation; sidecar fallback suppressed`,
    );
    return { ...result, delivery: 'unknown' };
  } catch (err) {
    if (isDeterministicPreDispatch(err)) {
      if (isFallbackConfigured()) {
        dbLogger.warn(
          `channel-service: ${label} deterministic pre-dispatch failure; using WhatsApp sidecar fallback`,
        );
        return getWhatsAppService().sendMessage(to, text);
      }
      return { success: false, error: providerErrorReason(err) };
    }
    dbLogger.error(`channel-service: ${label} send failed`, err);
    dbLogger.warn(
      `channel-service: ${label} delivery unknown after dispatch; sidecar fallback suppressed`,
    );
    return { success: false, error: providerErrorReason(err), delivery: 'unknown' };
  }
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
 * E4 — mensagem sanitizada e FIXA para o estado de entrega desconhecida.
 * Nenhum detalhe de provider (corpo, URL, exceção) entra no resultado: isso
 * volta ao caller da Action, que usa mensagem própria.
 */
const UNKNOWN_DELIVERY_ERROR = 'Resultado do envio não confirmado.';

/**
 * Executa `op` sob UM único claim de idempotência (REVIEW-A2A3): WAHA +
 * fallback sidecar contam como UMA operação lógica, e a chave é reivindicada
 * antes de qualquer dispatch.
 *
 * E4 — classificação do efeito:
 * - sucesso (`success: true`) → claim `completed`;
 * - `delivery: 'unknown'` (efeito possivelmente ocorrido) → claim `unknown`,
 *   TERMINAL: a mesma chave NUNCA reexecuta, mesmo depois do TTL de 600s;
 * - demais falhas determinísticas → claim `failed` (retry liberado no TTL).
 *
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
    isDeliveryUnknown: (r) => r.delivery === 'unknown',
  });
  if (guarded.deduped) {
    // Replay de claim: provider NÃO é chamado. `unknown` NUNCA vira sucesso —
    // devolve o próprio estado de entrega desconhecida (sem messageId), para
    // a Action mapear `unknown_effect` e a reconciliação ser manual.
    if (guarded.deliveryUnknown) {
      return {
        success: false,
        delivery: 'unknown',
        error: UNKNOWN_DELIVERY_ERROR,
        deduplicated: true,
      };
    }
    return { success: true, deduplicated: true };
  }
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
      // E4: claim único englobando WAHA + fallback sidecar (sem repasse da
      // chave ao leaf). O fallback só ocorre em falha determinística
      // pré-dispatch — ver `dispatchWithSidecarFallback`.
      const adapter = wahaAdapter;
      return runIdempotentSend(idempotencyKey, () =>
        dispatchWithSidecarFallback('waha', phone, message, () => adapter.sendTextMessage(phone, message)),
      );
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
      // E4: idem WAHA — fallback só em falha determinística pré-dispatch.
      const adapter = evolutionAdapter;
      return runIdempotentSend(idempotencyKey, () =>
        dispatchWithSidecarFallback('evolution', phone, message, () => adapter.sendTextMessage(phone, message)),
      );
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

/**
 * Dispatch outbound message by channel.
 *
 * `idempotencyKey` (opcional) é ancorado pelo caller em uma operação lógica
 * estável (ex.: job do outbox) e vale SOMENTE para WhatsApp: a chave é
 * reivindicada antes de qualquer dispatch e cobre WAHA + fallback sidecar sob
 * o MESMO claim. Instagram e web preservam os contratos existentes (sem
 * chave).
 */
export async function sendByChannel(
  channel: 'whatsapp' | 'instagram' | 'web',
  to: string,
  text: string,
  idempotencyKey?: string,
): Promise<SendResult> {
  switch (channel) {
    case 'whatsapp':
      return sendWhatsApp(to, text, idempotencyKey);
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
      // E4: WAHA é o canal; fallback sidecar só em falha determinística
      // pré-dispatch (ver `dispatchWithSidecarFallback`).
      const adapter = wahaAdapter;
      return dispatchWithSidecarFallback('waha', to, text, () => adapter.sendTextMessage(to, text));
    }
    // Sem WAHA disponível: caminho legado da Evolution (contratos idênticos).
    let evolutionAdapter: WhatsAppProviderAdapter | null = null;
    try {
      evolutionAdapter = resolveEvolutionAdapter();
    } catch (err: unknown) {
      dbLogger.error('channel-service: evolution resolve failed', err);
      evolutionAdapter = null;
    }
    if (evolutionAdapter) {
      const adapter = evolutionAdapter;
      return dispatchWithSidecarFallback('evolution', to, text, () => adapter.sendTextMessage(to, text));
    }
    // Nenhum provider adapter disponível: fallback sidecar terminal
    // (determinístico) ou erro fail-closed conhecido.
    return isFallbackConfigured()
      ? getWhatsAppService().sendMessage(to, text)
      : { success: false, error: 'Evolution service not available' };
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
      // Único resultado determinístico deste método: nada saiu para a rede
      // (config ausente). Falha conhecida — campo `delivery` omitido.
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

      // E4 (HIGH-2): a partir daqui o POST PODE ter sido despachado. O
      // sidecar não possui contrato que prove não-dispatch (nenhuma resposta
      // documentada garante "nada foi enviado"), portanto TODO desfecho
      // não-sucesso é ambíguo: status não-ok, JSON inválido ou
      // `success:false` reportado. Nenhum fallback, nenhum retry — o caller
      // recebe `delivery: 'unknown'` e reconcilia manualmente.
      if (!res.ok) {
        dbLogger.warn(
          `channel-service: sidecar sendMessage returned HTTP ${res.status}; delivery unknown`,
        );
        return { success: false, error: UNKNOWN_DELIVERY_ERROR, delivery: 'unknown' };
      }

      let result: SendResult;
      try {
        result = await res.json() as SendResult;
      } catch {
        dbLogger.warn('channel-service: sidecar sendMessage returned an unparsable body; delivery unknown');
        return { success: false, error: UNKNOWN_DELIVERY_ERROR, delivery: 'unknown' };
      }

      if (!result || result.success !== true) {
        dbLogger.warn('channel-service: sidecar sendMessage reported failure; delivery unknown');
        return { success: false, error: UNKNOWN_DELIVERY_ERROR, delivery: 'unknown' };
      }

      this.lastActivity = new Date();
      return result;
    } catch (err) {
      // Timeout, falha de transporte ou exceção inesperada: o request pode ter
      // chegado ao sidecar. Ambíguo — mensagem fixa, detalhe só no log.
      dbLogger.error('channel-service: sidecar sendMessage failed', err);
      return { success: false, error: UNKNOWN_DELIVERY_ERROR, delivery: 'unknown' };
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
