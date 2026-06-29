/**
 * Webhook processor service.
 *
 * Bridges Meta Business API and Evolution API webhook processing.
 * Preserves existing behavior: message storage, confirmation handling, waitlist, lead capture.
 * AI processing disabled — deferred to W5.3.
 *
 * All DB access delegated to conversations-repository; no direct getDb() usage.
 */
import { sendWhatsAppMessage } from './channel-service';
import { processConfirmationResponse, processWaitlistConfirmation } from '@/services/appointments/confirmation-handler.service';
import { captureLeadFromWhatsApp } from '@/services/leads/leads.service';
import { whatsappLogger } from '@/lib/logger';
import * as repo from '../repositories/conversations-repository';
import { routeInboundToAgent } from '@/core/ia-channel/webhook-router';
import { resolveInterlocutor } from '@/core/ia-channel/interlocutor';
import { findPatientByPhone } from '@/repositories/patients';
import { findLeadByPhone } from '@/repositories/leads';
import { runAction } from '@/core/actions/run';
import { buildSystemContext } from '@/core/actions/context';
import { enviarMensagem } from '../actions/enviar-mensagem';
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
  const storeResult = await repo.appendInboundMessageDeduped({
    conversationId: conv.id,
    content,
    externalMessageId: messageId,
    messageType: messageType as string,
    metadata: { whatsapp_message_id: messageId, instance: instanceName } as Record<string, unknown>,
  });
  if (storeResult.deduped) return [];

  // Handle button responses
  const buttonResult = await handleButtonResponse(data, clinicId, phone, conv.id);
  if (buttonResult) {
    results.push(buttonResult);
    await repo.updateConversationTimestamp(conv.id);
    return results;
  }

  // Confirmation response
  const confirmResult = await handleConfirmation(clinicId, phone, content, conv.id);
  if (confirmResult) { results.push(confirmResult); await repo.updateConversationTimestamp(conv.id); return results; }

  // Waitlist confirmation
  const waitlistResult = await handleWaitlist(clinicId, phone, content, conv.id);
  if (waitlistResult) { results.push(waitlistResult); await repo.updateConversationTimestamp(conv.id); return results; }

  // Lead capture (best-effort)
  try { await captureLeadFromWhatsApp(phone, content, clinicId); } catch { /* non-fatal */ }

  // Roteia para o agente IA
  const agentResult = await routeInboundToAgent({
    resolveInterlocutor: (cId, ph) =>
      resolveInterlocutor({ findPatientByPhone, findLeadByPhone }, cId, ph),
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
  await repo.updateConversationTimestamp(conv.id);
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

  // Store message with dedup by externalMessageId (msg.id from Meta)
  const storeResult = await repo.appendInboundMessageDeduped({
    conversationId: conv.id,
    content,
    externalMessageId: msgId,
    messageType: msgType,
    metadata: { whatsapp_message_id: msgId, phone_number_id: phoneNumberId } as Record<string, unknown>,
  });
  if (storeResult.deduped) {
    whatsappLogger.info('[webhook-processor] Meta msg deduped', { from, msgId });
    return null;
  }

  // Check confirmation, waitlist
  const confirmResult = await handleConfirmation(cId, from, content, conv.id);
  if (confirmResult) { await repo.updateConversationTimestamp(conv.id); return confirmResult; }
  const waitlistResult = await handleWaitlist(cId, from, content, conv.id);
  if (waitlistResult) { await repo.updateConversationTimestamp(conv.id); return waitlistResult; }

  // Roteia para o agente IA
  const agentResult = await routeInboundToAgent({
    resolveInterlocutor: (cId, ph) =>
      resolveInterlocutor({ findPatientByPhone, findLeadByPhone }, cId, ph),
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
  await repo.updateConversationTimestamp(conv.id);
  return agentResult;
}

async function handleButtonResponse(
  data: Record<string, unknown>,
  clinicId: string,
  phone: string,
  convId: string,
): Promise<{ from: string; action: string } | null> {
  const msg = data.message as Record<string, unknown> | undefined;
  const button = msg?.buttonsResponseMessage as Record<string, unknown> | undefined;
  if (!button?.selectedId) return null;
  const selectedId = button.selectedId as string;
  if (!selectedId.startsWith('confirm_') && !selectedId.startsWith('cancel_')) return null;

  const action = selectedId.startsWith('confirm_') ? 'confirm' : 'cancel';
  const appointmentId = selectedId.split('_').slice(1).join('_');

  const apptRows = await repo.findAppointmentById(appointmentId, clinicId);
  if (apptRows.length === 0) return null;

  const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled';
  await repo.updateAppointmentStatus(appointmentId, newStatus, `Via WhatsApp (botão ${action})`);

  const responseMsg = action === 'confirm'
    ? '✅ Confirmado! Sua presença foi registrada.'
    : '✅ Entendido. Sua consulta foi cancelada.';
  await sendWhatsAppMessage(phone, responseMsg);

  await repo.appendOutboundMessage({
    conversationId: convId,
    content: responseMsg,
    messageType: 'text',
  });

  return { from: phone, action: `button_${action}` };
}

async function handleConfirmation(
  clinicId: string,
  phone: string,
  content: string,
  convId: string,
): Promise<{ from: string; action: string } | null> {
  const result = await processConfirmationResponse(clinicId, phone, content);
  if (!result.processed || !result.responseMessage) return null;
  await repo.appendOutboundMessage({
    conversationId: convId,
    content: result.responseMessage,
    messageType: 'text',
    intent: result.action === 'confirmed' ? 'confirmacao' : 'cancelamento',
  });
  await sendWhatsAppMessage(phone, result.responseMessage);
  return { from: phone, action: 'confirmation' };
}

async function handleWaitlist(
  clinicId: string,
  phone: string,
  content: string,
  convId: string,
): Promise<{ from: string; action: string } | null> {
  const result = await processWaitlistConfirmation(clinicId, phone, content);
  if (!result.processed || !result.responseMessage) return null;
  await repo.appendOutboundMessage({
    conversationId: convId,
    content: result.responseMessage,
    messageType: 'text',
    intent: 'agendamento',
  });
  await sendWhatsAppMessage(phone, result.responseMessage);
  return { from: phone, action: 'waitlist' };
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
      content,
      externalMessageId: instagramMsgId,
      messageType: msgType,
      metadata: msgMetadata,
    });
    if (storeResult.deduped) continue;
    await repo.updateConversationTimestamp(conv.id);
    processed.push({ from: senderId.id as string, message: content });
  }
  return processed;
}
