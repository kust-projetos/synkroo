/**
 * Atendimento — send message service (P2 — delegates to module channel service).
 *
 * Compatibility layer for actions that import this service. WhatsApp sending
 * delegates to channel-service for provider failover; other channel contracts
 * remain local to this legacy-facing module.
 */

import { dbLogger } from '@/lib/logger';
import { sendWhatsApp as channelSendWhatsApp, type SendResult } from './channel-service';

export type { SendResult };

export async function sendWhatsApp(to: string, text: string): Promise<SendResult> {
  return channelSendWhatsApp(to, text);
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
