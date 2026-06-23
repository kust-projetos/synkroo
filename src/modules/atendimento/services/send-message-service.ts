/**
 * Atendimento — send message service.
 *
 * Dispatches outbound messages by channel.
 * WhatsApp → Evolution API
 * Instagram → Graph API (stub — full implementation depends on W5 agent)
 * Web → unsupported (widget is receive-only)
 */

import { dbLogger } from '@/lib/logger';
import { getEvolutionService } from '@/services/whatsapp';

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
  // Instagram DM sending via Graph API — deferred to W5 agent.
  // Return success=false gracefully so pipeline doesn't break.
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
