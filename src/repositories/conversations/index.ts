import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { conversations, messages, patients, users } from '@/lib/db/schema'

// ─── Types ────────────────────────────────────────────────────

export interface ConversationWithJoins {
  id: string
  clinicId: string
  channel: string
  status: string
  externalId: string
  lastMessageAt: Date | null
  messageCount: number | null
  metadata: Record<string, unknown>
  createdAt: Date | null
  updatedAt: Date | null
  patient: { id: string; name: string; phone: string; email: string | null } | null
  assignedUser: { id: string; name: string } | null
}

export interface ConversationListItem {
  id: string
  clinicId: string
  channel: string
  status: string
  externalId: string
  lastMessageAt: Date | null
  messageCount: number | null
  createdAt: Date | null
  updatedAt: Date | null
  patient: { id: string; name: string; phone: string } | null
  assignedUser: { id: string; name: string } | null
}

export interface MessageRow {
  id: string
  conversationId: string
  direction: string
  content: string
  messageType: string
  mediaUrl: string | null
  metadata: Record<string, unknown>
  intent: string | null
  entities: Record<string, unknown>
  confidence: string | null
  isAi: boolean
  deliveredAt: Date | null
  readAt: Date | null
  createdAt: Date | null
}

// ─── Conversation queries ──────────────────────────────────────

export async function findByClinic(
  clinicId: string,
  opts?: { status?: string; channel?: string; limit?: number; offset?: number }
): Promise<ConversationListItem[]> {
  const db = getDb()
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0

  const conditions = [eq(conversations.clinicId, clinicId)]
  if (opts?.status) conditions.push(eq(conversations.status, opts.status as any))
  if (opts?.channel) conditions.push(eq(conversations.channel, opts.channel as any))

  const rows = await db
    .select({
      id: conversations.id,
      clinicId: conversations.clinicId,
      channel: conversations.channel,
      status: conversations.status,
      externalId: conversations.externalId,
      lastMessageAt: conversations.lastMessageAt,
      messageCount: conversations.messageCount,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      patientId: patients.id,
      patientName: patients.name,
      patientPhone: patients.phone,
      assignedUserId: users.id,
      assignedUserName: users.name,
    })
    .from(conversations)
    .leftJoin(patients, eq(patients.id, conversations.patientId))
    .leftJoin(users, eq(users.id, conversations.assignedTo))
    .where(and(...conditions))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit)
    .offset(offset)

  return rows.map((r) => ({
    id: r.id,
    clinicId: r.clinicId,
    channel: String(r.channel) as ConversationListItem['channel'],
    status: String(r.status) as ConversationListItem['status'],
    externalId: r.externalId,
    lastMessageAt: r.lastMessageAt ?? null,
    messageCount: r.messageCount ?? null,
    createdAt: r.createdAt ?? null,
    updatedAt: r.updatedAt ?? null,
    patient: r.patientId ? { id: r.patientId, name: r.patientName ?? '', phone: r.patientPhone ?? '' } : null,
    assignedUser: r.assignedUserId ? { id: r.assignedUserId, name: r.assignedUserName ?? '' } : null,
  }))
}

export async function findByIdWithJoins(id: string, clinicId: string): Promise<ConversationWithJoins | null> {
  const db = getDb()
  const rows = await db
    .select({
      id: conversations.id,
      clinicId: conversations.clinicId,
      channel: conversations.channel,
      status: conversations.status,
      externalId: conversations.externalId,
      lastMessageAt: conversations.lastMessageAt,
      messageCount: conversations.messageCount,
      metadata: conversations.metadata,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      patientId: patients.id,
      patientName: patients.name,
      patientPhone: patients.phone,
      patientEmail: patients.email,
      assignedUserId: users.id,
      assignedUserName: users.name,
    })
    .from(conversations)
    .leftJoin(patients, eq(patients.id, conversations.patientId))
    .leftJoin(users, eq(users.id, conversations.assignedTo))
    .where(and(eq(conversations.id, id), eq(conversations.clinicId, clinicId)))
    .limit(1)

  if (!rows[0]) return null
  const r = rows[0]
  return {
    id: r.id,
    clinicId: r.clinicId,
    channel: String(r.channel) as ConversationWithJoins['channel'],
    status: String(r.status) as ConversationWithJoins['status'],
    externalId: r.externalId,
    lastMessageAt: r.lastMessageAt ?? null,
    messageCount: r.messageCount ?? null,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.createdAt ?? null,
    updatedAt: r.updatedAt ?? null,
    patient: r.patientId ? { id: r.patientId, name: r.patientName ?? '', phone: r.patientPhone ?? '', email: r.patientEmail ?? null } : null,
    assignedUser: r.assignedUserId ? { id: r.assignedUserId, name: r.assignedUserName ?? '' } : null,
  }
}

export async function countByClinic(clinicId: string, opts?: { status?: string; channel?: string }): Promise<number> {
  const db = getDb()
  const conditions = [eq(conversations.clinicId, clinicId)]
  if (opts?.status) conditions.push(eq(conversations.status, opts.status as any))
  if (opts?.channel) conditions.push(eq(conversations.channel, opts.channel as any))
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(and(...conditions))
  return row?.count ?? 0
}

// ─── Message queries ───────────────────────────────────────────

export async function findMessagesByConversation(
  conversationId: string,
  opts?: { limit?: number; offset?: number }
): Promise<MessageRow[]> {
  const db = getDb()
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0

  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      direction: messages.direction,
      content: messages.content,
      messageType: messages.messageType,
      mediaUrl: messages.mediaUrl,
      metadata: messages.metadata,
      intent: messages.intent,
      entities: messages.entities,
      confidence: messages.confidence,
      isAi: messages.isAi,
      deliveredAt: messages.deliveredAt,
      readAt: messages.readAt,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(limit)
    .offset(offset)

  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    direction: r.direction as MessageRow['direction'],
    content: r.content,
    messageType: r.messageType as MessageRow['messageType'],
    mediaUrl: r.mediaUrl,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    intent: r.intent,
    entities: (r.entities ?? {}) as Record<string, unknown>,
    confidence: r.confidence,
    isAi: r.isAi,
    deliveredAt: r.deliveredAt,
    readAt: r.readAt,
    createdAt: r.createdAt,
  } as MessageRow))
}

export async function countMessagesByConversation(conversationId: string): Promise<number> {
  const db = getDb()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
  return row?.count ?? 0
}

export async function getLastMessage(conversationId: string): Promise<{
  content: string; direction: string; intent: string | null; createdAt: Date | null
} | null> {
  const db = getDb()
  const rows = await db
    .select({
      content: messages.content,
      direction: messages.direction,
      intent: messages.intent,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(1)
  return rows[0] ?? null
}

// ─── Mutations ────────────────────────────────────────────────

export async function createMessage(data: {
  conversationId: string
  direction: 'inbound' | 'outbound'
  content: string
  messageType?: string
  mediaUrl?: string | null
  metadata?: Record<string, unknown>
  intent?: string | null
  entities?: Record<string, unknown>
  confidence?: string | null
  isAi?: boolean
}): Promise<MessageRow> {
  const db = getDb()
  const [row] = await db
    .insert(messages)
    .values({
      conversationId: data.conversationId,
      direction: data.direction as any,
      content: data.content,
      messageType: (data.messageType ?? 'text') as any,
      mediaUrl: data.mediaUrl ?? null,
      metadata: data.metadata ?? {},
      intent: data.intent ?? null,
      entities: data.entities ?? {},
      confidence: data.confidence ?? null,
      isAi: data.isAi ?? false,
    } as any)
    .returning()
  return row as MessageRow
}

export async function updateMessage(id: string, data: Record<string, unknown>): Promise<MessageRow | null> {
  const db = getDb()
  const [row] = await db
    .update(messages)
    .set(data as any)
    .where(eq(messages.id, id))
    .returning()
  return (row as MessageRow | null) ?? null
}

export async function updateConversation(id: string, data: {
  lastMessageAt?: Date
  status?: string
  messageCountIncrement?: number
  metadata?: Record<string, unknown>
  patientId?: string | null
}): Promise<void> {
  const db = getDb()
  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (data.lastMessageAt) updateData.lastMessageAt = data.lastMessageAt
  if (data.status) updateData.status = data.status
  if (data.metadata) updateData.metadata = data.metadata
  if ('patientId' in data) updateData.patientId = data.patientId

  if (data.messageCountIncrement !== undefined) {
    const [row] = await db
      .select({ messageCount: conversations.messageCount })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1)
    updateData.messageCount = (row?.messageCount ?? 0) + data.messageCountIncrement
  }

  await db.update(conversations).set(updateData as any).where(eq(conversations.id, id))
}

export async function getOrCreateConversation(
  clinicId: string,
  channel: 'whatsapp' | 'instagram' | 'web' | 'telegram',
  externalId: string,
  patientPhone?: string,
): Promise<string> {
  const db = getDb()

  const existing = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(
      eq(conversations.clinicId, clinicId),
      eq(conversations.channel, channel as any),
      eq(conversations.externalId, externalId),
    ))
    .limit(1)

  if (existing.length > 0) return existing[0].id

  let patientId: string | undefined
  if (patientPhone) {
    const patient = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.clinicId, clinicId), eq(patients.phone, patientPhone)))
      .limit(1)
    if (patient.length > 0) patientId = patient[0].id
  }

  const [conv] = await db
    .insert(conversations)
    .values({
      clinicId,
      channel: channel as any,
      externalId,
      patientId: patientId ?? undefined,
      status: 'active',
    } as any)
    .returning({ id: conversations.id })
  return conv.id
}

export async function getConversationContext(
  conversationId: string,
  limit = 10,
): Promise<Array<{ role: string; content: string; intent: string | null }>> {
  const db = getDb()
  const rows = await db
    .select({ role: messages.direction, content: messages.content, intent: messages.intent })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
  return rows.reverse().map((r) => ({
    role: r.role === 'inbound' ? 'user' : 'assistant',
    content: r.content,
    intent: r.intent,
  }))
}

export async function getPatientInsights(patientId: string) {
  const db = getDb()
  const [apptCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(
      eq(conversations.patientId, patientId),
      sql`${messages.createdAt} > NOW() - INTERVAL '90 days'`,
    ))
  return { totalMessagesLast90d: Number(apptCount?.count || 0) }
}

export async function findByExternalId(clinicId: string, channel: string, externalId: string) {
  const db = getDb()
  return db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(
      eq(conversations.clinicId, clinicId),
      eq(conversations.channel, channel as any),
      eq(conversations.externalId, externalId),
    ))
    .limit(1)
}

/**
 * Find conversations by channel and externalId WITHOUT clinic scoping.
 * Preserves the pre-migration contract: phone-based lookup across all clinics.
 */
export async function findByChannelAndExternalId(channel: string, externalId: string) {
  const db = getDb()
  return db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(
      eq(conversations.channel, channel as any),
      eq(conversations.externalId, externalId),
    ))
}

/**
 * Get conversation by ID (no clinic scoping — for agent service use)
 */
export async function findById(id: string): Promise<{
  id: string
  clinicId: string
  patientId: string | null
  channel: string
  status: string
  externalId: string
  assignedTo: string | null
  metadata: Record<string, unknown>
  createdAt: Date | null
  updatedAt: Date | null
} | null> {
  const db = getDb()
  const [row] = await db
    .select({
      id: conversations.id,
      clinicId: conversations.clinicId,
      patientId: conversations.patientId,
      channel: conversations.channel,
      status: conversations.status,
      externalId: conversations.externalId,
      assignedTo: conversations.assignedTo,
      metadata: conversations.metadata,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (row as any) ?? null
}