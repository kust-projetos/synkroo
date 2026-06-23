/**
 * Atendimento — send message service (P2 — delegates to module channel service).
 *
 * Thin re-export layer. All channel logic lives in channel-service.ts.
 * Kept for backward compatibility with actions that already import from here
 * (enviar-mensagem, responder-instagram).
 */

import { dbLogger } from '@/lib/logger';
import { getEvolutionService } from './evolution-service';

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsApp(to: string, text: string): Promise<SendResult> {
  try {
    const evolution = getEvolutionService();
    if (!evolution) return { success: false, error: 'Evolution service not available' };
    const result = await evolution.sendTextMessage(to, text);
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    dbLogger.error('send-message-service: evolution send failed', err);
    return { success: false, error: msg };
  }
}

export async function sendInstagram(_to: string, _text: string): Promise<SendResult> {
  dbLogger.warn('send-message-service: instagram send not implemented');
  return { success: false, error: 'Instagram outbound not yet implemented' };
}

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
