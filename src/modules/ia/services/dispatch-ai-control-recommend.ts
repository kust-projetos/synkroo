/**
 * P4 Slice 1A — consumidor OBSERVE `ai.control.recommend`.
 *
 * Ingestão durável: valida envelope + tenant e materializa BusinessEvent +
 * Goal + AgentRun (queued) no hook de sucesso, cercado pelo lease do claim
 * (comita junto com o `delivered`; replay é idempotente via
 * `onConflictDoNothing` nas UNIQUEs `(clinic_id, event_id)`).
 *
 * OBSERVE por construção: nenhum LLM/RAG, nenhum handler de mutação, nenhum
 * envio externo — este módulo NÃO importa providers, RAG, gateways nem
 * serviços de envio. A run nasce `queued` e nenhum executor existe neste
 * slice (coberto por teste estático de imports).
 */
import type { OutboxJob, OutboxSuccessHook } from '@/lib/outbox/outbox-repository';
import { PermanentOutboxError } from '@/lib/outbox/errors';
import { enqueueOutbox } from '@/lib/outbox/outbox-repository';
import {
  OUTBOX_OPERATIONS,
  type AiControlRecommendPayload,
} from '@/lib/outbox/operations';
import { agentRuns, businessEvents, goals } from '@/modules/ia/schema/observe';

/** Versão do envelope aceita por este consumidor. */
export const AI_CONTROL_ENVELOPE_VERSION = 1;

/** Código sanitizado da DLQ para envelope inválido ou tenant descasado. */
export const AI_CONTROL_RECOMMEND_INVALID_CODE = 'AI_CONTROL_RECOMMEND_INVALID';

export class InvalidAiControlRecommendError extends PermanentOutboxError {
  constructor() {
    super(
      AI_CONTROL_RECOMMEND_INVALID_CODE,
      'Invalid ai.control.recommend envelope: rejected without side effects.',
    );
    this.name = 'InvalidAiControlRecommendError';
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Valida o envelope do job. Lança `InvalidAiControlRecommendError`
 * (permanente → DLQ imediata, sem retry, sem efeito) quando: operação
 * desconhecida, campo de envelope ausente/malformado, versão divergente ou
 * `clinicId` do envelope descasado do `clinicId` da linha do outbox.
 */
export function parseAiControlRecommendPayload(job: OutboxJob): AiControlRecommendPayload {
  if (job.operation !== OUTBOX_OPERATIONS.AI_CONTROL_RECOMMEND) {
    throw new InvalidAiControlRecommendError();
  }
  const raw: unknown = job.payload;
  // Payload nulo/primitivo/Array é permanente (DLQ imediata, sem retry):
  // valida o contêiner ANTES de acessar qualquer campo para nunca vazar
  // TypeError — só objeto plain segue para a validação de campos.
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InvalidAiControlRecommendError();
  }
  const p = raw as Partial<AiControlRecommendPayload>;
  const occurredAt = p.occurredAt;
  if (
    !isNonEmptyString(p.eventId)
    || !isNonEmptyString(p.type)
    || p.version !== AI_CONTROL_ENVELOPE_VERSION
    || !isNonEmptyString(occurredAt)
    || !Number.isFinite(Date.parse(occurredAt))
    || !isNonEmptyString(p.subjectType)
    || !isNonEmptyString(p.subjectId)
    || !isNonEmptyString(p.clinicId)
    || (p.data !== undefined && (typeof p.data !== 'object' || p.data === null || Array.isArray(p.data)))
  ) {
    throw new InvalidAiControlRecommendError();
  }
  // Cerco de tenant: o envelope carrega o tenant e ele deve casar com a
  // linha do outbox. O hook escreve SEMPRE com `job.clinicId`, então um
  // descasamento nunca vira escrita cross-tenant — vira DLQ.
  if (p.clinicId !== job.clinicId) {
    throw new InvalidAiControlRecommendError();
  }
  return {
    eventId: p.eventId,
    type: p.type,
    version: p.version,
    occurredAt,
    subjectType: p.subjectType,
    subjectId: p.subjectId,
    clinicId: p.clinicId,
    ...(p.data !== undefined ? { data: p.data as Record<string, unknown> } : {}),
  };
}

/**
 * Chave de negócio DETERMINÍSTICA do job — derivada do envelope, nunca
 * `randomUUID`: o mesmo evento lógico re-enfileirado colide na UNIQUE
 * (`clinic_id, operation, business_key`) e não duplica a fila.
 *
 * Formato: `JSON.stringify` da tupla `[subjectType, subjectId, eventId]`
 * (ordem fixa). A serialização JSON é não-ambígua — `:` dentro de
 * `subjectId`/`eventId` nunca funde fronteiras de campo, ao contrário do
 * `join(':')` (ex.: `["lead","x:y","z"]` vs `["lead","x","y:z"]` colidiriam
 * como `lead:x:y:z`). Mesmo input ⇒ mesma key, sempre.
 */
export function buildAiControlBusinessKey(envelope: Pick<AiControlRecommendPayload, 'subjectType' | 'subjectId' | 'eventId'>): string {
  return JSON.stringify([envelope.subjectType, envelope.subjectId, envelope.eventId]);
}

export type AiControlRecommendEnvelopeInput = Omit<AiControlRecommendPayload, 'version' | 'clinicId'>;

/**
 * Produtor: enfileira a ingestão OBSERVE na MESMA transação do fato que a
 * originou (o caller passa o `tx`). Rollback do produtor ⇒ zero job órfão:
 * o `enqueueOutbox` usa a mesma conexão transacional, então fato + job
 * cometem ou desfazem juntos.
 */
export async function enqueueAiControlRecommend(
  tx: unknown,
  clinicId: string,
  envelope: AiControlRecommendEnvelopeInput,
): Promise<void> {
  const payload: AiControlRecommendPayload = {
    ...envelope,
    version: AI_CONTROL_ENVELOPE_VERSION,
    clinicId,
  };
  // Validação fail-fast no produtor: envelope malformado nunca entra na fila.
  parseAiControlRecommendPayload({
    clinicId,
    operation: OUTBOX_OPERATIONS.AI_CONTROL_RECOMMEND,
    payload,
  } as OutboxJob);
  await enqueueOutbox(tx, {
    clinicId,
    operation: OUTBOX_OPERATIONS.AI_CONTROL_RECOMMEND,
    businessKey: buildAiControlBusinessKey(payload),
    payload: payload as unknown as Record<string, unknown>,
  });
}

/**
 * Consumidor OBSERVE: valida e devolve o hook de materialização. Nenhum
 * efeito além das três escritas do hook — sem LLM, sem RAG, sem envio.
 */
export async function dispatchAiControlRecommendJob(
  job: OutboxJob,
): Promise<OutboxSuccessHook> {
  const payload = parseAiControlRecommendPayload(job);
  const clinicId = job.clinicId;
  const occurredAt = new Date(payload.occurredAt);
  const data = payload.data ?? {};
  return async (tx: any) => {
    // Replay idempotente: a segunda liquidação do mesmo envelope não cria
    // nada (UNIQUEs `(clinic_id, event_id)` + `onConflictDoNothing`).
    await tx.insert(businessEvents).values({
      clinicId,
      eventId: payload.eventId,
      type: payload.type,
      version: payload.version,
      occurredAt,
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
      payload: data,
    }).onConflictDoNothing();
    await tx.insert(goals).values({
      clinicId,
      eventId: payload.eventId,
      status: 'queued',
    }).onConflictDoNothing();
    await tx.insert(agentRuns).values({
      clinicId,
      eventId: payload.eventId,
      status: 'queued',
      mode: 'observe',
    }).onConflictDoNothing();
  };
}
