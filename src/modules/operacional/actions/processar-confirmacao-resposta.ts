import { z } from 'zod/v3';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { processTrustedConfirmation } from '../services/confirmation-service';
import { obterEventoInboundAutentico } from '@/modules/atendimento/public';

export const processarConfirmacaoResposta = defineAction({
  name: 'operacional.processarConfirmacaoResposta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Processar resposta de confirmação via WhatsApp',
  input: z.object({
    conversationId: z.string().uuid(),
    // REQUIRED real inbound event id (provider message identity). It anchors
    // idempotent consumption and unknown-outcome reconcile. Deriving
    // idempotency from message text is forbidden: identical texts are
    // distinct replies and must never share a consumption record.
    // Caller text is deliberately NOT accepted: the canonical content,
    // sender, provider and timestamp come ONLY from the persisted
    // authenticated inbound row resolved below.
    eventId: z.string().min(1).max(255),
  }).strict(),
  handler: async (input, ctx: ActionContext) => {
    // Trust boundary: the ONLY trusted values are the DB-derived
    // (clinic, conversation, sender, content, provider, event, authenticated
    // provider event time, type, kind) of one persisted authentic inbound
    // WhatsApp row. A fabricated eventId, a row in the wrong conversation,
    // a non-inbound row, a row from an unauthenticated provider (e.g.
    // deprecated `evolution`), a non-text media row, or a row WITHOUT a
    // valid provider event time yields no mutation. The Action takes no
    // phone, message, appointment, sender or provider ids at all — only a
    // conversation the caller's clinic owns plus the inbound event identity.
    // It is deliberately NOT in AGENT_SAFE_ACTIONS: the bridge must never
    // invoke it with a model-chosen conversation/event pair.
    const event = await obterEventoInboundAutentico(ctx.clinicId, input.conversationId, input.eventId);
    if (!event) {
      return { processed: false, action: 'no_action', reason: 'sender_mismatch' };
    }
    return processTrustedConfirmation({
      clinicId: ctx.clinicId,
      conversationId: event.conversationId,
      senderPhone: event.senderPhone,
      content: event.content,
      externalProvider: event.externalProvider,
      externalMessageId: event.externalMessageId,
      receivedAt: event.eventTime ?? undefined,
      messageType: event.messageType,
      messageKind: event.messageKind,
    });
  },
});
