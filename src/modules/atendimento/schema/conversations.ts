/**
 * Atendimento Multicanal — schema seam.
 *
 * Tables for conversations, messages, sessions, states, and memories.
 * Moved from src/lib/db/schema/conversations.ts.
 * Identity copy — no schema changes.
 */

import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, decimal, uniqueIndex, vector } from 'drizzle-orm/pg-core';
import { clinics, users } from '@/lib/db/schema/core';
import { patients } from '@/lib/db/schema';
import { channelType, conversationStatus, messageDirection, messageType } from '@/lib/db/schema/enums';

// ──────────────────────────────────────────────
// CONVERSATIONS
// ──────────────────────────────────────────────
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  channel: channelType('channel').notNull(),
  externalId: text('external_id').notNull(),
  status: conversationStatus('status').notNull().default('active'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }).defaultNow(),
  messageCount: integer('message_count').default(0),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// MESSAGES
// ──────────────────────────────────────────────
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  direction: messageDirection('direction').notNull(),
  content: text('content').notNull(),
  messageType: messageType('message_type').notNull().default('text'),
  externalProvider: text('external_provider'),
  externalMessageId: text('external_message_id'),
  mediaUrl: text('media_url'),
  metadata: jsonb('metadata').default('{}'),
  intent: text('intent'),
  entities: jsonb('entities').default('{}'),
  confidence: decimal('confidence', { precision: 3, scale: 2 }),
  embedding: vector('embedding', { dimensions: 1536 }),
  isAi: boolean('is_ai').default(false),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  externalEventUnique: uniqueIndex('messages_external_provider_event_unique').on(table.externalProvider, table.externalMessageId),
}));

// ──────────────────────────────────────────────
// CONVERSATION STATES
// ──────────────────────────────────────────────
export const conversationStates = pgTable('conversation_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  state: jsonb('state').default('{}').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// CONVERSATION SESSIONS
// ──────────────────────────────────────────────
export const conversationSessions = pgTable('conversation_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  entries: jsonb('entries').default('[]').notNull(),
  extractedInfo: jsonb('extracted_info').default('{}').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueConversation: { name: 'unique_conversation_session', columns: [t.conversationId], type: 'unique' },
}));

// ──────────────────────────────────────────────
// CONVERSATION MEMORIES (pgvector RAG storage)
// ──────────────────────────────────────────────
export const conversationMemories = pgTable('conversation_memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  contentType: text('content_type').default('message'),
  embedding: vector('embedding', { dimensions: 1536 }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
