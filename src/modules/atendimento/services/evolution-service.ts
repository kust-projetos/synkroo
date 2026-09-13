/**
 * Evolution API Service — atendimento module (P2 port).
 *
 * Ported from legacy @/services/whatsapp/evolution.service.ts.
 * WhatsApp integration via Evolution API v2.
 * Docs: https://doc.evolution-api.com/
 *
 * Usage: import { getEvolutionService } from '../services/evolution-service';
 */

import { EventEmitter } from 'events';
import { dbLogger, whatsappLogger } from '@/lib/logger';
import { getDb } from '@/lib/db/client';
import { whatsappInstances } from '@/modules/atendimento/schema/integrations';
import { eq } from 'drizzle-orm';
import { fetchWithRetry, DEFAULT_EXTERNAL_TIMEOUT_MS } from '@/lib/http/fetch-with-retry';
import { withOutboundIdempotency } from '@/lib/http/outbound-idempotency';

export interface EvolutionInstance {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
    serverUrl: string;
    apikey: string;
  };
  hash?: string;
}

export interface EvolutionQRCode {
  code: string;
  base64: string;
}

export interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
      contextInfo?: {
        quotedMessage?: any;
      };
    };
    imageMessage?: {
      url: string;
      mimetype: string;
      caption?: string;
    };
  };
  messageTimestamp: number;
  status: string;
}

export interface EvolutionWebhookEvent {
  event: string;
  instance: string;
  data: any;
}

export interface SendTextMessageInput {
  number: string;
  options?: {
    delay?: number;
    presence?: 'composing' | 'recording';
    linkPreview?: boolean;
    /**
     * Chave de idempotência da operação lógica (etapa A3). Quando presente, o
     * envio é protegido por claim local (`withOutboundIdempotency`): duplicata
     * não reenvia e retorna `{ success: true, deduplicated: true }`.
     * NENHUM header de idempotência é enviado à Evolution (sem suporte nativo
     * documentado) — o claim local é o mecanismo primário.
     */
    idempotencyKey?: string;
  };
}

export interface SendMediaMessageInput {
  number: string;
  media: string;
  mediatype: 'image' | 'video' | 'document' | 'audio';
  caption?: string;
  fileName?: string;
}

export class EvolutionApiService extends EventEmitter {
  private baseUrl: string;
  private apiKey: string;
  private instanceName: string;
  private isConnected: boolean = false;
  private instanceId: string | null = null;

  constructor(baseUrl: string, apiKey: string, instanceName: string = 'synkroo') {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.instanceName = instanceName;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
    };
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      // A2: timeout explícito em toda chamada; retry SOMENTE p/ GET/observação.
      // POST de envio NÃO retrya no client (a proteção contra duplicação é o
      // claim de idempotência da etapa A3 em sendTextMessage).
      const response = await fetchWithRetry(
        url,
        {
          method,
          headers: this.getHeaders(),
          body: body ? JSON.stringify(body) : undefined,
        },
        { timeoutMs: DEFAULT_EXTERNAL_TIMEOUT_MS, idempotent: method === 'GET' },
      );
      let data: Record<string, unknown>;
      try {
        data = (await response.json()) as Record<string, unknown>;
      } catch {
        data = {};
      }
      if (!response.ok) {
        // REVIEW-A2A3: nunca logar o body do provider (pode conter apikey e
        // outros segredos) — apenas status + mensagem sanitizada. O logger
        // serializa message/stack (redige chaves sensíveis) e ignora `cause`.
        const providerMessage = (data.message as string) || (data.error as string) || `HTTP ${response.status}`;
        whatsappLogger.error('Evolution API error', null, { status: response.status, error: providerMessage });
        return { success: false, error: providerMessage };
      }
      return { success: true, data: data as T };
    } catch (error) {
      // ExternalHttpError já é sanitizado (método+host+path, sem headers/body/query).
      whatsappLogger.error('Evolution API request failed', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async createInstance(): Promise<EvolutionInstance | null> {
    const result = await this.request<EvolutionInstance>('POST', '/instance/create', {
      name: this.instanceName,
      token: this.apiKey,
      webhook: process.env.EVOLUTION_WEBHOOK_URL || undefined,
      events: [
        'Connected', 'Disconnected', 'MessagesUpsert', 'MessagesUpdate',
      ],
    });
    if (result.success && result.data) {
      this.instanceId = result.data.instance?.instanceId || null;
      whatsappLogger.info('Evolution instance created', { instanceName: this.instanceName });
      return result.data;
    }
    return null;
  }

  async connect(): Promise<boolean> {
    const result = await this.getConnectionState();
    if (result) return result.state === 'open';

    const connectResult = await this.request('POST', '/instance/connect', {});
    if (connectResult.success) {
      this.isConnected = true;
      this.emit('connected');
      return true;
    }

    const newInstance = await this.createInstance();
    return newInstance !== null;
  }

  async getConnectionState(): Promise<{ state: string; statusReason?: number } | null> {
    // Evolution GO v0.7.2: GET /instance/status
    const result = await this.request<{ data: { Connected: boolean; LoggedIn: boolean; Name: string } }>(
      'GET', '/instance/status',
    );
    if (result.success && result.data) {
      this.isConnected = result.data.data?.Connected === true;
      return { state: this.isConnected ? 'open' : 'close', statusReason: this.isConnected ? 200 : 0 };
    }
    return null;
  }

  async getQRCode(): Promise<EvolutionQRCode | null> {
    const result = await this.request<{ code: string; base64: string }>(
      'GET', '/instance/qr',
    );
    if (result.success && result.data) {
      this.emit('qrcode', result.data.base64);
      return { code: result.data.code, base64: result.data.base64 };
    }
    return null;
  }

  async logout(): Promise<boolean> {
    const result = await this.request('DELETE', '/instance/logout');
    this.isConnected = false;
    return result.success;
  }

  async deleteInstance(): Promise<boolean> {
    const result = await this.request('DELETE', `/instance/delete/${this.instanceName}`);
    this.instanceId = null;
    this.isConnected = false;
    return result.success;
  }

  async sendTextMessage(
    number: string, text: string, options?: SendTextMessageInput['options'],
  ): Promise<{ success: boolean; messageId?: string; error?: string; deduplicated?: boolean }> {
    let formattedNumber = number.replace(/\D/g, '');
    if (!formattedNumber.startsWith('55')) formattedNumber = '55' + formattedNumber;

    const send = async (): Promise<{ success: boolean; messageId?: string; error?: string }> => {
      // Evolution GO v0.7.2: POST /send/text (instance resolved by apikey token)
      const result = await this.request<{ data: { Info: { ID: string } } }>(
        'POST', '/send/text',
        { number: formattedNumber, text, delay: options?.delay || 0 },
      );
      if (result.success && result.data) {
        return { success: true, messageId: result.data.data?.Info?.ID };
      }
      return { success: false, error: result.error };
    };

    // A3: sem chave → comportamento legado (envio direto, sem claim).
    if (!options?.idempotencyKey) return send();

    const guarded = await withOutboundIdempotency(options.idempotencyKey, send, {
      isSuccess: (r) => r.success,
    });
    if (guarded.deduped) return { success: true, deduplicated: true };
    return guarded.result ?? { success: false, error: 'Idempotency claim failed' };
  }

  async sendMediaMessage(
    input: SendMediaMessageInput,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let formattedNumber = input.number.replace(/\D/g, '');
    if (!formattedNumber.startsWith('55')) formattedNumber = '55' + formattedNumber;

    // Evolution GO v0.7.2: POST /send/media (instance resolved by apikey token)
    const result = await this.request<{ data: { Info: { ID: string } } }>(
      'POST', '/send/media',
      {
        number: formattedNumber,
        mediatype: input.mediatype,
        media: input.media,
        caption: input.caption,
        fileName: input.fileName,
      },
    );
    if (result.success && result.data) {
      return { success: true, messageId: result.data.data?.Info?.ID };
    }
    return { success: false, error: result.error };
  }

  async sendButtonsMessage(
    number: string, title: string, description: string,
    buttons: Array<{ buttonText: string; buttonId: string }>,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let formattedNumber = number.replace(/\D/g, '');
    if (!formattedNumber.startsWith('55')) formattedNumber = '55' + formattedNumber;

    const result = await this.request<{ key: { id: string } }>(
      'POST', `/message/sendButtons/${this.instanceName}`,
      {
        number: formattedNumber,
        buttonsMessage: {
          title, description, type: 'buttons',
          buttons: buttons.map((btn, index) => ({
            buttonId: btn.buttonId || `btn_${index}`,
            buttonText: { displayText: btn.buttonText },
            type: 1,
          })),
        },
      },
    );
    if (result.success && result.data) {
      return { success: true, messageId: result.data.key?.id };
    }
    return { success: false, error: result.error };
  }

  async sendTemplateMessage(
    number: string, templateName: string, language: string = 'pt_BR',
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let formattedNumber = number.replace(/\D/g, '');
    if (!formattedNumber.startsWith('55')) formattedNumber = '55' + formattedNumber;

    const result = await this.request<{ key: { id: string } }>(
      'POST', `/message/sendTemplate/${this.instanceName}`,
      { number: formattedNumber, templateMessage: { name: templateName, language } },
    );
    if (result.success && result.data) {
      return { success: true, messageId: result.data.key?.id };
    }
    return { success: false, error: result.error };
  }

  async markAsRead(messageId: string, remoteJid: string): Promise<boolean> {
    const result = await this.request(
      'POST', `/chat/markMessageAsRead/${this.instanceName}`,
      { readMessages: [{ id: messageId, remoteJid, fromMe: false }] },
    );
    return result.success;
  }

  async getMessages(
    remoteJid: string,
    options?: { count?: number; index?: number; direction?: 'before' | 'after' },
  ): Promise<EvolutionMessage[]> {
    const result = await this.request<{ messages: EvolutionMessage[] }>(
      'POST', `/chat/findMessages/${this.instanceName}`,
      { where: { key: { remoteJid } }, limit: options?.count || 50 },
    );
    return result.success ? result.data?.messages || [] : [];
  }

  async getChats(): Promise<any[]> {
    const result = await this.request<any[]>('GET', `/chat/findChats/${this.instanceName}`);
    return result.success ? result.data || [] : [];
  }

  async checkNumber(number: string): Promise<{ exists: boolean; jid?: string }> {
    let formattedNumber = number.replace(/\D/g, '');
    if (!formattedNumber.startsWith('55')) formattedNumber = '55' + formattedNumber;

    const result = await this.request<{ exists: boolean; jid: string }>(
      'POST', `/chat/whatsappNumbers/${this.instanceName}`,
      { numbers: [formattedNumber] },
    );
    if (result.success && result.data) {
      return { exists: result.data.exists ?? false, jid: result.data.jid };
    }
    return { exists: false };
  }

  async getProfilePicture(number: string): Promise<string | null> {
    let formattedNumber = number.replace(/\D/g, '');
    if (!formattedNumber.startsWith('55')) formattedNumber = '55' + formattedNumber;

    const result = await this.request<{ wuid: string; profilePicture: string }>(
      'POST', `/chat/fetchProfilePicture/${this.instanceName}`,
      { number: formattedNumber },
    );
    return result.success ? result.data?.profilePicture || null : null;
  }

  processWebhookEvent(event: EvolutionWebhookEvent): void {
    switch (event.event) {
      case 'CONNECTION_UPDATE': this.handleConnectionUpdate(event.data); break;
      case 'QRCODE_UPDATED': this.handleQRCodeUpdate(event.data); break;
      case 'MESSAGES_UPSERT': this.handleMessageUpsert(event.data); break;
      case 'MESSAGES_UPDATE': this.handleMessageUpdate(event.data); break;
      default: dbLogger.debug('Unhandled webhook event', { event: event.event });
    }
  }

  private handleConnectionUpdate(data: any): void {
    const { state, statusReason } = data;
    this.isConnected = state === 'open';
    if (this.isConnected) {
      this.emit('connected');
      whatsappLogger.info('WhatsApp connected via Evolution API');
    } else {
      this.emit('disconnected', { state, statusReason });
      whatsappLogger.warn('WhatsApp disconnected', { state, statusReason });
    }
  }

  private handleQRCodeUpdate(data: any): void {
    const { qrcode } = data;
    if (qrcode) {
      this.emit('qrcode', qrcode);
      whatsappLogger.info('QR code received');
    }
  }

  private handleMessageUpsert(data: any): void {
    const { messages: msgs } = data;
    if (msgs && Array.isArray(msgs)) {
      for (const msg of msgs) {
        if (!msg.key.fromMe) {
          this.emit('message', {
            id: msg.key.id,
            from: msg.key.remoteJid,
            to: 'me',
            body: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
            timestamp: new Date(msg.messageTimestamp * 1000),
            type: msg.message?.imageMessage ? 'image' : 'text',
            isFromMe: false,
          });
        }
      }
    }
  }

  private handleMessageUpdate(data: any): void {
    const { key, status } = data;
    this.emit('messageStatus', { messageId: key.id, status, timestamp: new Date() });
  }

  getInstanceName(): string { return this.instanceName; }
  getConnectionStatus(): boolean { return this.isConnected; }
}

// ─── Singleton ──────────────────────────────────────────────────

let evolutionInstance: EvolutionApiService | null = null;

export function getEvolutionService(): EvolutionApiService | null {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'synkroo';
  if (!baseUrl || !apiKey) return null;
  if (!evolutionInstance) {
    evolutionInstance = new EvolutionApiService(baseUrl, apiKey, instanceName);
  }
  return evolutionInstance;
}

// ─── DB-backed helpers (replaces getDb() in status-evolution action) ───

export interface InstanceInfo {
  instanceName: string;
  status: string;
  lastConnectedAt: Date | null;
  createdAt: Date | null;
}

/** Get Evolution instance info from DB for a clinic. */
export async function getInstanceInfo(clinicId: string): Promise<InstanceInfo[]> {
  const db = getDb();
  const instances = await db
    .select({
      instanceName: whatsappInstances.evolutionInstanceName,
      status: whatsappInstances.status,
      lastConnectedAt: whatsappInstances.lastConnectedAt,
      createdAt: whatsappInstances.createdAt,
    })
    .from(whatsappInstances)
    .where(eq(whatsappInstances.clinicId, clinicId))
    .limit(1);
  return instances.map((i) => ({
    instanceName: i.instanceName ?? 'unknown',
    status: i.status ?? 'unknown',
    lastConnectedAt: i.lastConnectedAt,
    createdAt: i.createdAt,
  }));
}
