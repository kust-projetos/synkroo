export const OUTBOX_OPERATIONS = {
  FINANCE_CHARGE_CREATE: 'financeiro.charge.create',
  FINANCE_CHARGE_CANCEL: 'financeiro.charge.cancel',
  FOLLOWUP_CAMPAIGN_RECIPIENT: 'followup.campaign.recipient',
  ATENDIMENTO_INBOUND_MESSAGE: 'atendimento.inbound.message',
  ATENDIMENTO_OUTBOUND_MESSAGE: 'atendimento.outbound.message',
  CRM_CONTACT_CHANGED: 'crm.contact.changed',
  /** P4 Slice 1A — ingestão OBSERVE: materializa BusinessEvent + Goal + AgentRun, sem efeitos. */
  AI_CONTROL_RECOMMEND: 'ai.control.recommend',
  /**
   * P4 Slice 1B — preparo OBSERVÁVEL: monta contexto (interlocutor + conversa,
   * só nome como PII), consulta o RAG tenant-scoped e materializa a proposta
   * (`agent_runs` → `observed`/`failed`). Sem LLM, sem mutação de negócio, sem
   * envio externo — a run nunca executa nada.
   */
  AI_CONTROL_PREPARE: 'ai.control.prepare',
  /**
   * P7 Slice 1 — journey pós-consulta em OBSERVE: fato de conclusão de
   * consulta para materialização da instância (`followup_journey_instances`)
   * + run P4 OBSERVE. Sem envio, sem branches neste slice.
   */
  JOURNEY_APPOINTMENT_COMPLETED: 'journey.appointment.completed',
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

/**
 * Envelope P4 Slice 1B (preparo OBSERVÁVEL) — referência mínima ao fato já
 * materializado pela 1A. O consumidor recarrega o `business_events` com o
 * tenant da linha do outbox (`job.clinicId`); `clinicId` do envelope deve
 * casar com ele — descasamento é falha permanente (DLQ), nunca leitura
 * cross-tenant. `eventId`/`clinicId` determinísticos: replay re-enfileirado
 * colide na UNIQUE (`clinic_id, operation, business_key`) e não duplica.
 */
export interface AiControlPreparePayload {
  eventId: string;
  clinicId: string;
  version: number;
}

/**
 * Chave de negócio DETERMINÍSTICA do prepare — tupla JSON
 * `["prepare", clinicId, eventId]` (ordem fixa, sem ambiguidade de
 * separador). Mesmo evento lógico re-enfileirado colide na UNIQUE do outbox
 * e não duplica a fila. Função pura em `operations` (sem imports) para que o
 * produtor 1A e o consumidor 1B compartilhem a mesma construção sem ciclo de
 * imports (o 1B importa RAG; o 1A nunca pode importá-lo, nem transitivamente
 * no texto — ver teste estático OBSERVE do 1A).
 */
export function buildAiControlPrepareBusinessKey(clinicId: string, eventId: string): string {
  return JSON.stringify(['prepare', clinicId, eventId]);
}

/** Versão do envelope `journey.appointment.completed` (P7 Slice 1). */
export const JOURNEY_APPOINTMENT_COMPLETED_VERSION = 1;

/** Kind único de journey deste slice. */
export const POST_VISIT_JOURNEY_KIND = 'post_visit';

/**
 * Envelope P7 Slice 1 (OBSERVE) — fato de conclusão de consulta.
 *
 * `eventId` é determinístico e fornecido pelo produtor (nunca `randomUUID`
 * no consumo ou na chave de negócio): replay do mesmo envelope produz uma
 * única instância via `onConflictDoNothing` na UNIQUE
 * `(clinic_id, appointment_id, journey_kind)`. `clinicId` do envelope deve
 * casar com o `clinicId` da linha do outbox — descasamento é falha permanente
 * (DLQ), nunca escrita cross-tenant.
 */
export interface JourneyAppointmentCompletedPayload {
  eventId: string;
  kind: typeof POST_VISIT_JOURNEY_KIND;
  version: typeof JOURNEY_APPOINTMENT_COMPLETED_VERSION;
  occurredAt: string;
  appointmentId: string;
  clinicId: string;
}

/**
 * Chave de negócio DETERMINÍSTICA do job — tupla JSON
 * `[kind, clinicId, appointmentId]` (ordem fixa, sem ambiguidade de
 * separador). A mesma conclusão lógica re-enfileirada colide na UNIQUE do
 * outbox e não duplica a fila. Função pura em `operations` (sem imports).
 */
export function buildJourneyAppointmentCompletedBusinessKey(
  kind: string,
  clinicId: string,
  appointmentId: string,
): string {
  return JSON.stringify([kind, clinicId, appointmentId]);
}

/**
 * Id determinístico do evento de origem para a transição →completed de uma
 * consulta: mesma conclusão lógica ⇒ mesmo evento ⇒ replay colide na UNIQUE
 * da instância e na UNIQUE do outbox, sem duplicar. Nunca `randomUUID`.
 * Função pura em `operations` (sem imports) para que o produtor (repo
 * operacional) e os testes compartilhem a mesma construção sem importar o
 * service da journey (fora de seam para o módulo operacional).
 */
export function buildJourneySourceEventId(appointmentId: string): string {
  return `post_visit:${appointmentId}`;
}
