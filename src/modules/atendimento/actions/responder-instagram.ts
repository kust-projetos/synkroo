/**
 * Instagram DM reply action.
 *
 * Bridges to the existing Instagram Graph API send flow.
 * Route-layer handles 24h window check; this action just sends.
 */
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import * as repo from '../repositories/conversations-repository';

const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || '';
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || '';

async function sendInstagramMessage(accountId: string, to: string, message: string): Promise<boolean> {
  const apiUrl = `https://graph.facebook.com/v18.0/${accountId}/messages`;
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${INSTAGRAM_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient: { id: to }, message: { text: message } }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('[responderInstagram] Send error:', err);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[responderInstagram] Failed to send:', error);
    return false;
  }
}

export const responderInstagram = defineAction({
  name: 'atendimento.responderInstagram',
  module: 'atendimento',
  requires: 'atendimento:manage_messages',
  label: 'Responder DM Instagram',
  input: z.object({
    conversationId: z.string().uuid(),
    message: z.string().min(1),
    accountId: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const conv = await repo.findById(input.conversationId);
    if (!conv) throw new ActionError('not_found', 'Conversa não encontrada.');
    if (conv.clinicId !== ctx.clinicId) throw new ActionError('forbidden', 'Acesso negado.');

    const accountId = input.accountId ?? INSTAGRAM_ACCOUNT_ID;
    if (!accountId) throw new ActionError('internal', 'Instagram account ID not configured.');

    const sent = await sendInstagramMessage(accountId, conv.externalId, input.message);
    if (!sent) throw new ActionError('internal', 'Falha ao enviar DM Instagram.');

    // Store outbound message
    const message = await repo.createMessage({
      conversationId: input.conversationId,
      direction: 'outbound',
      content: input.message,
    });
    await repo.updateConversation(input.conversationId, {
      lastMessageAt: new Date(),
      messageCountIncrement: 1,
    });

    return { messageId: message.id };
  },
});
