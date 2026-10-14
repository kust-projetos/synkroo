/**
 * P4 Slice 3 — executor gateado + verificação determinística.
 *
 * Tudo com seams injetáveis (store/runAction/readBack/verify em memória):
 * NENHUM efeito real — `runAction` é sempre mockado/injetável e o default de
 * produção só é alcançável com `AI_CONTROL_MODE=auto_limitado` + AUTO +
 * allowlist (cobertura dos gates prova a dispensa sem efeito).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ActionContext } from '@/core/actions/types';
import { AI_CONTROL_POLICY_VERSION } from '../ai-control-policy';
import {
  AI_CONTROL_EXEC_ALLOWLIST,
  AI_CONTROL_EXEC_MODE,
  AI_CONTROL_EXEC_POLICY_VERSION,
  EXECUTION_CLAIM_STALE_MS,
  buildExecutionIdempotencyKey,
  canExecuteDecision,
  executeDecidedRun,
  getExecutionClaim,
  getExecutionReceipt,
  hasExecutionReceipt,
  isAiControlExecEnabled,
  isAllowlistedAction,
  isExecutionClaimStale,
  mergeExecutionRecord,
  readAiControlExecMode,
  shouldPersistExecution,
  verifyObterPaciente,
  type ExecRunSnapshot,
  type ExecutionOutcome,
  type ExecutionReceipt,
} from '../ai-control-executor';

const CLINIC_A = '11111111-1111-4111-8111-111111111111';
const CLINIC_B = '22222222-2222-4222-8222-222222222222';
const PATIENT_ID = '33333333-3333-4333-8333-333333333333';

const ACTION_ID = 'operacional.obterPaciente' as const;

function autoDecision(actionId: string | null = ACTION_ID) {
  return {
    decision: 'AUTO' as const,
    riskClass: 'standard',
    reason: 'auto_standard',
    policy_version: AI_CONTROL_POLICY_VERSION,
    action_id: actionId,
  };
}

function actionCtx(): ActionContext {
  return {
    source: 'system',
    clinicId: CLINIC_A,
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'ai-control-test' },
  };
}

/** Store em memória tenant-scoped com writes contados + hooks de observação. */
function memoryStore() {
  const runs = new Map<string, ExecRunSnapshot>();
  const store = {
    runs,
    writes: 0,
    loads: 0,
    claims: 0,
    loadRun: async (clinicId: string, eventId: string) => {
      store.loads += 1;
      return runs.get(`${clinicId}:${eventId}`) ?? null;
    },
    /**
     * Reserva atômica em memória com a MESMA semântica do UPDATE condicional
     * de produção: tenant + evento + `observed` + decisão AUTO + sem receipt
     * + (sem claim ou claim stale >10min). Check-and-set sem `await` no meio
     * ⇒ atômico no event loop (um vencedor por corrida).
     */
    claimExecution: async (clinicId: string, eventId: string, by: string) => {
      const run = runs.get(`${clinicId}:${eventId}`);
      if (!run) return 0;
      if (run.clinicId !== clinicId) return 0;
      if (run.status !== 'observed') return 0;
      const result =
        typeof run.result === 'object' && run.result !== null && !Array.isArray(run.result)
          ? (run.result as Record<string, unknown>)
          : {};
      if (result.execution_receipt !== undefined && result.execution_receipt !== null) return 0;
      if ((result.policy_decision as { decision?: unknown } | undefined)?.decision !== 'AUTO') return 0;
      const existing = getExecutionClaim(run.result);
      if (existing && !isExecutionClaimStale(existing.at, Date.now())) return 0;
      store.claims += 1;
      runs.set(`${clinicId}:${eventId}`, {
        ...run,
        result: { ...result, execution_claim: { by, at: new Date().toISOString() } },
      });
      return 1;
    },
    saveExecution: async (clinicId: string, eventId: string, next: Record<string, unknown>) => {
      const run = runs.get(`${clinicId}:${eventId}`);
      if (!run) return 0;
      if (hasExecutionReceipt(run.result)) return 0;
      store.writes += 1;
      runs.set(`${clinicId}:${eventId}`, { ...run, result: next });
      return 1;
    },
  };
  return store;
}

function seedObserved(store: ReturnType<typeof memoryStore>, eventId: string, clinicId = CLINIC_A) {
  store.runs.set(`${clinicId}:${eventId}`, {
    clinicId,
    status: 'observed',
    result: { next_step: 'Observar X.', policy_decision: autoDecision() },
  });
}

describe('gate de modo: só auto_limitado executa (off/observe dispensam sem efeito)', () => {
  it.each([['off'], ['observe'], [''], ['act'], ['AUTO_LIMITADO_typo']])(
    'modo %s ⇒ sem execução, sem leitura, sem escrita',
    async (mode) => {
      const store = memoryStore();
      seedObserved(store, 'evt-mode');
      let runs = 0;
      const out = await executeDecidedRun(
        { clinicId: CLINIC_A, eventId: 'evt-mode', decision: autoDecision(), input: { id: PATIENT_ID }, actionCtx: actionCtx() },
        {
          readMode: () => mode === '' ? '' : mode,
          loadRun: store.loadRun,
          saveExecution: store.saveExecution,
          claimExecution: store.claimExecution,
          runAction: async () => { runs += 1; return { ok: true, data: { id: PATIENT_ID } }; },
        },
      );
      expect(out).toMatchObject({ executed: false, reason: 'mode_not_auto' });
      expect(runs).toBe(0);
      expect(store.loads).toBe(0);
      expect(store.writes).toBe(0);
      expect(hasExecutionReceipt(store.runs.get(`${CLINIC_A}:evt-mode`)?.result)).toBe(false);
    },
  );

  it('default do sistema continua observe (lê env ausente como observe)', () => {
    expect(readAiControlExecMode(() => undefined)).toBe('observe');
    expect(isAiControlExecEnabled('observe')).toBe(false);
    expect(isAiControlExecEnabled('off')).toBe(false);
    expect(isAiControlExecEnabled(AI_CONTROL_EXEC_MODE)).toBe(true);
    expect(AI_CONTROL_EXEC_MODE).toBe('auto_limitado');
  });
});

describe('gate de decisão + allowlist estreita (1 action de leitura)', () => {
  it('allowlist contém EXATAMENTE a leitura verificável de menor risco', () => {
    expect([...AI_CONTROL_EXEC_ALLOWLIST]).toEqual(['operacional.obterPaciente']);
  });

  it.each([
    ['DENY', 'operacional.obterPaciente', 'not_auto'],
    ['CONFIRM', 'operacional.obterPaciente', 'not_auto'],
    ['APPROVAL', 'operacional.obterPaciente', 'not_auto'],
    ['AUTO', 'operacional.agendarConsulta', 'not_allowlisted'],
    ['AUTO', 'atendimento.enviarMensagemDireta', 'not_allowlisted'],
    ['AUTO', null, 'not_allowlisted'],
  ])('decisão %s / action %s ⇒ nunca executa (%s)', async (decision, actionId, reason) => {
    const store = memoryStore();
    seedObserved(store, 'evt-gate');
    let runs = 0;
    const out = await executeDecidedRun(
      {
        clinicId: CLINIC_A,
        eventId: 'evt-gate',
        decision: { ...autoDecision(), decision: decision as never, action_id: actionId },
        input: { id: PATIENT_ID },
        actionCtx: actionCtx(),
      },
      {
        readMode: () => 'auto_limitado',
        loadRun: store.loadRun,
        saveExecution: store.saveExecution,
        claimExecution: store.claimExecution,
        runAction: async () => { runs += 1; return { ok: true, data: {} }; },
      },
    );
    expect(out).toMatchObject({ executed: false, reason });
    expect(runs).toBe(0);
    expect(store.writes).toBe(0);
  });

  it('decisão ausente ⇒ dispensa sem efeito', async () => {
    const out = await executeDecidedRun(
      { clinicId: CLINIC_A, eventId: 'evt-x', decision: null, input: {}, actionCtx: actionCtx() },
      { readMode: () => 'auto_limitado' },
    );
    expect(out).toMatchObject({ executed: false, reason: 'no_decision' });
  });

  it('canExecuteDecision é pura e determinística', () => {
    expect(canExecuteDecision(autoDecision())).toEqual({ executable: true, reason: 'ok' });
    expect(canExecuteDecision(autoDecision())).toEqual(canExecuteDecision(autoDecision()));
    expect(isAllowlistedAction('operacional.agendarConsulta')).toBe(false);
    expect(isAllowlistedAction(ACTION_ID)).toBe(true);
  });
});

describe('idempotência: replay do mesmo run não re-executa', () => {
  function execDeps(store: ReturnType<typeof memoryStore>, extra: Record<string, unknown> = {}) {
    let runs = 0;
    return {
      runs: () => runs,
      deps: {
        readMode: () => 'auto_limitado',
        loadRun: store.loadRun,
        saveExecution: store.saveExecution,
        claimExecution: store.claimExecution,
        runAction: async () => { runs += 1; return { ok: true, data: { id: PATIENT_ID } }; },
        readBack: async () => ({ id: PATIENT_ID }),
        ...extra,
      },
    };
  }

  it('segunda chamada encontra o receipt e não re-executa', async () => {
    const store = memoryStore();
    seedObserved(store, 'evt-replay');
    const { runs, deps } = execDeps(store);
    const params = {
      clinicId: CLINIC_A,
      eventId: 'evt-replay',
      decision: autoDecision(),
      input: { id: PATIENT_ID },
      actionCtx: actionCtx(),
    };
    const first = await executeDecidedRun(params, deps);
    expect(first.executed).toBe(true);
    expect(runs()).toBe(1);
    const second = await executeDecidedRun(params, deps);
    expect(second).toMatchObject({ executed: false, reason: 'already_executed' });
    expect(runs()).toBe(1);
    expect(store.writes).toBe(1);
    // Mesmo receipt devolvido no replay (correlação preservada).
    expect((second as { receipt?: ExecutionReceipt }).receipt)
      .toEqual((first as { receipt: ExecutionReceipt }).receipt);
  });

  it('chave determinística: mesma tupla ⇒ mesma chave', () => {
    const k1 = buildExecutionIdempotencyKey(CLINIC_A, 'e1', ACTION_ID, AI_CONTROL_POLICY_VERSION);
    expect(buildExecutionIdempotencyKey(CLINIC_A, 'e1', ACTION_ID, AI_CONTROL_POLICY_VERSION)).toBe(k1);
    expect(k1).toContain(CLINIC_A);
    expect(buildExecutionIdempotencyKey(CLINIC_A, 'e2', ACTION_ID, AI_CONTROL_POLICY_VERSION)).not.toBe(k1);
  });

  it('corrida com barreira: exatamente 1 runAction; perdedor não toca execução/verificação', async () => {
    const store = memoryStore();
    seedObserved(store, 'evt-race');
    let runs = 0;
    let readBacks = 0;
    let verifies = 0;
    // Barreira no load: segura o primeiro executor até AMBOS terem lido a run
    // sem receipt (pior TOCTOU do check-then-act). Mesmo assim, só o vencedor
    // da reserva atômica (claim PRÉ-execução) alcança runAction/readBack.
    let loadsSeen = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const barrierLoad: typeof store.loadRun = async (clinicId, eventId) => {
      const run = await store.loadRun(clinicId, eventId);
      loadsSeen += 1;
      if (loadsSeen >= 2) release();
      else await gate;
      return run;
    };
    const deps = {
      readMode: () => 'auto_limitado',
      loadRun: barrierLoad,
      saveExecution: store.saveExecution,
      claimExecution: store.claimExecution,
      runAction: async () => { runs += 1; return { ok: true, data: { id: PATIENT_ID } }; },
      readBack: async () => { readBacks += 1; return { id: PATIENT_ID }; },
      verify: (_a: unknown, i: unknown, rb: unknown) => {
        verifies += 1;
        return verifyObterPaciente((i as { id: string }).id, rb);
      },
    };
    const params = {
      clinicId: CLINIC_A,
      eventId: 'evt-race',
      decision: autoDecision(),
      input: { id: PATIENT_ID },
      actionCtx: actionCtx(),
    };
    const [a, b] = await Promise.all([executeDecidedRun(params, deps), executeDecidedRun(params, deps)]);
    // Ambos leram antes de qualquer reserva — a claim decidiu, não o load.
    expect(loadsSeen).toBe(2);
    expect(store.claims).toBe(1);
    expect(store.writes).toBe(1);
    const executed = [a, b].filter((o) => o.executed);
    expect(executed).toHaveLength(1);
    expect([a, b].filter((o) => !o.executed && (o as { reason?: string }).reason === 'already_executed')).toHaveLength(1);
    // Só o vencedor executou: 1 runAction, 1 readBack, 1 verify. O perdedor
    // dispensou na claim, sem tocar execução nem verificação.
    expect(runs).toBe(1);
    expect(readBacks).toBe(1);
    expect(verifies).toBe(1);
  });

  it('claim fresca bloqueia sem executar; claim stale (>10min) permite reclaim', async () => {
    // Reserva fresca de outro candidato ⇒ dispensa sem executar/verificar.
    const storeFresh = memoryStore();
    seedObserved(storeFresh, 'evt-claim-fresh');
    storeFresh.runs.set(`${CLINIC_A}:evt-claim-fresh`, {
      clinicId: CLINIC_A,
      status: 'observed',
      result: {
        next_step: 'Observar X.',
        policy_decision: autoDecision(),
        execution_claim: { by: 'outro-candidato', at: new Date().toISOString() },
      },
    });
    let freshRuns = 0;
    let freshReadBacks = 0;
    const fresh = await executeDecidedRun(
      {
        clinicId: CLINIC_A,
        eventId: 'evt-claim-fresh',
        decision: autoDecision(),
        input: { id: PATIENT_ID },
        actionCtx: actionCtx(),
      },
      {
        readMode: () => 'auto_limitado',
        loadRun: storeFresh.loadRun,
        saveExecution: storeFresh.saveExecution,
        claimExecution: storeFresh.claimExecution,
        runAction: async () => { freshRuns += 1; return { ok: true, data: { id: PATIENT_ID } }; },
        readBack: async () => { freshReadBacks += 1; return { id: PATIENT_ID }; },
      },
    );
    expect(fresh).toMatchObject({ executed: false, reason: 'already_executed' });
    expect(freshRuns).toBe(0);
    expect(freshReadBacks).toBe(0);
    expect(storeFresh.writes).toBe(0);

    // Reserva stale (crash órfão) ⇒ reclaim executa e verifica normalmente;
    // a reconciliação cabe ao verifier (pós-condição lida do backend).
    const storeStale = memoryStore();
    seedObserved(storeStale, 'evt-claim-stale');
    storeStale.runs.set(`${CLINIC_A}:evt-claim-stale`, {
      clinicId: CLINIC_A,
      status: 'observed',
      result: {
        next_step: 'Observar X.',
        policy_decision: autoDecision(),
        execution_claim: {
          by: 'candidato-morto',
          at: new Date(Date.now() - EXECUTION_CLAIM_STALE_MS - 60_000).toISOString(),
        },
      },
    });
    const stale = await executeDecidedRun(
      {
        clinicId: CLINIC_A,
        eventId: 'evt-claim-stale',
        decision: autoDecision(),
        input: { id: PATIENT_ID },
        actionCtx: actionCtx(),
      },
      {
        readMode: () => 'auto_limitado',
        loadRun: storeStale.loadRun,
        saveExecution: storeStale.saveExecution,
        claimExecution: storeStale.claimExecution,
        runAction: async () => ({ ok: true, data: { id: PATIENT_ID } }),
        readBack: async () => ({ id: PATIENT_ID }),
      },
    );
    expect(stale.executed).toBe(true);
    expect(storeStale.claims).toBe(1);
    expect(storeStale.writes).toBe(1);
  });

  it('isExecutionClaimStale: janela de 10min, fail-closed sem `at` válido', () => {
    const now = Date.now();
    expect(isExecutionClaimStale(new Date(now).toISOString(), now)).toBe(false);
    expect(isExecutionClaimStale(new Date(now - EXECUTION_CLAIM_STALE_MS - 1).toISOString(), now)).toBe(true);
    expect(isExecutionClaimStale(new Date(now - EXECUTION_CLAIM_STALE_MS + 60_000).toISOString(), now)).toBe(false);
    expect(isExecutionClaimStale(undefined, now)).toBe(false);
    expect(isExecutionClaimStale(null, now)).toBe(false);
    expect(isExecutionClaimStale('não-é-data', now)).toBe(false);
    expect(getExecutionClaim({ execution_claim: { by: 'x', at: 'y' } })).toEqual({ by: 'x', at: 'y' });
    expect(getExecutionClaim({ execution_claim: { by: 'x' } })).toBeNull();
    expect(getExecutionClaim({})).toBeNull();
  });
});

describe('verificação determinística pós-execução', () => {
  function baseParams(eventId: string) {
    return {
      clinicId: CLINIC_A,
      eventId,
      decision: autoDecision(),
      input: { id: PATIENT_ID },
      actionCtx: actionCtx(),
    };
  }

  it('verifier ok (pós-condição lida do backend) ⇒ business_success com evidência e duração', async () => {
    const store = memoryStore();
    seedObserved(store, 'evt-ok');
    let verifyCalls = 0;
    const out = await executeDecidedRun(baseParams('evt-ok'), {
      readMode: () => 'auto_limitado',
      loadRun: store.loadRun,
      saveExecution: store.saveExecution,
      claimExecution: store.claimExecution,
      runAction: async () => ({ ok: true, data: { id: PATIENT_ID, name: 'Qualquer Nome (ignorado)' } }),
      readBack: async () => ({ id: PATIENT_ID }),
      verify: (a, i, rb) => { verifyCalls += 1; expect(a).toBe(ACTION_ID); return verifyObterPaciente((i as { id: string }).id, rb); },
    });
    expect(verifyCalls).toBe(1);
    expect(out.executed).toBe(true);
    if (!out.executed) throw new Error('expected execution');
    expect(out.outcome.status).toBe('business_success');
    expect(out.outcome.evidence).toMatchObject({ reason: 'postcondition_verified', verification: 'ok' });
    expect(out.outcome.duration_ms).toBeGreaterThanOrEqual(0);
    expect(out.receipt.action_id).toBe(ACTION_ID);
    expect(out.receipt.policy_version).toBe(AI_CONTROL_POLICY_VERSION);
    expect(out.receipt.exec_policy_version).toBe(AI_CONTROL_EXEC_POLICY_VERSION);
    expect(out.receipt.attempt_id).toBeNull();
    expect(out.receipt.idempotency_key).toContain(CLINIC_A);
    // Outcome + receipt persistidos juntos no result (sem migration).
    const saved = store.runs.get(`${CLINIC_A}:evt-ok`)?.result as Record<string, unknown>;
    expect(saved.execution_receipt).toEqual(out.receipt);
    expect(saved.execution_outcome).toEqual(out.outcome);
    expect((saved.execution_outcome as ExecutionOutcome).status).toBe('business_success');
  });

  it('retorno ok NÃO basta: pós-condição divergente ⇒ failed', async () => {
    const store = memoryStore();
    seedObserved(store, 'evt-mismatch');
    const out = await executeDecidedRun(baseParams('evt-mismatch'), {
      readMode: () => 'auto_limitado',
      loadRun: store.loadRun,
      saveExecution: store.saveExecution,
      claimExecution: store.claimExecution,
      runAction: async () => ({ ok: true, data: { id: PATIENT_ID } }),
      readBack: async () => ({ id: 'outro-id' }),
    });
    expect(out.executed).toBe(true);
    if (!out.executed) throw new Error('expected execution');
    expect(out.outcome.status).toBe('failed');
    expect(out.outcome.evidence).toMatchObject({ reason: 'postcondition_mismatch', verification: 'failed' });
  });

  it('leitura de verificação indisponível (null/throw) ⇒ suspended, SEM marcar sucesso', async () => {
    for (const [label, readBack] of [
      ['null', async () => null],
      ['throw', async () => { throw new Error('db down'); }],
    ] as const) {
      const store = memoryStore();
      seedObserved(store, `evt-unavail-${label}`);
      let runs = 0;
      const out = await executeDecidedRun(baseParams(`evt-unavail-${label}`), {
        readMode: () => 'auto_limitado',
        loadRun: store.loadRun,
        saveExecution: store.saveExecution,
        claimExecution: store.claimExecution,
        runAction: async () => { runs += 1; return { ok: true, data: { id: PATIENT_ID } }; },
        readBack,
      });
      expect(out.executed).toBe(true);
      if (!out.executed) throw new Error('expected execution');
      expect(out.outcome.status).toBe('suspended');
      expect(out.outcome.evidence).toMatchObject({ verification: 'unknown', reconciliation: 'manual' });
      expect(runs).toBe(1);
    }
  });

  it('unknown_effect ⇒ suspended + reconciliação manual, SEM retry cego, SEM sucesso', async () => {
    const store = memoryStore();
    seedObserved(store, 'evt-unknown');
    let runs = 0;
    let readBacks = 0;
    const out = await executeDecidedRun(baseParams('evt-unknown'), {
      readMode: () => 'auto_limitado',
      loadRun: store.loadRun,
      saveExecution: store.saveExecution,
      claimExecution: store.claimExecution,
      runAction: async () => { runs += 1; return { ok: false, errorCode: 'unknown_effect', attemptId: 'attempt-123' }; },
      readBack: async () => { readBacks += 1; return { id: PATIENT_ID }; },
    });
    expect(runs).toBe(1);
    expect(readBacks).toBe(0);
    expect(out.executed).toBe(true);
    if (!out.executed) throw new Error('expected execution');
    expect(out.outcome.status).toBe('suspended');
    expect(out.outcome.evidence).toMatchObject({ reason: 'unknown_effect', attempt_id: 'attempt-123', reconciliation: 'manual' });
    // Correlação run→attempt no receipt.
    expect(out.receipt.attempt_id).toBe('attempt-123');
  });

  it('falha de execução comum ⇒ failed com error_code (sem suspensão)', async () => {
    const store = memoryStore();
    seedObserved(store, 'evt-err');
    const out = await executeDecidedRun(baseParams('evt-err'), {
      readMode: () => 'auto_limitado',
      loadRun: store.loadRun,
      saveExecution: store.saveExecution,
      claimExecution: store.claimExecution,
      runAction: async () => ({ ok: false, errorCode: 'not_found', attemptId: null }),
      readBack: async () => ({ id: PATIENT_ID }),
    });
    expect(out.executed).toBe(true);
    if (!out.executed) throw new Error('expected execution');
    expect(out.outcome.status).toBe('failed');
    expect(out.outcome.evidence).toMatchObject({ reason: 'execution_failed', error_code: 'not_found' });
  });

  it('verifyObterPaciente é puro: ok / failed / unknown', () => {
    expect(verifyObterPaciente(PATIENT_ID, { id: PATIENT_ID })).toBe('ok');
    expect(verifyObterPaciente(PATIENT_ID, { id: 'outro' })).toBe('failed');
    expect(verifyObterPaciente(PATIENT_ID, null)).toBe('unknown');
    expect(verifyObterPaciente(PATIENT_ID, undefined)).toBe('unknown');
    expect(verifyObterPaciente(PATIENT_ID, 'string')).toBe('failed');
    expect(verifyObterPaciente('', { id: '' })).toBe('failed');
    // Determinístico.
    expect(verifyObterPaciente(PATIENT_ID, { id: PATIENT_ID }))
      .toBe(verifyObterPaciente(PATIENT_ID, { id: PATIENT_ID }));
  });

  it('negativo tenant: run de B nunca executa pela clínica A', async () => {
    const store = memoryStore();
    seedObserved(store, 'evt-1', CLINIC_B);
    let runs = 0;
    const out = await executeDecidedRun(
      { clinicId: CLINIC_A, eventId: 'evt-1', decision: autoDecision(), input: { id: PATIENT_ID }, actionCtx: actionCtx() },
      {
        readMode: () => 'auto_limitado',
        loadRun: store.loadRun,
        saveExecution: store.saveExecution,
        claimExecution: store.claimExecution,
        runAction: async () => { runs += 1; return { ok: true, data: {} }; },
      },
    );
    expect(out).toMatchObject({ executed: false, reason: 'run_missing' });
    expect(runs).toBe(0);
    expect(store.writes).toBe(0);
  });

  it('shouldPersistExecution + merge preservam o next_step e a decisão S2', () => {
    expect(shouldPersistExecution(null, CLINIC_A)).toEqual({ persist: false, reason: 'run_missing' });
    expect(shouldPersistExecution({ clinicId: CLINIC_B, status: 'observed', result: {} }, CLINIC_A))
      .toEqual({ persist: false, reason: 'tenant_mismatch' });
    expect(shouldPersistExecution(
      { clinicId: CLINIC_A, status: 'observed', result: { execution_receipt: { a: 1 } } }, CLINIC_A,
    )).toEqual({ persist: false, reason: 'already_executed' });
    expect(hasExecutionReceipt({ next_step: 'x' })).toBe(false);
    expect(getExecutionReceipt({ next_step: 'x' })).toBeNull();
    const receipt = {
      idempotency_key: 'k', action_id: ACTION_ID, policy_version: AI_CONTROL_POLICY_VERSION,
      exec_policy_version: AI_CONTROL_EXEC_POLICY_VERSION, attempt_id: null,
      executed_at: new Date(0).toISOString(), duration_ms: 1,
    } as const;
    const outcome = { status: 'business_success' as const, evidence: {}, duration_ms: 1 };
    const merged = mergeExecutionRecord({ next_step: 'x', policy_decision: { a: 1 } }, receipt, outcome);
    expect(merged.next_step).toBe('x');
    expect(merged.policy_decision).toEqual({ a: 1 });
    expect(hasExecutionReceipt(merged)).toBe(true);
  });

  it('receipt grava executed_at imutável do relógio injetável (default Date.now)', async () => {
    const FIXED = Date.parse('2026-10-01T10:00:00.000Z');
    const store = memoryStore();
    seedObserved(store, 'evt-anchor');
    const out = await executeDecidedRun(
      {
        clinicId: CLINIC_A,
        eventId: 'evt-anchor',
        decision: autoDecision(),
        input: { id: PATIENT_ID },
        actionCtx: actionCtx(),
      },
      {
        readMode: () => 'auto_limitado',
        loadRun: store.loadRun,
        saveExecution: store.saveExecution,
        claimExecution: store.claimExecution,
        runAction: async () => ({ ok: true, data: { id: PATIENT_ID } }),
        readBack: async () => ({ id: PATIENT_ID }),
        now: () => FIXED,
      },
    );
    expect(out.executed).toBe(true);
    if (!out.executed) throw new Error('expected execution');
    // Âncora imutável: ISO do relógio injetável, congelada no receipt.
    expect(out.receipt.executed_at).toBe(new Date(FIXED).toISOString());
    expect(out.receipt.duration_ms).toBe(0);
    const saved = store.runs.get(`${CLINIC_A}:evt-anchor`)?.result as Record<string, unknown>;
    expect((saved.execution_receipt as ExecutionReceipt).executed_at).toBe(
      new Date(FIXED).toISOString(),
    );
  });
});

describe('S3 estático: sem efeitos reais, sem LLM/RAG/envio; enqueue nunca é delivered', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'ai-control-executor.ts'),
    'utf8',
  );

  it.each([
    ['LLM', /from\s+['"]@\/lib\/llm\//],
    ['provider IA vivo', /provider-zen|openai|minimax|openrouter/i],
    ['RAG', /searchKnowledge|ragService/i],
    ['envio WhatsApp/Evolution', /evolution|sendByChannel|send-message-service/i],
    ['gateway de pagamento', /dispatch-charge-job|payment-gateway/i],
    ['mutação de domínio', /updateLead|createAppointment|dispatchCharge|insertPatient|upsertLead/i],
    ['fetch externo', /fetch\s*\(/],
    // Enqueue significa aguardando, nunca entregue: nenhuma chamada de
    // liquidação/entrega do outbox neste módulo (só menção em comentário).
    ['liquidação/entrega do outbox', /settleOutbox|markDelivered|markAsDelivered|liquidar/i],
  ])('módulo não importa %s', (_label, pattern) => {
    expect(source).not.toMatch(pattern);
  });

  it('execução real só via seam injetável (runAction default atrás do gate)', () => {
    expect(source).toMatch(/runAction\?:/);
    expect(source).toMatch(/deps\.runAction/);
  });

  it('persistência usa UPDATE condicional com predicado de ausência (idempotente, sem DDL)', () => {
    expect(source).toMatch(/execution_receipt.*IS NULL/);
    expect(source).not.toMatch(/CREATE TABLE|createTable|drizzle\(\s*['"]migrate|migrate\(\s*getDb/i);
  });
});
