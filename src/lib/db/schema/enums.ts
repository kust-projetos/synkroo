import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['owner', 'admin', 'dentist', 'receptionist']);
export const channelType = pgEnum('channel_type', ['whatsapp', 'instagram', 'web', 'telegram']);
export const conversationStatus = pgEnum('conversation_status', ['active', 'waiting', 'closed', 'escalated']);
export const messageDirection = pgEnum('message_direction', ['inbound', 'outbound']);
export const messageType = pgEnum('message_type', ['text', 'image', 'audio', 'document', 'video']);
export const appointmentStatus = pgEnum('appointment_status', ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']);
