/**
 * P7 Slice 1 — consumidor OBSERVE `journey.appointment.completed`.
 *
 * Materializa a instância da journey pós-consulta (`followup_journey_instances`
 * → `waiting_due`, com `due_at = occurredAt + 2h` e `feedback_deadline =
 * occurredAt + 48h` CONGELADOS — nunca recalculados) e corre a run P4 OBSERVE
 * (encadeia `ai.control.recommend` na MESMA transação do hook: instância +
 * recommend cometem ou desfazem juntos, zero run órfã de instância não
 * materializada e zero instância sem run).
 *
 * OBSERVE por construção: nenhum envio, nenhum branch, nenhuma mutação de
 * negócio além das duas escritas do hook — este módulo NÃO importa providers
 * LLM/RAG, gateways, serviços de envio nem handlers de mutação de domínio
 * (coberto por teste estático de imports). A allowlist P4 é apenas LIDA pelo
 * pipeline encadeado, nunca expandida aqui.
 */
import type { OutboxJob, OutboxSuccessHook } from '@/lib/outbox/outbox-repository';
import { PermanentOutboxError } from '@/lib/outbox/errors';
import { enqueueOutbox } from '@/lib/outbox/outbox-repository';
import {
  OUTBOX_OPERATIONS,
  POST_VISIT_JOURNEY_KIND,
  JOURNEY_APPOINTMENT_COMPLETED_VERSION,
  type JourneyAppointmentCompletedPayload,
} from '@/lib/outbox/operations';
import {
  POST_VISIT_JOURNEY_DEFINITION_VERSION,
  followupJourneyInstances,
} from '@/modules/followup/schema/journeys';

/**
 * Versão do envelope `ai.control.recommend` encadeado para a run P4 OBSERVE.
 * Literal local de propósito: `src/modules/**` só importa outro módulo via
 * seam (`index`/`public`/`schema`) e a constante canônica
 * (`AI_CONTROL_ENVELOPE_VERSION`) vive num service do módulo `ia`, fora de
 * seam. Igualdade guardada por teste (`post-visit-journey.test.ts` — testes
 * são isentos do gate de boundaries e importam os dois lados).
 */
const P4_RECOMMEND_ENVELOPE_VERSION = 1;

/** Tipo do fato P4 que ancora a run OBSERVE da journey. */
export const JOURNEY_P4_EVENT_TYPE = 'appointment.completed' as const;

/** Sujeito P4 da run OBSERVE da journey (a consulta concluída). */
export const JOURNEY_P4_SUBJECT_TYPE = 'appointment' as const;

/** `due_at` congela em `occurredAt + 2h` (hipótese do piloto, sem auto-tuning). */
export const POST_VISIT_DUE_DELAY_MS = 2 * 60 * 60 * 1000;

/** `feedback_deadline` congela em `occurredAt + 48h` (mesma janela do outcome P4). */
export const POST_VISIT_FEEDBACK_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Código sanitizado da DLQ para envelope inválido ou tenant descasado. */
export const JOURNEY_APPOINTMENT_COMPLETED_INVALID_CODE =
  'JOURNEY_APPOINTMENT_COMPLETED_INVALID';

export class InvalidJourneyAppointmentCompletedError extends PermanentOutboxError {
  constructor() {
    super(
      JOURNEY_APPOINTMENT_COMPLETED_INVALID_CODE,
      'Invalid journey.appointment.completed envelope: rejected without side effects.',
    );
    this.name = 'InvalidJourneyAppointmentCompletedError';
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Valida o envelope do job. Lança `InvalidJourneyAppointmentCompletedError`
 * (permanente → DLQ imediata, sem retry, sem efeito) quando: operação
 * desconhecida, campo de envelope ausente/malformado, versão divergente ou
 * `clinicId` do envelope descasado do `clinicId` da linha do outbox.
 */
export function parseJourneyAppointmentCompletedPayload(
  job: OutboxJob,
): JourneyAppointmentCompletedPayload {
  if (job.operation !== OUTBOX_OPERATIONS.JOURNEY_APPOINTMENT_COMPLETED) {
    throw new InvalidJourneyAppointmentCompletedError();
  }
  const raw: unknown = job.payload;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InvalidJourneyAppointmentCompletedError();
  }
  const p = raw as Partial<JourneyAppointmentCompletedPayload>;
  const occurredAt = p.occurredAt;
  if (
    !isNonEmptyString(p.eventId)
    || p.kind !== POST_VISIT_JOURNEY_KIND
    || p.version !== JOURNEY_APPOINTMENT_COMPLETED_VERSION
    || !isNonEmptyString(occurredAt)
    || !Number.isFinite(Date.parse(occurredAt))
    || !isNonEmptyString(p.appointmentId)
    || !isNonEmptyString(p.clinicId)
  ) {
    throw new InvalidJourneyAppointmentCompletedError();
  }
  // Cerco de tenant: o envelope carrega o tenant e ele deve casar com a
  // linha do outbox. O hook escreve SEMPRE com `job.clinicId`, então um
  // descasamento nunca vira escrita cross-tenant — vira DLQ.
  if (p.clinicId !== job.clinicId) {
    throw new InvalidJourneyAppointmentCompletedError();
  }
  return {
    eventId: p.eventId,
    kind: p.kind,
    version: p.version,
    occurredAt,
    appointmentId: p.appointmentId,
    clinicId: p.clinicId,
  };
}

/** `due_at` congelado: `occurredAt + 2h`. Puro e determinístico. */
export function computeJourneyDueAt(occurredAt: Date): Date {
  return new Date(occurredAt.getTime() + POST_VISIT_DUE_DELAY_MS);
}

/** `feedback_deadline` congelado: `occurredAt + 48h`. Puro e determinístico. */
export function computeJourneyFeedbackDeadline(occurredAt: Date): Date {
  return new Date(occurredAt.getTime() + POST_VISIT_FEEDBACK_WINDOW_MS);
}

/**
 * Consumidor OBSERVE: valida e devolve o hook de materialização. Nenhum
 * efeito além das duas escritas do hook (instância + recommend P4) — sem
 * envio, sem mutação de negócio.
 */
export async function dispatchJourneyAppointmentCompletedJob(
  job: OutboxJob,
): Promise<OutboxSuccessHook> {
  const payload = parseJourneyAppointmentCompletedPayload(job);
  const clinicId = job.clinicId;
  const occurredAt = new Date(payload.occurredAt);
  const dueAt = computeJourneyDueAt(occurredAt);
  const feedbackDeadline = computeJourneyFeedbackDeadline(occurredAt);
  // Envelope da run P4 OBSERVE, derivado do fato validado — mesmo tenant,
  // mesmo evento (a run P4 ancora no `sourceEventId` da journey, gravado em
  // `run_event_id` para correlação). Enfileirado na MESMA transação do hook.
  // Montado inline (sem importar o service do módulo `ia`, fora de seam):
  // o consumidor P4 valida o envelope e rejeita divergência como permanente.
  const recommendPayload = {
    eventId: payload.eventId,
    type: JOURNEY_P4_EVENT_TYPE,
    version: P4_RECOMMEND_ENVELOPE_VERSION,
    occurredAt: payload.occurredAt,
    subjectType: JOURNEY_P4_SUBJECT_TYPE,
    subjectId: payload.appointmentId,
    clinicId,
    data: { journeyKind: payload.kind },
  };
  // Chave de negócio do recommend: mesma convenção do produtor P4 1A
  // (tupla JSON `[subjectType, subjectId, eventId]`), construída inline para
  // não importar o service do módulo `ia` (fora de seam). Só precisa ser
  // determinística por evento lógico: replay colide na UNIQUE do outbox.
  const recommendBusinessKey = JSON.stringify([
    JOURNEY_P4_SUBJECT_TYPE,
    payload.appointmentId,
    payload.eventId,
  ]);
  return async (tx: any) => {
    // Replay idempotente: a segunda liquidação do mesmo envelope não cria
    // nada (UNIQUE `(clinic_id, appointment_id, journey_kind)` +
    // `onConflictDoNothing`, e o recommend re-enfileirado colide na UNIQUE
    // do outbox sem duplicar).
    await tx
      .insert(followupJourneyInstances)
      .values({
        clinicId,
        appointmentId: payload.appointmentId,
        journeyKind: payload.kind,
        sourceEventId: payload.eventId,
        definitionVersion: POST_VISIT_JOURNEY_DEFINITION_VERSION,
        state: 'waiting_due',
        revision: 0,
        dueAt,
        feedbackDeadline,
        runEventId: payload.eventId,
      })
      .onConflictDoNothing();
    await enqueueOutbox(tx, {
      clinicId,
      operation: OUTBOX_OPERATIONS.AI_CONTROL_RECOMMEND,
      businessKey: recommendBusinessKey,
      payload: recommendPayload as unknown as Record<string, unknown>,
    });
  };
}
