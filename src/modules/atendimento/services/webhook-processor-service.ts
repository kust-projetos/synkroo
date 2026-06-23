/**
 * Webhook processor service.
 *
 * Bridges Meta Business API and Evolution API webhook processing.
 * Preserves existing behavior: message storage, confirmation handling, waitlist, lead capture.
 * AI processing disabled — deferred to W5.3.
 */
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { clinics, conversations, messages, whatsappInstances, appointments } from '@/lib/db/schema';
import { sendWhatsAppMessage } from '@/services/whatsapp';
import { processConfirmationResponse, processWaitlistConfirmation } from '@/services/appointments/confirmation-handler.service';
import { captureLeadFromWhatsApp } from '@/services/leads/leads.service';
import { whatsappLogger } from '@/lib/logger';

export async function processMetaWebhookEntry(entry: Record<string, unknown>, clinicId?: string) {
  const changes = (entry.changes as Array<Record<string, unknown>>) || [];
  const db = getDb();
  const results: Array<{ from: string; action: string }> = [];

  for (const change of changes) {
    const value = change.value as Record<string, unknown> | undefined;
    if (!value) continue;

    // Handle incoming messages
    if (value.messages) {
      for (const msg of value.messages as Array<Record<string, unknown>>) {
        const result = await storeAndProcessMessage(db, msg, value, 'whatsapp', clinicId);
        if (result) results.push(result);
      }
    }

    // Handle message status updates
    if (value.statuses) {
      for (const status of value.statuses as Array<Record<string, unknown>>) {
        await processStatusUpdate(db, status);
      }
    }
  }
  return results;
}

export async function processEvolutionMessage(data: Record<string, unknown>, instanceName: string) {
  const db = getDb();
  const key = data.key as Record<string, unknown> | undefined;
  if (!key || !key.remoteJid) return [];

  const fromMe = key.fromMe as boolean;
  if (fromMe) return [];

  const phone = extractPhone(key);
  if (!phone || phone.length < 10) return [];

  const { content, messageType } = extractContent(data);
  if (!content) return [];

  const clinicId = await getClinicByInstance(db, instanceName);
  if (!clinicId) return [];

  const now = Date.now();
  const results: Array<{ from: string; action: string }> = [];

  // Dedup check
  const messageId = key.id as string;
  if (messageId) {
    const existing = await db.select({ id: messages.id }).from(messages)
      .where(eq(messages.id as any, messageId as any)).limit(1);
    if (existing.length > 0) return [];
  }

  // Get or create conversation
  const conv = await getOrCreateConversation(db, clinicId, 'whatsapp', phone);
  if (!conv) return [];

  // Store inbound message
  await db.insert(messages).values({
    conversationId: conv.id,
    direction: 'inbound' as any,
    content,
    messageType: messageType as any,
    metadata: { whatsapp_message_id: messageId, instance: instanceName } as any,
    isAi: false,
  } as any);

  // Handle button responses
  const buttonResult = await handleButtonResponse(db, data, clinicId, phone, conv.id);
  if (buttonResult) {
    results.push(buttonResult);
    await updateConversationTimestamp(db, conv.id);
    return results;
  }

  // Confirmation response
  const confirmResult = await handleConfirmation(db, clinicId, phone, content, conv.id);
  if (confirmResult) { results.push(confirmResult); await updateConversationTimestamp(db, conv.id); return results; }

  // Waitlist confirmation
  const waitlistResult = await handleWaitlist(db, clinicId, phone, content, conv.id);
  if (waitlistResult) { results.push(waitlistResult); await updateConversationTimestamp(db, conv.id); return results; }

  // Lead capture (best-effort)
  try { await captureLeadFromWhatsApp(phone, content, clinicId); } catch { /* non-fatal */ }

  // AI disabled
  whatsappLogger.info('[webhook-processor] Message stored (AI disabled)', { phone, reason: 'legacy_agent_removed' });
  await updateConversationTimestamp(db, conv.id);
  results.push({ from: phone, action: 'stored' });
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

async function getClinicByPhoneNumber(db: ReturnType<typeof getDb>, phoneNumberId: string | undefined): Promise<string | null> {
  if (!phoneNumberId) return null;
  const result = await db.execute(sql`SELECT id FROM clinics WHERE settings->>'whatsapp_phone_number_id' = ${phoneNumberId} LIMIT 1`);
  const rows = (result as any).rows as Array<{ id: string }> | undefined;
  return rows?.[0]?.id || null;
}

async function storeAndProcessMessage(
  db: ReturnType<typeof getDb>,
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
  const cId = clinicId || await getClinicByPhoneNumber(db, phoneNumberId);
  if (!cId) return null;

  // Get or create conversation
  const conv = await getOrCreateConversation(db, cId, channel, from);
  if (!conv) return null;

  // Store message
  await db.insert(messages).values({
    conversationId: conv.id, direction: 'inbound' as any, content, messageType: msgType as any,
    metadata: { whatsapp_message_id: msgId, phone_number_id: phoneNumberId }, isAi: false,
  } as any);

  // Check confirmation, waitlist
  const confirmResult = await handleConfirmation(db, cId, from, content, conv.id);
  if (confirmResult) { await updateConversationTimestamp(db, conv.id); return confirmResult; }
  const waitlistResult = await handleWaitlist(db, cId, from, content, conv.id);
  if (waitlistResult) { await updateConversationTimestamp(db, conv.id); return waitlistResult; }

  await updateConversationTimestamp(db, conv.id);
  whatsappLogger.info('[webhook-processor] Meta msg stored (AI disabled)', { from, reason: 'legacy_agent_removed' });
  return { from, action: 'stored' };
}

async function getClinicByInstance(db: ReturnType<typeof getDb>, instanceName: string): Promise<string | null> {
  const rows = await db.select({ clinicId: whatsappInstances.clinicId }).from(whatsappInstances)
    .where(eq(whatsappInstances.evolutionInstanceName, instanceName)).limit(1);
  if (rows[0]) return rows[0].clinicId;
  const clinicRows = await db.select({ id: clinics.id }).from(clinics)
    .where(eq(clinics.subscriptionStatus, 'active')).limit(1);
  return clinicRows[0]?.id || null;
}

async function getOrCreateConversation(db: ReturnType<typeof getDb>, clinicId: string, channel: string, externalId: string) {
  const existing = await db.select().from(conversations)
    .where(and(eq(conversations.clinicId, clinicId), eq(conversations.channel as any, channel as any), eq(conversations.externalId, externalId)))
    .limit(1);
  if (existing[0]) return existing[0];
  const [conv] = await db.insert(conversations).values({ clinicId, channel: channel as any, externalId, status: 'active' } as any).returning();
  return conv || null;
}

async function updateConversationTimestamp(db: ReturnType<typeof getDb>, conversationId: string) {
  await db.update(conversations).set({ lastMessageAt: new Date() } as any).where(eq(conversations.id, conversationId));
}

async function handleButtonResponse(db: ReturnType<typeof getDb>, data: Record<string, unknown>, clinicId: string, phone: string, convId: string) {
  const msg = data.message as Record<string, unknown> | undefined;
  const button = msg?.buttonsResponseMessage as Record<string, unknown> | undefined;
  if (!button?.selectedId) return null;
  const selectedId = button.selectedId as string;
  if (!selectedId.startsWith('confirm_') && !selectedId.startsWith('cancel_')) return null;

  const action = selectedId.startsWith('confirm_') ? 'confirm' : 'cancel';
  const appointmentId = selectedId.split('_').slice(1).join('_');

  const apptRows = await db.select({ id: appointments.id }).from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, clinicId))).limit(1);
  if (!apptRows[0]) return null;

  const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled';
  await db.update(appointments).set({ status: newStatus as any, notes: `Via WhatsApp (botão ${action})` } as any)
    .where(eq(appointments.id, appointmentId));

  const responseMsg = action === 'confirm'
    ? '✅ Confirmado! Sua presença foi registrada.'
    : '✅ Entendido. Sua consulta foi cancelada.';
  await sendWhatsAppMessage(phone, responseMsg);

  await db.insert(messages).values({
    conversationId: convId, direction: 'outbound' as any, content: responseMsg,
    messageType: 'text', isAi: false,
  } as any);

  return { from: phone, action: `button_${action}` };
}

async function handleConfirmation(db: ReturnType<typeof getDb>, clinicId: string, phone: string, content: string, convId: string) {
  const result = await processConfirmationResponse(clinicId, phone, content);
  if (!result.processed || !result.responseMessage) return null;
  await db.insert(messages).values({
    conversationId: convId, direction: 'outbound' as any, content: result.responseMessage,
    messageType: 'text', intent: result.action === 'confirmed' ? 'confirmacao' : 'cancelamento', isAi: false,
  } as any);
  await sendWhatsAppMessage(phone, result.responseMessage);
  return { from: phone, action: 'confirmation' };
}

async function handleWaitlist(db: ReturnType<typeof getDb>, clinicId: string, phone: string, content: string, convId: string) {
  const result = await processWaitlistConfirmation(clinicId, phone, content);
  if (!result.processed || !result.responseMessage) return null;
  await db.insert(messages).values({
    conversationId: convId, direction: 'outbound' as any, content: result.responseMessage,
    messageType: 'text', intent: 'agendamento', isAi: false,
  } as any);
  await sendWhatsAppMessage(phone, result.responseMessage);
  return { from: phone, action: 'waitlist' };
}

async function processStatusUpdate(db: ReturnType<typeof getDb>, status: Record<string, unknown>) {
  // Store status updates in message metadata
  // Currently a no-op placeholder
}

export async function processInstagramEntry(entry: Record<string, unknown>): Promise<Array<{ from: string; message: string }>> {
  const db = getDb();
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
    const clinicRows = await db
      .select({ id: clinics.id })
      .from(clinics)
      .where(sql`settings->>'instagram_account_id' = ${recipient?.id}`)
      .limit(1);
    const clinicId = clinicRows[0]?.id;
    if (!clinicId) continue;

    const existing = await db.select().from(conversations)
      .where(and(eq(conversations.clinicId, clinicId), eq(conversations.channel as any, 'instagram' as any), eq(conversations.externalId, senderId.id as string)))
      .limit(1);
    let conv = existing[0];
    if (!conv) {
      const [newConv] = await db.insert(conversations).values({ clinicId, channel: 'instagram' as any, externalId: senderId.id as string, status: 'active' } as any).returning();
      conv = newConv;
    }
    if (!conv) continue;

    await db.insert(messages).values({
      conversationId: conv.id, direction: 'inbound' as any, content, messageType: msgType as any,
      metadata: { instagram_sender_id: senderId.id, timestamp: event.timestamp }, isAi: false,
    } as any);
    await db.update(conversations).set({ lastMessageAt: new Date() } as any).where(eq(conversations.id, conv.id));
    processed.push({ from: senderId.id as string, message: content });
  }
  return processed;
}
