/**
 * Webhook processor service.
 *
 * Bridges Meta Business API and Evolution API webhook processing.
 * Preserves existing behavior: message storage, confirmation handling, waitlist, lead capture, and agent routing.
 *
 * All DB access delegated to conversations-repository; no direct getDb() usage.
 */
import { sendWhatsAppMessage } from './channel-service';
import { resolveInboundReply, buscarPacientePorTelefone } from '@/modules/operacional/public';
import { whatsappLogger } from '@/lib/logger';
import * as repo from '../repositories/conversations-repository';
import { routeInboundToAgent } from '@/core/ia-channel/webhook-router';
import { resolveInterlocutor } from '@/core/ia-channel/interlocutor';
import { buscarLeadPorTelefone } from '@/modules/comercial/public';
import { parseProviderEventTimestamp } from '../integrations/event-timestamp';
import { runAction } from '@/core/actions/run';
import { buildSystemContext } from '@/core/actions/context';
import { enviarMensagem } from '../actions/enviar-mensagem';
import { capturarLeadInbound } from '@/modules/comercial/public';
import { invokeAgent } from '@/core/ia-channel/agent-invoker';

export async function processMetaWebhookEntry(entry: Record<string, unknown>, clinicId?: string) {
  const changes = (entry.changes as Array<Record<string, unknown>>) || [];
  const results: Array<{ from: string; action: string }> = [];

  for (const change of changes) {
    const value = change.value as Record<string, unknown> | undefined;
    if (!value) continue;

    // Handle incoming messages
    if (value.messages) {
      for (const msg of value.messages as Array<Record<string, unknown>>) {
        const result = await storeAndProcessMetaMessage(msg, value, 'whatsapp', clinicId);
        if (result) results.push(result);
      }
    }

    // Handle message status updates
    if (value.statuses) {
      for (const status of value.statuses as Array<Record<string, unknown>>) {
        await processStatusUpdate(status);
      }
    }
  }
  return results;
}

export async function processEvolutionMessage(data: Record<string, unknown>, instanceName: string) {
  const key = data.key as Record<string, unknown> | undefined;
  if (!key || !key.remoteJid) return [];

  const fromMe = key.fromMe as boolean;
  if (fromMe) return [];

  const phone = extractPhone(key);
  if (!phone || phone.length < 10) return [];

  const { content, messageType } = extractContent(data);
  if (!content) return [];

  const clinicId = await repo.getClinicByInstance(instanceName);
  if (!clinicId) return [];

  const results: Array<{ from: string; action: string }> = [];

  // Get or create conversation
  const conv = await repo.findOrCreateConversation(clinicId, 'whatsapp', phone);
  if (!conv) return [];

  // Store inbound message with dedup by externalMessageId (key.id)
  const messageId = key.id as string;
  // Button taps are marked in the persisted context (metadata flag): a
  // plain body:'SIM' inside a known button payload must not become regular
  // text downstream. `selectedId` itself is never trusted (see below).
  const isButtonTap = !!(data.message && (data.message as Record<string, unknown>).buttonsResponseMessage);
  const storeResult = await repo.appendInboundMessageDeduped({
    conversationId: conv.id,
    externalProvider: 'evolution',
    content,
    externalMessageId: messageId,
    messageType: messageType as string,
    metadata: {
      whatsapp_message_id: messageId,
      instance: instanceName,
      ...(isButtonTap ? { button_response: true } : {}),
    } as Record<string, unknown>,
  });
  if (storeResult.deduped) return [];

  // Button taps: the client-supplied appointment id (`selectedId`) is
  // IGNORED entirely — it never authorizes a status change and there is
  // no pending-record-free mutation path. Only the display text goes
  // through the trusted pending-confirmation resolver; anything it does
  // not confirm escalates to a human (negative buttons never cancel).
  if (data.message && (data.message as Record<string, unknown>).buttonsResponseMessage) {
    const buttonResult = await handleButtonText(data, clinicId, phone, conv.id, 'evolution', messageId, storeResult.receivedAt ?? undefined);
    if (buttonResult) {
      results.push(buttonResult);
      await repo.updateConversationTimestamp(clinicId, conv.id, new Date());
      return results;
    }
    await repo.escalateConversation(conv.id, clinicId);
    await repo.updateConversationTimestamp(clinicId, conv.id, new Date());
    return [{ from: phone, action: 'escalated' }];
  }

  // Text reply through the single trusted decision point. Escalation
  // stops here: no silent fallthrough to the waitlist parser or agent.
  // (The deprecated evolution path carries no provider clock, so it
  // escalates on missing event time — it can never mutate anyway.)
  const replyResult = await handleTrustedReply(clinicId, phone, content, conv.id, 'evolution', messageId, false, {
    receivedAt: storeResult.receivedAt ?? undefined,
    messageType,
    messageKind: 'text',
  });
  if (replyResult) { results.push(replyResult); await repo.updateConversationTimestamp(clinicId, conv.id, new Date()); return results; }

  // Lead capture via comercial action layer (best-effort)
  try {
    await capturarLeadInbound({
      clinicId,
      phone,
      name: phone,
      source: 'whatsapp',
    });
  } catch { /* non-fatal */ }

  // Roteia para o agente IA
  const agentResult = await routeInboundToAgent({
    resolveInterlocutor: (cId, ph) => resolveInterlocutor({
      findPatientByPhone: (value, id) => buscarPacientePorTelefone(id, value),
      findLeadByPhone: (value, id) => buscarLeadPorTelefone(id, value),
    }, cId, ph),
    invokeAgent,
    sendReply: async (convId, msg) => {
      const ctx = await buildSystemContext(clinicId);
      const r = await runAction(
        enviarMensagem,
        { conversationId: convId, message: msg, channel: 'whatsapp' },
        ctx,
      );
      if (!r.ok) {
        whatsappLogger.error('[ia] enviarMensagem falhou', null, {
          conversationId: convId,
          error: r.error.code,
        });
      }
      return r.ok;
    },
    timezone: 'America/Sao_Paulo',
  }, { clinicId, conversationId: conv.id, phone, content });
  results.push(agentResult);
  await repo.updateConversationTimestamp(clinicId, conv.id, new Date());
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────

function extractPhone(key: Record<string, unknown>): string | null {
  const remoteJid = key.remoteJid as string;
  const remoteJidAlt = (key as any).remoteJidAlt as string | undefined;
  let phone: string;
  if (remoteJid.endsWith('@lid') && remoteJidAlt) {
    phone = remoteJidAlt.split('@')[0];
  } else {
    phone = remoteJid.split('@')[0];
  }
  return phone || null;
}

function extractContent(data: Record<string, unknown>): { content: string; messageType: string } {
  const msg = data.message as Record<string, unknown> | undefined;
  if (!msg) return { content: '', messageType: 'text' };
  if (msg.conversation) return { content: msg.conversation as string, messageType: 'text' };
  if ((msg as any).extendedTextMessage?.text) return { content: (msg as any).extendedTextMessage.text, messageType: 'text' };
  if ((msg as any).imageMessage) return { content: (msg as any).imageMessage.caption || '[Image]', messageType: 'image' };
  if ((msg as any).audioMessage) return { content: '[Audio]', messageType: 'audio' };
  if ((msg as any).documentMessage) return { content: (msg as any).documentMessage.fileName || '[Document]', messageType: 'document' };
  if ((msg as any).buttonsResponseMessage) return { content: (msg as any).buttonsResponseMessage.selectedDisplayText || '', messageType: 'text' };
  return { content: '', messageType: 'text' };
}

async function storeAndProcessMetaMessage(
  msg: Record<string, unknown>,
  value: Record<string, unknown>,
  channel: string,
  clinicId?: string,
): Promise<{ from: string; action: string } | null> {
  const from = msg.from as string;
  const type = msg.type as string;
  const msgId = msg.id as string;

  // Extract content
  let content = '';
  let msgType: 'text' | 'image' | 'audio' | 'document' = 'text';
  if (type === 'text' && msg.text) content = (msg.text as Record<string, unknown>).body as string;
  else if (type === 'image' && msg.image) { content = (msg.image as Record<string, unknown>).caption as string || '[Image]'; msgType = 'image'; }
  else if (type === 'audio' && msg.audio) { content = '[Audio]'; msgType = 'audio'; }
  else if (type === 'document' && msg.document) { content = (msg.document as Record<string, unknown>).caption as string || '[Document]'; msgType = 'document'; }
  else return null;

  if (!content) return null;

  // Resolve clinic
  const phoneNumberId = (value.metadata as Record<string, unknown> | undefined)?.phone_number_id as string | undefined;
  const cId = clinicId || (phoneNumberId ? await repo.getClinicByPhoneNumber(phoneNumberId) : null);
  if (!cId) return null;

  // Get or create conversation
  const conv = await repo.findOrCreateConversation(cId, channel, from);
  if (!conv) return null;

  // Store message with dedup by externalMessageId (msg.id from Meta).
  // The ONLY trustworthy event time is the signed provider message clock
  // (`msg.timestamp`, epoch seconds) — never the insert time.
  const eventTimestamp = parseProviderEventTimestamp((msg as Record<string, unknown>).timestamp);
  const storeResult = await repo.appendInboundMessageDeduped({
    conversationId: conv.id,
    externalProvider: 'meta',
    content,
    externalMessageId: msgId,
    messageType: msgType,
    eventTimestamp,
    metadata: { whatsapp_message_id: msgId, phone_number_id: phoneNumberId } as Record<string, unknown>,
  });
  if (storeResult.deduped) {
    whatsappLogger.info('[webhook-processor] Meta msg deduped', { from, msgId });
    return null;
  }

  // Text reply through the single trusted decision point. Escalation
  // stops here: no silent fallthrough to the waitlist parser or agent.
  // The ONLY trustworthy event time is the parsed provider clock above —
  // never storeResult.createdAt (insert time) nor any other DB timestamp.
  // Missing/invalid fails closed downstream (escalate, never mutate).
  const replyResult = await handleTrustedReply(cId, from, content, conv.id, 'meta', msgId, false, {
    receivedAt: eventTimestamp ? new Date(eventTimestamp) : undefined,
    messageType: msgType,
    messageKind: 'text',
  });
  if (replyResult) { await repo.updateConversationTimestamp(cId, conv.id, new Date()); return replyResult; }

  // Roteia para o agente IA
  const agentResult = await routeInboundToAgent({
    resolveInterlocutor: (cId, ph) => resolveInterlocutor({
      findPatientByPhone: (value, id) => buscarPacientePorTelefone(id, value),
      findLeadByPhone: (value, id) => buscarLeadPorTelefone(id, value),
    }, cId, ph),
    invokeAgent,
    sendReply: async (convId, msg) => {
      const ctx = await buildSystemContext(cId);
      const r = await runAction(
        enviarMensagem,
        { conversationId: convId, message: msg, channel: 'whatsapp' },
        ctx,
      );
      if (!r.ok) {
        whatsappLogger.error('[ia] enviarMensagem falhou', null, {
          conversationId: convId,
          error: r.error.code,
        });
      }
      return r.ok;
    },
    timezone: 'America/Sao_Paulo',
  }, { clinicId: cId, conversationId: conv.id, phone: from, content });
  await repo.updateConversationTimestamp(cId, conv.id, new Date());
  return agentResult;
}

async function handleButtonText(
  data: Record<string, unknown>,
  clinicId: string,
  phone: string,
  convId: string,
  externalProvider: string,
  externalMessageId: string,
  receivedAt?: Date | null,
): Promise<{ from: string; action: string } | null> {
  const msg = data.message as Record<string, unknown> | undefined;
  const button = msg?.buttonsResponseMessage as Record<string, unknown> | undefined;
  const displayText = typeof button?.selectedDisplayText === 'string' ? button.selectedDisplayText : '';
  if (!displayText) return null;
  // `selectedId` is deliberately never read: a client-supplied appointment
  // id cannot authorize anything. Only the display text is resolved, marked
  // as a button tap so it can never schedule a waitlist offer.
  return handleTrustedReply(clinicId, phone, displayText, convId, externalProvider, externalMessageId, true, {
    allowWaitlist: false,
    receivedAt,
    messageType: 'text',
    messageKind: 'button',
  });
}

/**
 * Single trusted reply path for both text and button display text.
 *
 * - confirmed / waitlist_scheduled → persist the outbound reply, send it,
 *   and report the decision.
 * - escalate → mark the conversation escalated (human handoff, status
 *   only — no external send) and report it.
 * - agent → null ONLY when the caller allows agent fallback (`false` for
 *   plain text, never for button taps which always escalate instead).
 * - Button taps pass `allowWaitlist: false`: a button SIM may consume only
 *   a single valid pending confirmation, never a waitlist offer.
 */
async function handleTrustedReply(
  clinicId: string,
  phone: string,
  content: string,
  convId: string,
  externalProvider: string,
  externalMessageId: string,
  buttonTap: boolean,
  opts?: { allowWaitlist?: boolean; receivedAt?: Date | null; messageType?: string; messageKind?: 'text' | 'button' },
): Promise<{ from: string; action: string } | null> {
  const decision = await resolveInboundReply({
    clinicId,
    conversationId: convId,
    senderPhone: phone,
    content,
    externalProvider,
    externalMessageId,
    messageType: opts?.messageType ?? 'text',
    messageKind: opts?.messageKind ?? (buttonTap ? 'button' : 'text'),
    receivedAt: opts?.receivedAt,
  }, opts);
  if (decision.kind === 'confirmed') {
    await repo.appendOutboundMessage(clinicId, {
      conversationId: convId,
      content: decision.responseMessage,
      messageType: 'text',
      intent: 'confirmacao',
    });
    await sendWhatsAppMessage(phone, decision.responseMessage);
    return { from: phone, action: 'confirmation' };
  }
  if (decision.kind === 'waitlist_scheduled') {
    await repo.appendOutboundMessage(clinicId, {
      conversationId: convId,
      content: decision.responseMessage,
      messageType: 'text',
      intent: 'agendamento',
    });
    await sendWhatsAppMessage(phone, decision.responseMessage);
    return { from: phone, action: 'waitlist' };
  }
  if (decision.kind === 'escalate' || buttonTap) {
    await repo.escalateConversation(convId, clinicId);
    return { from: phone, action: 'escalated' };
  }
  return null;
}

async function processStatusUpdate(status: Record<string, unknown>) {
  // Store status updates in message metadata
  // Currently a no-op placeholder
}

export async function processInstagramEntry(entry: Record<string, unknown>): Promise<Array<{ from: string; message: string }>> {
  const messaging = (entry.messaging as Array<Record<string, unknown>>) || [];
  const processed: Array<{ from: string; message: string }> = [];

  for (const event of messaging) {
    const senderId = event.sender as Record<string, unknown> | undefined;
    const message = event.message as Record<string, unknown> | undefined;
    if (!senderId?.id || !message) continue;

    const now = Date.now();
    const msgTime = parseInt(event.timestamp as string);
    if ((now - msgTime) / (1000 * 60 * 60) > 24) continue;

    let content = '';
    let msgType: 'text' | 'image' | 'audio' = 'text';
    if (message.text) { content = message.text as string; }
    else if (message.attachments) {
      const att = (message.attachments as Array<Record<string, unknown>>)[0];
      if (att.type === 'image') { content = '[Image]'; msgType = 'image'; }
      else if (att.type === 'audio') { content = '[Audio]'; msgType = 'audio'; }
      else content = '[Attachment]';
    }
    if (!content) continue;

    const recipient = event.recipient as Record<string, unknown> | undefined;
    const clinicId = await repo.getClinicByInstagramAccountId(recipient?.id as string);
    if (!clinicId) continue;

    const conv = await repo.findOrCreateConversation(clinicId, 'instagram', senderId.id as string);
    if (!conv) continue;

    const instagramMsgId = (message as any).mid as string | undefined;
    const msgMetadata: Record<string, unknown> = { instagram_sender_id: senderId.id, timestamp: event.timestamp };
    if (instagramMsgId) msgMetadata.instagram_message_id = instagramMsgId;

    const storeResult = await repo.appendInboundMessageDeduped({
      conversationId: conv.id,
      externalProvider: 'instagram',
      content,
      externalMessageId: instagramMsgId,
      messageType: msgType,
      metadata: msgMetadata,
    });
    if (storeResult.deduped) continue;
    await repo.updateConversationTimestamp(clinicId, conv.id, new Date());
    processed.push({ from: senderId.id as string, message: content });
  }
  return processed;
}
