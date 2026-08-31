export const OUTBOX_OPERATIONS = {
  FINANCE_CHARGE_CREATE: 'financeiro.charge.create',
  FINANCE_CHARGE_CANCEL: 'financeiro.charge.cancel',
  FOLLOWUP_CAMPAIGN_RECIPIENT: 'followup.campaign.recipient',
  ATENDIMENTO_INBOUND_MESSAGE: 'atendimento.inbound.message',
  ATENDIMENTO_OUTBOUND_MESSAGE: 'atendimento.outbound.message',
  CRM_CONTACT_CHANGED: 'crm.contact.changed',
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
