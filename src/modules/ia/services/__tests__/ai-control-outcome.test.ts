/**
 * P4 Slice 4 — Outcome telemetry (`conversation_resolved`, 1 outcome).
 *
 * Derivação pura + idempotência + `failed_workflow`, tudo com seams
 * injetáveis em memória: NENHUM efeito real, NENHUMA leitura fora do seam
 * (`business_events` tenant-scoped), NENHUMA atribuição sem evidência.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AI_CONTROL_OUTCOME_POLICY_VERSION,
  FAILED_WORKFLOW_TYPE,
  OUTCOME_EVIDENCE_EVENT_TYPE,
  OUTCOME_TELEMETRY_RESULT_KEY,
  OUTCOME_WINDOW_MS,
  SUPPORTED_OUTCOME_TYPE,
  buildOutcomeIdempotencyKey,
  deriveOutcome,
  getOutcomeTelemetry,
  isFinalOutcome,
  recordOutcome,
  shouldPersistOutcome,
  type DerivedOutcome,
  type OutcomeBusinessEvent,
  type OutcomeRunSnapshot,
} from '../ai-control-outcome';

const CLINIC_A = '11111111-1111-4111-8111-111111111111';
const CLINIC_B = '22222222-2222-4222-8222-222222222222';
const RUN_EVENT = 'evt-run-001';
const FACT_EVENT = 'evt-conv-resolved-001';

// Entrega ancorada em t0; janela de 48h ⇒ [t0, t0+48h].
const T0 = Date.parse('2026-10-01T10:00:00.000Z');
const T0_ISO = new Date(T0).toISOString();
const WINDOW_END_ISO = new Date(T0 + OUTCOME_WINDOW_MS).toISOString();

function successResult(durationMs: number | null = 210) {
  return {
    next_step: 'Observar X.',
    policy_decision: { decision: 'AUTO', action_id: 'operacional.obterPaciente' },
    execution_receipt: {
      idempotency_key: 'p4s3:exec:k',
      action_id: 'operacional.obterPaciente',
      policy_version: 'p4-policy-v1',
      exec_policy_version: 'p4-s3-exec-v1',
      attempt_id: null,
      // Âncora imutável da entrega (gravada na entrega, congelada — o UPDATE
      // de outcome nunca reescreve o receipt).
      executed_at: T0_ISO,
      ...(durationMs === null ? {} : { duration_ms: durationMs }),
    },
    execution_outcome: {
      status: 'business_success',
      evidence: { reason: 'postcondition_verified', verification: 'ok' },
      duration_ms: durationMs ?? 0,
    },
  };
}

function nonSuccessResult(execStatus: string, execReason = 'unknown_effect') {
  return {
    execution_receipt: {
      idempotency_key: 'p4s3:exec:k',
      action_id: 'operacional.obterPaciente',
      policy_version: 'p4-policy-v1',
      exec_policy_version: 'p4-s3-exec-v1',
      attempt_id: 'att-9',
      duration_ms: 95,
    },
    execution_outcome: { status: execStatus, evidence: { reason: execReason }, duration_ms: 95 },
  };
}

function runSnapshot(
  overrides: Partial<OutcomeRunSnapshot> & { result?: unknown } = {},
): OutcomeRunSnapshot {
  return {
    clinicId: CLINIC_A,
    eventId: RUN_EVENT,
    status: 'observed',
    result: successResult(),
    deliveredAt: T0_ISO,
    ...overrides,
  };
}

function businessFact(overrides: Partial<OutcomeBusinessEvent> = {}): OutcomeBusinessEvent {
  return {
    clinicId: CLINIC_A,
    eventId: FACT_EVENT,
    type: OUTCOME_EVIDENCE_EVENT_TYPE,
    occurredAt: new Date(T0 + 60 * 60 * 1000).toISOString(), // t0+1h, dentro
    subjectType: 'conversation',
    subjectId: 'conv-42',
    ...overrides,
  };
}

/**
 * Envelope de origem da run: o gatilho (`RUN_EVENT`) em `business_events`,
 * com o sujeito da entrega (`conversation/conv-42`). O próprio gatilho nunca
 * conta como conversão — só ancora o vínculo verificável.
 */
function originEvent(overrides: Partial<OutcomeBusinessEvent> = {}): OutcomeBusinessEvent {
  return {
    clinicId: CLINIC_A,
    eventId: RUN_EVENT,
    type: 'conversation.opened',
    occurredAt: new Date(T0 - 60 * 60 * 1000).toISOString(), // t0-1h, gatilho
    subjectType: 'conversation',
    subjectId: 'conv-42',
    ...overrides,
  };
}

/** Store em memória com a MESMA semântica do UPDATE condicional de produção. */
function memoryStore() {
  const runs = new Map<string, OutcomeRunSnapshot>();
  const store = {
    runs,
    writes: 0,
    loads: 0,
    eventLoads: 0,
    events: [] as OutcomeBusinessEvent[],
    loadRun: async (clinicId: string, eventId: string) => {
      store.loads += 1;
      return runs.get(`${clinicId}:${eventId}`) ?? null;
    },
    loadBusinessEvents: async (_clinicId: string) => {
      store.eventLoads += 1;
      return [...store.events];
    },
    saveOutcome: async (clinicId: string, eventId: string, next: Record<string, unknown>) => {
      const run = runs.get(`${clinicId}:${eventId}`);
      if (!run) return 0;
      // MESMA semântica do UPDATE de produção: merge de SOMENTE a chave sobre
      // o result ATUAL da linha (escritor concorrente de outra chave não perde
      // alteração) + toque em deliveredAt (espelha o bump de updatedAt do
      // UPDATE real — a âncora imutável do receipt deve absorvê-lo).
      const current =
        typeof run.result === 'object' && run.result !== null && !Array.isArray(run.result)
          ? (run.result as Record<string, unknown>)
          : {};
      if (getOutcomeTelemetry(current) !== null) return 0;
      const incoming =
        typeof next === 'object' && next !== null && !Array.isArray(next)
          ? (next as Record<string, unknown>)
          : {};
      store.writes += 1;
      const parsed = typeof run.deliveredAt === 'string' ? Date.parse(run.deliveredAt) : NaN;
      runs.set(`${clinicId}:${eventId}`, {
        ...run,
        deliveredAt: Number.isFinite(parsed)
          ? new Date(parsed + 60 * 1000).toISOString()
          : run.deliveredAt,
        result: { ...current, [OUTCOME_TELEMETRY_RESULT_KEY]: incoming[OUTCOME_TELEMETRY_RESULT_KEY] },
      });
      return 1;
    },
  };
  return store;
}

describe('outcome feliz: fato dentro da janela atribui com evidência', () => {
  it('attributed com attributed_to, window, evidence e duração do receipt', () => {
    const outcome = deriveOutcome(
      runSnapshot(),
      [originEvent(), businessFact()],
      T0 + 2 * 60 * 60 * 1000,
    );
    expect(outcome.type).toBe(SUPPORTED_OUTCOME_TYPE);
    expect(outcome.status).toBe('attributed');
    expect(outcome.attributed_to).toBe(FACT_EVENT);
    expect(outcome.window).toEqual({ start: T0_ISO, end: WINDOW_END_ISO });
    expect(outcome.evidence.business_event_id).toBe(FACT_EVENT);
    expect(outcome.evidence.business_event_type).toBe(OUTCOME_EVIDENCE_EVENT_TYPE);
    expect(outcome.evidence.occurred_at).toBe(new Date(T0 + 60 * 60 * 1000).toISOString());
    expect(outcome.duration_ms).toBe(210);
    expect('cost' in outcome).toBe(false); // custo nunca inventado
    expect(outcome.idempotency_key).toBe(
      buildOutcomeIdempotencyKey(CLINIC_A, RUN_EVENT, SUPPORTED_OUTCOME_TYPE),
    );
    expect(outcome.outcome_policy_version).toBe(AI_CONTROL_OUTCOME_POLICY_VERSION);
  });

  it('recordOutcome persiste o outcome final uma única vez', async () => {
    const store = memoryStore();
    store.runs.set(`${CLINIC_A}:${RUN_EVENT}`, runSnapshot());
    store.events = [originEvent(), businessFact()];
    const res = await recordOutcome(
      { clinicId: CLINIC_A, eventId: RUN_EVENT },
      { ...store, now: () => T0 + 2 * 60 * 60 * 1000 },
    );
    expect(res.recorded).toBe(true);
    expect(store.writes).toBe(1);
    expect(getOutcomeTelemetry(store.runs.get(`${CLINIC_A}:${RUN_EVENT}`)?.result)?.status).toBe(
      'attributed',
    );
  });

  it('primeiro fato da janela vence; posteriores não re-atribuem', () => {
    const outcome = deriveOutcome(
      runSnapshot(),
      [originEvent(), businessFact({ eventId: 'evt-late', occurredAt: new Date(T0 + 5 * 60 * 60 * 1000).toISOString() }), businessFact()],
      T0 + 6 * 60 * 60 * 1000,
    );
    expect(outcome.attributed_to).toBe(FACT_EVENT);
  });
});

describe('janela expirada: fato tardio não atribui', () => {
  it('not_attributed com reason window_expired e janela declarada', () => {
    const outcome = deriveOutcome(
      runSnapshot(),
      [businessFact({ occurredAt: new Date(T0 + OUTCOME_WINDOW_MS + 1000).toISOString() })],
      T0 + OUTCOME_WINDOW_MS + 60 * 1000,
    );
    expect(outcome.type).toBe(SUPPORTED_OUTCOME_TYPE);
    expect(outcome.status).toBe('not_attributed');
    expect(outcome.attributed_to).toBeNull();
    expect(outcome.evidence.reason).toBe('window_expired');
    expect(outcome.window).toEqual({ start: T0_ISO, end: WINDOW_END_ISO });
  });

  it('window_expired é final: persiste (janela fechada é estável)', async () => {
    const store = memoryStore();
    store.runs.set(`${CLINIC_A}:${RUN_EVENT}`, runSnapshot());
    store.events = [
      businessFact({ occurredAt: new Date(T0 + OUTCOME_WINDOW_MS + 1000).toISOString() }),
    ];
    const res = await recordOutcome(
      { clinicId: CLINIC_A, eventId: RUN_EVENT },
      { ...store, now: () => T0 + OUTCOME_WINDOW_MS + 60 * 1000 },
    );
    expect(res.recorded).toBe(true);
    expect(store.writes).toBe(1);
  });
});

describe('sem evidência: janela aberta não atribui e não persiste', () => {
  it('not_attributed com reason no_evidence', () => {
    const outcome = deriveOutcome(runSnapshot(), [], T0 + 60 * 60 * 1000);
    expect(outcome.status).toBe('not_attributed');
    expect(outcome.attributed_to).toBeNull();
    expect(outcome.evidence.reason).toBe('no_evidence');
    expect(outcome.window).toEqual({ start: T0_ISO, end: WINDOW_END_ISO });
    expect(isFinalOutcome(outcome)).toBe(false);
  });

  it('transitório deriva sem escrever (not_final)', async () => {
    const store = memoryStore();
    store.runs.set(`${CLINIC_A}:${RUN_EVENT}`, runSnapshot());
    store.events = [];
    const res = await recordOutcome(
      { clinicId: CLINIC_A, eventId: RUN_EVENT },
      { ...store, now: () => T0 + 60 * 60 * 1000 },
    );
    expect(res).toMatchObject({ recorded: false, reason: 'not_final' });
    expect(store.writes).toBe(0);
    expect(getOutcomeTelemetry(store.runs.get(`${CLINIC_A}:${RUN_EVENT}`)?.result)).toBeNull();
  });

  it('sem entrega (receipt ausente) ⇒ not_delivered, sem janela, sem escrita', async () => {
    const outcome = deriveOutcome(
      runSnapshot({ result: { next_step: 'x' }, deliveredAt: null }),
      [businessFact()],
      T0 + 60 * 60 * 1000,
    );
    expect(outcome.status).toBe('not_attributed');
    expect(outcome.evidence.reason).toBe('not_delivered');
    expect(outcome.window).toBeNull();
    expect(outcome.attributed_to).toBeNull();
  });

  it('outcome business_success SEM receipt ⇒ not_delivered (só outcome, sem receipt)', async () => {
    const receiptless = {
      execution_outcome: {
        status: 'business_success',
        evidence: { reason: 'postcondition_verified' },
        duration_ms: 50,
      },
    };
    const outcome = deriveOutcome(
      runSnapshot({ result: receiptless }),
      [originEvent(), businessFact()],
      T0 + 60 * 60 * 1000,
    );
    expect(outcome.status).toBe('not_attributed');
    expect(outcome.evidence.reason).toBe('not_delivered');
    expect(outcome.window).toBeNull();
    expect(outcome.attributed_to).toBeNull();
    const store = memoryStore();
    store.runs.set(`${CLINIC_A}:${RUN_EVENT}`, runSnapshot({ result: receiptless }));
    store.events = [originEvent(), businessFact()];
    const res = await recordOutcome(
      { clinicId: CLINIC_A, eventId: RUN_EVENT },
      { ...store, now: () => T0 + 60 * 60 * 1000 },
    );
    expect(res).toMatchObject({ recorded: false, reason: 'not_final' });
    expect(store.writes).toBe(0);
  });
});

describe('replay idempotente: mesma run não duplica nem reescreve', () => {
  it('segundo record encontra already_recorded sem novo write', async () => {
    const store = memoryStore();
    store.runs.set(`${CLINIC_A}:${RUN_EVENT}`, runSnapshot());
    store.events = [originEvent(), businessFact()];
    const deps = { ...store, now: () => T0 + 2 * 60 * 60 * 1000 };
    const first = await recordOutcome({ clinicId: CLINIC_A, eventId: RUN_EVENT }, deps);
    expect(first.recorded).toBe(true);
    // O save tocou deliveredAt (como o UPDATE real toca updatedAt); a âncora
    // imutável do receipt absorve o deslocamento.
    expect(store.runs.get(`${CLINIC_A}:${RUN_EVENT}`)?.deliveredAt).not.toBe(T0_ISO);
    const second = await recordOutcome({ clinicId: CLINIC_A, eventId: RUN_EVENT }, deps);
    expect(second).toMatchObject({ recorded: false, reason: 'already_recorded' });
    expect(store.writes).toBe(1);
    // Replay devolve o outcome existente idêntico, não uma re-derivação.
    expect(first.recorded).toBe(true);
    if (first.recorded && !second.recorded) {
      expect(second.outcome).toEqual(first.outcome);
    }
  });

  it('re-derivação idêntica não reescreve (deep-equal antes do UPDATE)', () => {
    const derived = deriveOutcome(
      runSnapshot(),
      [originEvent(), businessFact()],
      T0 + 2 * 60 * 60 * 1000,
    );
    const existingResult = { [OUTCOME_TELEMETRY_RESULT_KEY]: JSON.parse(JSON.stringify(derived)) };
    // Ordem de chaves embaralhada ainda é idêntica (jsonb não ordena).
    const shuffled = { [OUTCOME_TELEMETRY_RESULT_KEY]: {
      outcome_policy_version: derived.outcome_policy_version,
      idempotency_key: derived.idempotency_key,
      window: derived.window,
      evidence: derived.evidence,
      attributed_to: derived.attributed_to,
      status: derived.status,
      type: derived.type,
      ...(derived.duration_ms === undefined ? {} : { duration_ms: derived.duration_ms }),
    } };
    expect(shouldPersistOutcome(existingResult, derived)).toMatchObject({
      persist: false,
      reason: 'already_recorded',
    });
    expect(shouldPersistOutcome(shuffled, derived)).toMatchObject({
      persist: false,
      reason: 'already_recorded',
    });
  });

  it('chave determinística: mesma tupla ⇒ mesma chave', () => {
    expect(buildOutcomeIdempotencyKey(CLINIC_A, RUN_EVENT, SUPPORTED_OUTCOME_TYPE)).toBe(
      `outcome:${CLINIC_A}:${RUN_EVENT}:${SUPPORTED_OUTCOME_TYPE}`,
    );
  });
});

describe('failed_workflow: suspended/failed sem atribuição de conversão', () => {
  it.each([
    ['suspended', 'unknown_effect'],
    ['failed', 'execution_failed'],
  ])('exec %s ⇒ type failed_workflow, status failed, sem janela', (execStatus, reason) => {
    const outcome = deriveOutcome(
      runSnapshot({ result: nonSuccessResult(execStatus, reason) }),
      [businessFact()], // mesmo com fato, falha de entrega não converte
      T0 + 2 * 60 * 60 * 1000,
    );
    expect(outcome.type).toBe(FAILED_WORKFLOW_TYPE);
    expect(outcome.status).toBe('failed');
    expect(outcome.attributed_to).toBeNull();
    expect(outcome.window).toBeNull();
    expect(outcome.evidence.exec_status).toBe(execStatus);
    expect(outcome.idempotency_key).toBe(
      buildOutcomeIdempotencyKey(CLINIC_A, RUN_EVENT, FAILED_WORKFLOW_TYPE),
    );
  });

  it('failed_workflow é final e persiste', async () => {
    const store = memoryStore();
    store.runs.set(
      `${CLINIC_A}:${RUN_EVENT}`,
      runSnapshot({ result: nonSuccessResult('suspended') }),
    );
    store.events = [businessFact()];
    const res = await recordOutcome(
      { clinicId: CLINIC_A, eventId: RUN_EVENT },
      { ...store, now: () => T0 + 2 * 60 * 60 * 1000 },
    );
    expect(res.recorded).toBe(true);
    if (res.recorded) expect(res.outcome.type).toBe(FAILED_WORKFLOW_TYPE);
  });
});

describe('negativo tenant: fato de outra clínica nunca evidencia', () => {
  it('evento de CLINIC_B não atribui run de CLINIC_A', () => {
    const outcome = deriveOutcome(
      runSnapshot(),
      [businessFact({ clinicId: CLINIC_B })],
      T0 + 60 * 60 * 1000,
    );
    expect(outcome.status).toBe('not_attributed');
    expect(outcome.attributed_to).toBeNull();
    expect(outcome.evidence.reason).toBe('no_evidence');
  });

  it('record com tenant divergente dispensa sem ler eventos nem escrever', async () => {
    const store = memoryStore();
    // Defesa em profundidade: run alcançável pela chave mas com tenant interno
    // divergente (na produção o WHERE já filtra; a guarda nunca confia só nele).
    store.runs.set(`${CLINIC_B}:${RUN_EVENT}`, runSnapshot());
    const res = await recordOutcome(
      { clinicId: CLINIC_B, eventId: RUN_EVENT },
      { ...store, now: () => T0 },
    );
    expect(res).toMatchObject({ recorded: false, reason: 'tenant_mismatch' });
    expect(store.eventLoads).toBe(0);
    expect(store.writes).toBe(0);
  });
});

describe('vínculo verificável: só o mesmo sujeito da entrega converte', () => {
  it('outra conversa do mesmo tenant/clínica/janela NÃO atribui', () => {
    const outcome = deriveOutcome(
      runSnapshot(),
      [originEvent(), businessFact({ eventId: 'evt-outra-conversa', subjectId: 'conv-99' })],
      T0 + 2 * 60 * 60 * 1000,
    );
    expect(outcome.status).toBe('not_attributed');
    expect(outcome.attributed_to).toBeNull();
    expect(outcome.evidence.reason).toBe('subject_mismatch');
    expect(outcome.window).toEqual({ start: T0_ISO, end: WINDOW_END_ISO });
    expect(isFinalOutcome(outcome)).toBe(false); // transitório: fato vinculado ainda pode chegar
  });

  it('sem envelope de origem identificável ⇒ no_subject_link (fail-closed)', () => {
    const outcome = deriveOutcome(runSnapshot(), [businessFact()], T0 + 2 * 60 * 60 * 1000);
    expect(outcome.status).toBe('not_attributed');
    expect(outcome.attributed_to).toBeNull();
    expect(outcome.evidence.reason).toBe('no_subject_link');
  });

  it('origem sem sujeito não ancora vínculo', () => {
    const outcome = deriveOutcome(
      runSnapshot(),
      [originEvent({ subjectType: '', subjectId: '' }), businessFact()],
      T0 + 2 * 60 * 60 * 1000,
    );
    expect(outcome.evidence.reason).toBe('no_subject_link');
  });

  it('o próprio gatilho da run nunca conta como conversão', async () => {
    const store = memoryStore();
    store.runs.set(`${CLINIC_A}:${RUN_EVENT}`, runSnapshot());
    // Só a origem (tipo de evidência, mesmo sujeito): gatilho excluído ⇒ sem
    // candidatos ⇒ transitório, sem escrita.
    store.events = [originEvent({ eventId: RUN_EVENT, type: OUTCOME_EVIDENCE_EVENT_TYPE })];
    const res = await recordOutcome(
      { clinicId: CLINIC_A, eventId: RUN_EVENT },
      { ...store, now: () => T0 + 2 * 60 * 60 * 1000 },
    );
    expect(res).toMatchObject({ recorded: false, reason: 'not_final' });
    expect(store.writes).toBe(0);
  });
});

describe('âncora imutável: deliveredAt mutável não desloca a janela', () => {
  it('re-derivação após toque em deliveredAt é idêntica (âncora no receipt)', () => {
    const base = deriveOutcome(
      runSnapshot(),
      [originEvent(), businessFact()],
      T0 + 2 * 60 * 60 * 1000,
    );
    expect(base.status).toBe('attributed');
    const shifted = deriveOutcome(
      runSnapshot({ deliveredAt: new Date(T0 + 3 * 60 * 60 * 1000).toISOString() }),
      [originEvent(), businessFact()],
      T0 + 4 * 60 * 60 * 1000,
    );
    expect(shifted).toEqual(base);
  });

  it('receipt legado sem executed_at ⇒ no_delivery_time (nunca atribuído por janela incerta)', () => {
    const legacyResult = {
      ...(successResult() as Record<string, unknown>),
      execution_receipt: {
        idempotency_key: 'p4s3:exec:k',
        action_id: 'operacional.obterPaciente',
        policy_version: 'p4-policy-v1',
        exec_policy_version: 'p4-s3-exec-v1',
        attempt_id: null,
        duration_ms: 210,
        // SEM executed_at: sem âncora verificável.
      },
    };
    const outcome = deriveOutcome(
      runSnapshot({ result: legacyResult, deliveredAt: T0_ISO }),
      [originEvent(), businessFact()],
      T0 + 2 * 60 * 60 * 1000,
    );
    expect(outcome.status).toBe('not_attributed');
    expect(outcome.evidence.reason).toBe('no_delivery_time');
    expect(outcome.window).toBeNull();
    expect(outcome.attributed_to).toBeNull();
  });

  it('integração leve executor→outcome: receipt real ancora a janela (sem DB)', async () => {
    const { executeDecidedRun: realExecute } = await import('../ai-control-executor');
    const { AI_CONTROL_POLICY_VERSION: execPolicyV } = await import('../ai-control-policy');
    const FIXED = T0;
    const runs = new Map<string, { clinicId: string; status: string; result: unknown }>();
    runs.set(`${CLINIC_A}:${RUN_EVENT}`, {
      clinicId: CLINIC_A,
      status: 'observed',
      result: {
        next_step: 'Observar X.',
        policy_decision: {
          decision: 'AUTO',
          riskClass: 'standard',
          reason: 'auto_standard',
          policy_version: execPolicyV,
          action_id: 'operacional.obterPaciente',
        },
      },
    });
    const execOut = await realExecute(
      {
        clinicId: CLINIC_A,
        eventId: RUN_EVENT,
        decision: {
          decision: 'AUTO',
          riskClass: 'standard',
          reason: 'auto_standard',
          policy_version: execPolicyV,
          action_id: 'operacional.obterPaciente',
        } as never,
        input: { id: '33333333-3333-4333-8333-333333333333' },
        actionCtx: {
          source: 'system',
          clinicId: CLINIC_A,
          can: () => true,
          hasModule: () => true,
          audit: { actor: 'ai-control-test' },
        },
      },
      {
        readMode: () => 'auto_limitado',
        loadRun: async (c, e) => runs.get(`${c}:${e}`) ?? null,
        claimExecution: async () => 1,
        saveExecution: async (c, e, next) => {
          const run = runs.get(`${c}:${e}`);
          if (!run) return 0;
          runs.set(`${c}:${e}`, { ...run, result: next });
          return 1;
        },
        runAction: async () => ({ ok: true, data: { id: '33333333-3333-4333-8333-333333333333' } }),
        readBack: async () => ({ id: '33333333-3333-4333-8333-333333333333' }),
        now: () => FIXED,
      },
    );
    expect(execOut.executed).toBe(true);
    if (!execOut.executed) throw new Error('expected execution');
    // O receipt real carrega executed_at == relógio injetável.
    expect(execOut.receipt.executed_at).toBe(T0_ISO);
    // Outcome ancora a janela NESSE receipt (deliveredAt divergente é ignorado).
    const outcome = deriveOutcome(
      {
        clinicId: CLINIC_A,
        eventId: RUN_EVENT,
        status: 'observed',
        result: {
          execution_receipt: { ...execOut.receipt },
          execution_outcome: { ...execOut.outcome },
        },
        deliveredAt: new Date(T0 + 3 * 60 * 60 * 1000).toISOString(),
      },
      [originEvent(), businessFact()],
      T0 + 2 * 60 * 60 * 1000,
    );
    expect(outcome.status).toBe('attributed');
    expect(outcome.window).toEqual({ start: T0_ISO, end: WINDOW_END_ISO });
    expect(outcome.attributed_to).toBe(FACT_EVENT);
  });
});

describe('conflito de escrita: perdedora devolve o outcome EXISTENTE do banco', () => {
  it('UPDATE com 0 linhas recarrega e responde already_recorded com conteúdo do banco', async () => {
    const winnerOutcome = deriveOutcome(
      runSnapshot(),
      [originEvent(), businessFact()],
      T0 + 2 * 60 * 60 * 1000,
    );
    expect(winnerOutcome.status).toBe('attributed');
    // Conteúdo do vencedor difere do que a perdedora derivaria: fato vinculado
    // invisível para a perdedora, muito depois (janela expirada).
    const LATE = T0 + OUTCOME_WINDOW_MS + 60 * 1000;
    const loserEvents = [originEvent()];
    const loserDerivedCheck = deriveOutcome(runSnapshot(), loserEvents, LATE);
    expect(loserDerivedCheck.evidence.reason).toBe('window_expired');
    expect(loserDerivedCheck).not.toEqual(winnerOutcome);

    const staleResult = runSnapshot().result;
    let loads = 0;
    const loadRun = async () => {
      loads += 1;
      if (loads === 1) {
        // Load inicial: sem outcome (vencedor ainda não visível).
        return runSnapshot({ result: staleResult });
      }
      // Reload pós-conflito: vencedor já gravou, com conteúdo DIFERENTE.
      return runSnapshot({
        result: {
          ...(staleResult as Record<string, unknown>),
          [OUTCOME_TELEMETRY_RESULT_KEY]: JSON.parse(JSON.stringify(winnerOutcome)),
        },
      });
    };
    const res = await recordOutcome(
      { clinicId: CLINIC_A, eventId: RUN_EVENT },
      {
        loadRun,
        loadBusinessEvents: async () => [originEvent()],
        saveOutcome: async () => 0, // vencedor gravou entre load e save
        now: () => T0 + OUTCOME_WINDOW_MS + 60 * 1000,
      },
    );
    expect(res).toMatchObject({ recorded: false, reason: 'already_recorded' });
    // Perdedora devolve o EXISTENTE (vencedor), não o seu derived divergente.
    if (!res.recorded) {
      expect(res.outcome).toEqual(winnerOutcome);
    }
    expect(loads).toBe(2);
  });
});

describe('merge: escritor concorrente de outra chave não perde alteração', () => {
  it('save adiciona SÓ outcome_telemetry sobre o result atual', async () => {
    const store = memoryStore();
    store.runs.set(`${CLINIC_A}:${RUN_EVENT}`, runSnapshot());
    store.events = [originEvent(), businessFact()];
    // Escritor concorrente entre o load da run e o save: grava outra chave.
    const racingLoadBusinessEvents = async (_clinicId: string) => {
      const run = store.runs.get(`${CLINIC_A}:${RUN_EVENT}`);
      if (run) {
        store.runs.set(`${CLINIC_A}:${RUN_EVENT}`, {
          ...run,
          result: {
            ...(run.result as Record<string, unknown>),
            concurrent_probe: 'keep-me',
          },
        });
      }
      return [...store.events];
    };
    const res = await recordOutcome(
      { clinicId: CLINIC_A, eventId: RUN_EVENT },
      { ...store, loadBusinessEvents: racingLoadBusinessEvents, now: () => T0 + 2 * 60 * 60 * 1000 },
    );
    expect(res.recorded).toBe(true);
    const finalResult = store.runs.get(`${CLINIC_A}:${RUN_EVENT}`)?.result as Record<
      string,
      unknown
    >;
    expect(finalResult.concurrent_probe).toBe('keep-me');
    expect(getOutcomeTelemetry(finalResult)?.status).toBe('attributed');
  });
});

describe('duração e custo honestos', () => {
  it('sem duration no receipt ⇒ duration_ms omitida (nunca zero inventado)', () => {
    const outcome = deriveOutcome(
      runSnapshot({ result: successResult(null) }),
      [originEvent(), businessFact()],
      T0 + 2 * 60 * 60 * 1000,
    );
    expect(outcome.status).toBe('attributed');
    expect('duration_ms' in outcome).toBe(false);
    expect('cost' in outcome).toBe(false);
  });
});

describe('S4 estático: sem LLM/execução/envio/mutação; sem DDL', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'ai-control-outcome.ts'),
    'utf8',
  );

  it.each([
    ['LLM', /from\s+['"]@\/lib\/llm\//],
    ['provider IA vivo', /provider-zen|openai|minimax|openrouter/i],
    ['RAG', /searchKnowledge|ragService/i],
    ['execução de Actions', /runAction|getAction|executeDecidedRun/i],
    ['envio WhatsApp/Evolution', /evolution|sendByChannel|send-message-service/i],
    ['gateway de pagamento', /dispatch-charge-job|payment-gateway/i],
    ['mutação de domínio', /updateLead|createAppointment|dispatchCharge|insertPatient|upsertLead/i],
    ['fetch externo', /fetch\s*\(/],
    ['leitura fora do seam', /from\s+['"]@\/lib\/db\/schema\//],
  ])('módulo não importa %s', (_label, pattern) => {
    expect(source).not.toMatch(pattern);
  });

  it('persistência usa UPDATE condicional com predicado de ausência (idempotente, sem DDL)', () => {
    expect(source).toMatch(/outcome_telemetry.*IS NULL/);
    expect(source).not.toMatch(/CREATE TABLE|createTable|migrate\(\s*getDb/i);
  });

  it('outcome gravado sob chave outcome_telemetry com idempotency_key outcome:{clinic}:{event}:{type}', () => {
    expect(source).toMatch(/OUTCOME_TELEMETRY_RESULT_KEY/);
    expect(source).toMatch(/outcome:\$\{/);
  });
});

describe('tipos derivados (contrato de saída)', () => {
  it('DerivedOutcome carrega type/status/attributed_to/window/evidence', () => {
    const o: DerivedOutcome = deriveOutcome(
      runSnapshot(),
      [originEvent(), businessFact()],
      T0 + 3600000,
    );
    expect(Object.keys(o).sort()).toEqual(
      expect.arrayContaining(['type', 'status', 'attributed_to', 'window', 'evidence']),
    );
  });
});
