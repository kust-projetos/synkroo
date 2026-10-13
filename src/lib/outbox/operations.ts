export const OUTBOX_OPERATIONS = {
  FINANCE_CHARGE_CREATE: 'financeiro.charge.create',
  FINANCE_CHARGE_CANCEL: 'financeiro.charge.cancel',
  FOLLOWUP_CAMPAIGN_RECIPIENT: 'followup.campaign.recipient',
  ATENDIMENTO_INBOUND_MESSAGE: 'atendimento.inbound.message',
  ATENDIMENTO_OUTBOUND_MESSAGE: 'atendimento.outbound.message',
  CRM_CONTACT_CHANGED: 'crm.contact.changed',
  /** P4 Slice 1A — ingestão OBSERVE: materializa BusinessEvent + Goal + AgentRun, sem efeitos. */
  AI_CONTROL_RECOMMEND: 'ai.control.recommend',
} as const;

export type OutboxOperation = typeof OUTBOX_OPERATIONS[keyof typeof OUTBOX_OPERATIONS];

export type ContactChangedOwnerType = 'patient' | 'lead';

export interface ContactChangedPayload {
  ownerType: ContactChangedOwnerType;
  ownerId: string;
}

export interface OutboundMessagePayload {
  channel: 'whatsapp' | 'instagram' | 'web';
  externalId: string;
  message: string;
  reminderId?: string;
}

/**
 * Envelope P4 Slice 1A (OBSERVE) — fato de negócio para ingestão durável.
 *
 * `eventId` é determinístico e fornecido pelo produtor (nunca `randomUUID`
 * no consumo ou na chave de negócio): replay do mesmo envelope produz um
 * único conjunto lógico via `onConflictDoNothing` nas UNIQUEs
 * `(clinic_id, event_id)`. `clinicId` do envelope deve casar com o
 * `clinicId` da linha do outbox — descasamento é falha permanente (DLQ),
 * nunca escrita cross-tenant.
 */
export interface AiControlRecommendPayload {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  subjectType: string;
  subjectId: string;
  clinicId: string;
  data?: Record<string, unknown>;
}
