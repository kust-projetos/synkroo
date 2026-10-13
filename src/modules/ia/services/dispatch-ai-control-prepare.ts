/**
 * P4 Slice 1B — consumidor OBSERVÁVEL `ai.control.prepare`.
 *
 * Contexto + RAG + proposta observável, SEM LLM e SEM executar efeitos:
 * recarrega o `business_events` com o tenant da linha do outbox, monta o
 * contexto (interlocutor via seam `atendimento/public` + últimas mensagens via
 * `getConversationContext` — a única PII que circula é o NOME do
 * interlocutor), consulta o RAG tenant-scoped
 * (`ragService.searchKnowledge(clinicId, query)`) e persiste a proposta em
 * `agent_runs` (`observed` com `result`/`sources`, ou `failed` com
 * `error_code` e `result` nulo).
 *
 * Ordem FORA × DENTRO da transação de liquidação (contrato E4 do outbox):
 * TUDO que é leitura/computação (evento, contexto, RAG, validação Zod)
 * acontece no sender — FORA da transação. O hook devolvido faz UMA única
 * escrita: `UPDATE agent_runs ... WHERE clinic_id + event_id AND
 * status = 'queued'` (idempotente; replay casa 0 linhas e liquida ok).
 *
 * Gate `AI_CONTROL_MODE` (env, default `observe`): `off` dispensa a análise
 * — a run é marcada `failed` com `error_code = AI_CONTROL_PREPARE_MODE_OFF`
 * e o job liquida como `delivered` (sem efeito, SEM DLQ: OFF é configuração
 * intencional, não falha operacional; a marca observável documenta o skip).
 *
 * Falha de infra do RAG (throw do `searchFn`) PROPAGA — é retryável com
 * backoff, nunca DLQ imediata. Saída com shape inválido NUNCA vira plano:
 * `failed` + `error_code`, `result` nulo, job `delivered`.
 *
 * Este módulo NÃO importa providers LLM, handlers de mutação de domínio nem
 * serviços de envio (coberto por teste estático de imports).
 */
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import type { OutboxJob, OutboxSuccessHook } from '@/lib/outbox/outbox-repository';
import { PermanentOutboxError } from '@/lib/outbox/errors';
import {
  OUTBOX_OPERATIONS,
  type AiControlPreparePayload,
} from '@/lib/outbox/operations';
import { getDb } from '@/lib/db/client';
import { agentRuns, businessEvents } from '@/modules/ia/schema/observe';
import { AI_CONTROL_ENVELOPE_VERSION } from './dispatch-ai-control-recommend';
import { getConversationContext, resolveInterlocutorContext } from '@/modules/atendimento/public';
import { defaultAiControlSearch } from '@/lib/ai-control/rag-search';

/** Código sanitizado da DLQ para envelope inválido ou tenant descasado. */
export const AI_CONTROL_PREPARE_INVALID_CODE = 'AI_CONTROL_PREPARE_INVALID';
/** `error_code` observável quando `AI_CONTROL_MODE=off` dispensa a análise. */
export const AI_CONTROL_PREPARE_MODE_OFF_CODE = 'AI_CONTROL_PREPARE_MODE_OFF';
/** `error_code` quando o evento 1A não existe para o tenant do job. */
export const AI_CONTROL_PREPARE_EVENT_MISSING_CODE = 'AI_CONTROL_PREPARE_EVENT_MISSING';
/** `error_code` quando a saída do RAG não valida no schema (nunca vira plano). */
export const AI_CONTROL_PREPARE_OUTPUT_INVALID_CODE = 'AI_CONTROL_PREPARE_OUTPUT_INVALID';

export class InvalidAiControlPrepareError extends PermanentOutboxError {
  constructor() {
    super(
      AI_CONTROL_PREPARE_INVALID_CODE,
      'Invalid ai.control.prepare envelope: rejected without side effects.',
    );
    this.name = 'InvalidAiControlPrepareError';
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Valida o envelope do job. Lança `InvalidAiControlPrepareError`
 * (permanente → DLQ imediata, sem retry, sem efeito) quando: operação
 * desconhecida, campo ausente/malformado, versão divergente ou `clinicId`
 * do envelope descasado do `clinicId` da linha do outbox.
 */
export function parseAiControlPreparePayload(job: OutboxJob): AiControlPreparePayload {
  if (job.operation !== OUTBOX_OPERATIONS.AI_CONTROL_PREPARE) {
    throw new InvalidAiControlPrepareError();
  }
  const raw: unknown = job.payload;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InvalidAiControlPrepareError();
  }
  const p = raw as Partial<AiControlPreparePayload>;
  if (
    !isNonEmptyString(p.eventId)
    || !isNonEmptyString(p.clinicId)
    || p.version !== AI_CONTROL_ENVELOPE_VERSION
  ) {
    throw new InvalidAiControlPrepareError();
  }
  // Cerco de tenant: o envelope carrega o tenant e ele deve casar com a
  // linha do outbox. O hook escreve/lê SEMPRE com `job.clinicId`, então um
  // descasamento nunca vira leitura cross-tenant — vira DLQ.
  if (p.clinicId !== job.clinicId) {
    throw new InvalidAiControlPrepareError();
  }
  return { eventId: p.eventId, clinicId: p.clinicId, version: p.version };
}

/**
 * Gate de modo do AI Control Plane. `AI_CONTROL_MODE=off` dispensa a
 * análise (job liquidado como `failed` observável, sem DLQ); qualquer outro
 * valor (incluindo ausente → default `observe`) analisa normalmente.
 */
export function readAiControlMode(readEnv: () => string | undefined = () => process.env.AI_CONTROL_MODE): string {
  return (readEnv() ?? 'observe').trim().toLowerCase();
}

export function isAiControlPrepareEnabled(mode: string): boolean {
  return mode !== 'off';
}

/**
 * Proposta observável: `next_step` textual determinístico (template, sem
 * LLM) + `sources` rastreáveis (`[{ id, title }]` — só identidade/título do
 * conhecimento, nunca conteúdo clínico ou PII).
 */
const AiControlProposalSchema = z.object({
  next_step: z.string().min(1),
  sources: z.array(z.object({
    id: z.string().min(1),
    title: z.string(),
  })),
});

export type AiControlProposal = z.infer<typeof AiControlProposalSchema>;

export function parseAiControlProposal(raw: unknown): AiControlProposal {
  return AiControlProposalSchema.parse(raw);
}

type BusinessEventRow = typeof businessEvents.$inferSelect;

/** RAG injetável: `(clinicId, query) => resultados`. Default: `ragService` (via adapter `lib`, sempre com o tenant do job). */
export type AiControlPrepareSearchFn = (clinicId: string, query: string) => Promise<unknown>;

export interface AiControlPrepareDeps {
  /** Busca RAG (default: `ragService.searchKnowledge` via adapter, sempre com o tenant do job). */
  searchFn?: AiControlPrepareSearchFn;
  /** Carga do evento 1A (default: `business_events` com predicado de tenant). */
  loadEvent?: (clinicId: string, eventId: string) => Promise<BusinessEventRow | null>;
  /** Contexto do interlocutor — só o NOME circula como PII (default: seams por telefone). */
  loadInterlocutorContext?: (clinicId: string, phone: string) => Promise<string>;
  /** Últimas mensagens tenant-scoped (default: `getConversationContext`). */
  loadConversationContext?: (clinicId: string, conversationId: string) => Promise<Array<{ role: string; content: string; intent: string | null }>>;
  /** Leitura do gate (default: `process.env.AI_CONTROL_MODE`). Injetável para testes. */
  readMode?: () => string;
}

async function defaultLoadEvent(clinicId: string, eventId: string): Promise<BusinessEventRow | null> {
  const [row] = await getDb()
    .select()
    .from(businessEvents)
    .where(and(eq(businessEvents.clinicId, clinicId), eq(businessEvents.eventId, eventId)))
    .limit(1);
  return row ?? null;
}

async function defaultLoadInterlocutorContext(clinicId: string, phone: string): Promise<string> {
  // Composição atrás do seam declarado (`atendimento` → `operacional` +
  // `comercial` no grafo aprovado): `ia` não declara dependência nova.
  return resolveInterlocutorContext(clinicId, phone);
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const v = record[key];
  return isNonEmptyString(v) ? v : null;
}

/**
 * Consumidor 1B: valida, monta contexto, consulta o RAG (FORA da transação
 * de liquidação) e devolve o hook com UMA escrita idempotente. Falha de
 * infra do RAG propaga (retryável); envelope inválido/tenant descasado é
 * permanente (DLQ).
 */
export async function dispatchAiControlPrepareJob(
  job: OutboxJob,
  deps: AiControlPrepareDeps = {},
): Promise<OutboxSuccessHook> {
  const payload = parseAiControlPreparePayload(job);
  const clinicId = job.clinicId;
  const searchFn: AiControlPrepareSearchFn = deps.searchFn ?? defaultAiControlSearch;
  const loadEvent = deps.loadEvent ?? defaultLoadEvent;
  const loadInterlocutorContext = deps.loadInterlocutorContext ?? defaultLoadInterlocutorContext;
  const loadConversationContext = deps.loadConversationContext
    ?? ((c, conv) => getConversationContext(c, conv, 10));
  const mode = deps.readMode ? deps.readMode() : readAiControlMode();

  // Gate OFF — dispensa a análise SEM efeito: hook marca `failed` observável
  // e o job liquida `delivered` (nunca DLQ: OFF é configuração, não falha).
  if (!isAiControlPrepareEnabled(mode)) {
    return async (tx: any) => {
      await tx.update(agentRuns).set({
        status: 'failed',
        result: null,
        sources: null,
        errorCode: AI_CONTROL_PREPARE_MODE_OFF_CODE,
        updatedAt: new Date(),
      }).where(and(
        eq(agentRuns.clinicId, clinicId),
        eq(agentRuns.eventId, payload.eventId),
        eq(agentRuns.status, 'queued'),
      ));
    };
  }

  // Evento 1A com predicado de tenant — nunca lê fato de outra clínica.
  const event = await loadEvent(clinicId, payload.eventId);
  if (!event) {
    return async (tx: any) => {
      await tx.update(agentRuns).set({
        status: 'failed',
        result: null,
        sources: null,
        errorCode: AI_CONTROL_PREPARE_EVENT_MISSING_CODE,
        updatedAt: new Date(),
      }).where(and(
        eq(agentRuns.clinicId, clinicId),
        eq(agentRuns.eventId, payload.eventId),
        eq(agentRuns.status, 'queued'),
      ));
    };
  }

  // Contexto: interlocutor (só o nome como PII) + últimas mensagens (contadas
  // para a proposta, conteúdo NUNCA enviado ao RAG). Tudo tenant-scoped.
  const data = (event.payload ?? {}) as Record<string, unknown>;
  const phone = stringField(data, 'phone');
  const conversationId = stringField(data, 'conversationId');
  const interlocutorContext = phone ? await loadInterlocutorContext(clinicId, phone) : '';
  const history = conversationId ? await loadConversationContext(clinicId, conversationId) : [];

  // Query RAG sem PII além do nome: tipo + assunto + contexto do
  // interlocutor (`Paciente: <nome>`). Conteúdo de mensagens, telefones e
  // identificadores NUNCA entram na query.
  const query = [event.type, event.subjectType, interlocutorContext].filter(Boolean).join(' ');
  // RAG com o tenant do JOB (cerco: `clinicId` nunca vem do envelope além da
  // validação — e a validação já garantiu `payload.clinicId === job.clinicId`).
  // Throw aqui = falha de infra → propaga para retry com backoff.
  const ragResults = await searchFn(clinicId, query);

  // Proposta determinística (template, sem LLM). `ragResults` fora do
  // contrato (não-array) ou fonte sem `id` NÃO valida → `failed`, nunca plano.
  const rawSources = Array.isArray(ragResults) ? ragResults : null;
  const proposal: unknown = rawSources === null ? { next_step: '', sources: [{ id: '', title: '' }] } : {
    next_step: `Observar ${event.type} (${event.subjectType})${interlocutorContext ? ` para ${interlocutorContext}` : ''} com ${rawSources.length} fonte(s) de conhecimento${history.length ? ` e ${history.length} mensagem(ns) de contexto` : ''}.`,
    sources: rawSources.map((r) => {
      const rec = (r ?? {}) as Record<string, unknown>;
      const id = typeof rec.id === 'string' ? rec.id : '';
      const question = typeof rec.question === 'string' ? rec.question : '';
      const category = typeof rec.category === 'string' ? rec.category : '';
      return { id, title: question || category };
    }),
  };
  const parsed = AiControlProposalSchema.safeParse(proposal);
  if (!parsed.success) {
    return async (tx: any) => {
      await tx.update(agentRuns).set({
        status: 'failed',
        result: null,
        sources: null,
        errorCode: AI_CONTROL_PREPARE_OUTPUT_INVALID_CODE,
        updatedAt: new Date(),
      }).where(and(
        eq(agentRuns.clinicId, clinicId),
        eq(agentRuns.eventId, payload.eventId),
        eq(agentRuns.status, 'queued'),
      ));
    };
  }

  const result = { next_step: parsed.data.next_step };
  const sources = parsed.data.sources;
  return async (tx: any) => {
    // UPDATE idempotente: só promove `queued` → `observed`. Replay casa 0
    // linhas (run já `observed`/`failed`) e o job liquida normalmente.
    await tx.update(agentRuns).set({
      status: 'observed',
      result,
      sources,
      errorCode: null,
      updatedAt: new Date(),
    }).where(and(
      eq(agentRuns.clinicId, clinicId),
      eq(agentRuns.eventId, payload.eventId),
      eq(agentRuns.status, 'queued'),
    ));
  };
}
