/**
 * P4 Slice 2 — policy hookup: decisão determinística + persistência idempotente.
 *
 * Unit puro (sem DB): matriz AUTO/CONFIRM/APPROVAL/DENY, DENY absoluto
 * `deny_non_human` (nunca elevado), determinismo (2× mesmo input),
 * action_id só do catálogo, replay idempotente (0 writes), negativo de
 * tenant e garantias estáticas (nenhuma execução de Action neste slice).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AI_CONTROL_POLICY_VERSION,
  evaluateProposalPolicy,
  hasPolicyDecision,
  mergePolicyDecision,
  persistPolicyDecision,
  shouldPersistPolicyDecision,
  type PolicyCatalogEntry,
  type PolicyDecisionStore,
  type ProposalPolicyContext,
} from '../ai-control-policy';

const CLINIC_A = '11111111-1111-4111-8111-111111111111';
const CLINIC_B = '22222222-2222-4222-8222-222222222222';

const CATALOG: Record<string, PolicyCatalogEntry> = {
  'operacional.listarConsultas': {
    name: 'operacional.listarConsultas',
    module: 'operacional',
    requires: 'operacional:view_appointments',
  },
  'operacional.agendarConsulta': {
    name: 'operacional.agendarConsulta',
    module: 'operacional',
    requires: 'operacional:manage_appointments',
    riskClass: 'standard',
    consequential: true,
  },
  'financeiro.registrarPagamento': {
    name: 'financeiro.registrarPagamento',
    module: 'financeiro',
    requires: 'financeiro:manage_payments',
    riskClass: 'approval',
  },
  'atendimento.enviarMensagemDireta': {
    name: 'atendimento.enviarMensagemDireta',
    module: 'atendimento',
    requires: 'atendimento:manage_messages',
    riskClass: 'deny_non_human',
    consequential: true,
  },
  'weird.risk': {
    name: 'weird.risk',
    module: 'operacional',
    requires: 'operacional:view_appointments',
    riskClass: 'yolo',
  },
};

const lookup = (name: string) => CATALOG[name] ?? null;

function ctx(overrides: Partial<ProposalPolicyContext> = {}): ProposalPolicyContext {
  return {
    mode: 'observe',
    can: () => true,
    hasModule: () => true,
    ...overrides,
  };
}

/** Store em memória tenant-scoped (chave `clinicId:eventId`), com writes contados. */
function memoryStore(): PolicyDecisionStore & {
  runs: Map<string, { clinicId: string; status: string; result: unknown }>;
  writes: number;
} {
  const runs = new Map<string, { clinicId: string; status: string; result: unknown }>();
  const store = {
    runs,
    writes: 0,
    loadRun: async (clinicId: string, eventId: string) => runs.get(`${clinicId}:${eventId}`) ?? null,
    saveDecision: async (clinicId: string, eventId: string, nextResult: Record<string, unknown>) => {
      const key = `${clinicId}:${eventId}`;
      const run = runs.get(key);
      if (!run || run.status !== 'observed') return 0;
      (store as { writes: number }).writes += 1;
      runs.set(key, { ...run, result: nextResult });
      return 1;
    },
  };
  return store;
}

describe('evaluateProposalPolicy — matriz de decisão', () => {
  it('standard não-consequencial com RBAC+módulo ⇒ AUTO', () => {
    const d = evaluateProposalPolicy(
      { next_step: 'Observar X.', action: 'operacional.listarConsultas' },
      ctx(),
      { lookup },
    );
    expect(d).toEqual({
      decision: 'AUTO',
      riskClass: 'standard',
      reason: 'auto_standard',
      policy_version: AI_CONTROL_POLICY_VERSION,
      action_id: 'operacional.listarConsultas',
    });
  });

  it('standard consequencial ⇒ CONFIRM', () => {
    const d = evaluateProposalPolicy(
      { next_step: 'Agendar Y.', action: 'operacional.agendarConsulta' },
      ctx(),
      { lookup },
    );
    expect(d.decision).toBe('CONFIRM');
    expect(d.reason).toBe('confirm_consequential');
    expect(d.action_id).toBe('operacional.agendarConsulta');
    expect(d.policy_version).toBe(AI_CONTROL_POLICY_VERSION);
  });

  it('classe approval com RBAC+módulo ⇒ APPROVAL', () => {
    const d = evaluateProposalPolicy(
      { next_step: 'Registrar pagamento.', action: 'financeiro.registrarPagamento' },
      ctx(),
      { lookup },
    );
    expect(d.decision).toBe('APPROVAL');
    expect(d.reason).toBe('approval_required');
    expect(d.action_id).toBe('financeiro.registrarPagamento');
  });

  it('sem action correspondente ⇒ DENY com reason e action_id nulo', () => {
    for (const proposal of [
      { next_step: 'Observar X.' },
      { next_step: 'Observar X.', action: '' },
      { next_step: 'Observar X.', action: 'nao.existe' },
    ]) {
      const d = evaluateProposalPolicy(proposal, ctx(), { lookup });
      expect(d.decision).toBe('DENY');
      expect(d.action_id).toBeNull();
    }
    expect(evaluateProposalPolicy({ next_step: 'Observar X.' }, ctx(), { lookup }).reason)
      .toBe('no_action_proposed');
    expect(evaluateProposalPolicy(
      { next_step: 'Observar X.', action: 'nao.existe' }, ctx(), { lookup },
    ).reason).toBe('unknown_action');
  });

  it('classe de risco desconhecida ⇒ DENY (action_id vinculado ao catálogo)', () => {
    const d = evaluateProposalPolicy(
      { next_step: 'Observar X.', action: 'weird.risk' },
      ctx(),
      { lookup },
    );
    expect(d.decision).toBe('DENY');
    expect(d.reason).toBe('unknown_risk_class');
    expect(d.action_id).toBe('weird.risk');
    expect(d.riskClass).toBe('yolo');
  });

  it('sem RBAC ou sem módulo ⇒ DENY', () => {
    expect(evaluateProposalPolicy(
      { next_step: 'Observar X.', action: 'operacional.listarConsultas' },
      ctx({ can: () => false }),
      { lookup },
    )).toMatchObject({ decision: 'DENY', reason: 'forbidden' });
    expect(evaluateProposalPolicy(
      { next_step: 'Observar X.', action: 'operacional.listarConsultas' },
      ctx({ hasModule: () => false }),
      { lookup },
    )).toMatchObject({ decision: 'DENY', reason: 'module_disabled' });
  });

  it('contexto ausente/malformado ⇒ DENY (fail-closed)', () => {
    for (const bad of [null, undefined, {}, { mode: 'observe' }]) {
      expect(evaluateProposalPolicy(
        { next_step: 'Observar X.', action: 'operacional.listarConsultas' },
        bad as unknown as ProposalPolicyContext,
        { lookup },
      )).toMatchObject({ decision: 'DENY', reason: 'missing_policy_context' });
    }
  });

  it('modo ≠ observe ⇒ DENY', () => {
    expect(evaluateProposalPolicy(
      { next_step: 'Observar X.', action: 'operacional.listarConsultas' },
      ctx({ mode: 'act' }),
      { lookup },
    )).toMatchObject({ decision: 'DENY', reason: 'mode_not_observe' });
  });

  it('proposta inválida ⇒ DENY sem action_id', () => {
    for (const bad of [null, undefined, {}, { next_step: '' }, { next_step: 42 }]) {
      expect(evaluateProposalPolicy(
        bad as never, ctx(), { lookup },
      )).toMatchObject({ decision: 'DENY', reason: 'invalid_proposal', action_id: null });
    }
  });
});

describe('evaluateProposalPolicy — DENY absoluto deny_non_human', () => {
  it('nega mesmo com RBAC+módulo totais (nunca elevado por token — sem param de token)', () => {
    const d = evaluateProposalPolicy(
      { next_step: 'Enviar mensagem.', action: 'atendimento.enviarMensagemDireta' },
      ctx(),
      { lookup },
    );
    expect(d).toMatchObject({
      decision: 'DENY',
      riskClass: 'deny_non_human',
      reason: 'deny_non_human_absolute',
      action_id: 'atendimento.enviarMensagemDireta',
    });
  });

  it('nega antes de RBAC/módulo (absoluto precede gates)', () => {
    const d = evaluateProposalPolicy(
      { next_step: 'Enviar mensagem.', action: 'atendimento.enviarMensagemDireta' },
      ctx({ can: () => false, hasModule: () => false }),
      { lookup },
    );
    expect(d.decision).toBe('DENY');
    expect(d.reason).toBe('deny_non_human_absolute');
  });
});

describe('evaluateProposalPolicy — determinismo e versionamento', () => {
  it('2× mesmo input ⇒ mesma decisão (deep-equal)', () => {
    const proposal = { next_step: 'Agendar Y.', action: 'operacional.agendarConsulta' };
    const c = ctx();
    const first = evaluateProposalPolicy(proposal, c, { lookup });
    const second = evaluateProposalPolicy({ ...proposal }, ctx(), { lookup });
    expect(second).toEqual(first);
  });

  it('toda decisão carrega policy_version constante', () => {
    expect(AI_CONTROL_POLICY_VERSION).toBe('p4-s2-policy-v1');
    const decisions = [
      evaluateProposalPolicy({ next_step: 'A.', action: 'operacional.listarConsultas' }, ctx(), { lookup }),
      evaluateProposalPolicy({ next_step: 'A.', action: 'operacional.agendarConsulta' }, ctx(), { lookup }),
      evaluateProposalPolicy({ next_step: 'A.', action: 'financeiro.registrarPagamento' }, ctx(), { lookup }),
      evaluateProposalPolicy({ next_step: 'A.', action: 'atendimento.enviarMensagemDireta' }, ctx(), { lookup }),
      evaluateProposalPolicy({ next_step: 'A.', action: 'nao.existe' }, ctx(), { lookup }),
    ];
    for (const d of decisions) expect(d.policy_version).toBe('p4-s2-policy-v1');
  });
});

describe('persistPolicyDecision — UPDATE idempotente em result.policy_decision', () => {
  function decidedRun() {
    return {
      decision: 'AUTO' as const,
      riskClass: 'standard',
      reason: 'auto_standard',
      policy_version: AI_CONTROL_POLICY_VERSION,
      action_id: 'operacional.listarConsultas',
    };
  }

  it('persiste a decisão mesclando com o next_step existente', async () => {
    const store = memoryStore();
    store.runs.set(`${CLINIC_A}:evt-1`, {
      clinicId: CLINIC_A,
      status: 'observed',
      result: { next_step: 'Observar X.' },
    });
    const out = await persistPolicyDecision(
      { clinicId: CLINIC_A, eventId: 'evt-1', decision: decidedRun() },
      store,
    );
    expect(out).toEqual({ updated: true, reason: 'ok' });
    const saved = store.runs.get(`${CLINIC_A}:evt-1`)?.result as Record<string, unknown>;
    expect(saved.next_step).toBe('Observar X.');
    expect(saved.policy_decision).toEqual(decidedRun());
  });

  it('replay não duplica: segunda chamada não escreve (already_decided)', async () => {
    const store = memoryStore();
    store.runs.set(`${CLINIC_A}:evt-1`, {
      clinicId: CLINIC_A,
      status: 'observed',
      result: { next_step: 'Observar X.' },
    });
    const params = { clinicId: CLINIC_A, eventId: 'evt-1', decision: decidedRun() };
    expect(await persistPolicyDecision(params, store)).toMatchObject({ updated: true });
    expect(store.writes).toBe(1);
    expect(await persistPolicyDecision(params, store))
      .toEqual({ updated: false, reason: 'already_decided' });
    expect(await persistPolicyDecision({ ...params }, store))
      .toEqual({ updated: false, reason: 'already_decided' });
    expect(store.writes).toBe(1);
  });

  it('só persiste quando status observed (queued/failed ⇒ skip sem escrita)', async () => {
    const store = memoryStore();
    for (const status of ['queued', 'failed']) {
      store.runs.set(`${CLINIC_A}:evt-${status}`, {
        clinicId: CLINIC_A,
        status,
        result: { next_step: 'Observar X.' },
      });
      expect(await persistPolicyDecision(
        { clinicId: CLINIC_A, eventId: `evt-${status}`, decision: decidedRun() },
        store,
      )).toEqual({ updated: false, reason: 'status_not_observed' });
    }
    expect(store.writes).toBe(0);
  });

  it('negativo tenant: run de B nunca é decidida pela clínica A (nem lida cross-tenant)', async () => {
    const store = memoryStore();
    store.runs.set(`${CLINIC_B}:evt-1`, {
      clinicId: CLINIC_B,
      status: 'observed',
      result: { next_step: 'Observar X.' },
    });
    const out = await persistPolicyDecision(
      { clinicId: CLINIC_A, eventId: 'evt-1', decision: decidedRun() },
      store,
    );
    expect(out).toEqual({ updated: false, reason: 'run_missing' });
    expect(store.writes).toBe(0);
    // A run de B segue intacta (sem policy_decision).
    expect(hasPolicyDecision(store.runs.get(`${CLINIC_B}:evt-1`)?.result)).toBe(false);
  });

  it('shouldPersistPolicyDecision cerca tenant/status/decisão (pura)', () => {
    expect(shouldPersistPolicyDecision(null, CLINIC_A))
      .toEqual({ persist: false, reason: 'run_missing' });
    expect(shouldPersistPolicyDecision(
      { clinicId: CLINIC_B, status: 'observed', result: {} }, CLINIC_A,
    )).toEqual({ persist: false, reason: 'tenant_mismatch' });
    expect(shouldPersistPolicyDecision(
      { clinicId: CLINIC_A, status: 'queued', result: {} }, CLINIC_A,
    )).toEqual({ persist: false, reason: 'status_not_observed' });
    expect(shouldPersistPolicyDecision(
      { clinicId: CLINIC_A, status: 'observed', result: { policy_decision: { decision: 'AUTO' } } },
      CLINIC_A,
    )).toEqual({ persist: false, reason: 'already_decided' });
    expect(shouldPersistPolicyDecision(
      { clinicId: CLINIC_A, status: 'observed', result: { next_step: 'x' } }, CLINIC_A,
    )).toEqual({ persist: true, reason: 'ok' });
  });

  it('mergePolicyDecision nunca destrói o next_step e hasPolicyDecision cerca nulos', () => {
    expect(hasPolicyDecision(null)).toBe(false);
    expect(hasPolicyDecision({ next_step: 'x' })).toBe(false);
    const merged = mergePolicyDecision({ next_step: 'x' }, decidedRun());
    expect(merged.next_step).toBe('x');
    expect(hasPolicyDecision(merged)).toBe(true);
  });
});

describe('S2 estático: NENHUMA execução de Action neste slice', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'ai-control-policy.ts'),
    'utf8',
  );

  it.each([
    ['runAction', /runAction/],
    ['executores/handlers de domínio', /execute[A-Z]\w*\(|action\.handler|\.handler\s*\(/],
    ['fetch externo', /fetch\s*\(/],
    ['LLM', /from\s+['"]@\/lib\/llm\//],
    ['provider IA vivo', /provider-zen|openai|minimax|openrouter/i],
    ['envio WhatsApp/Evolution', /evolution|sendByChannel|send-message-service/i],
    ['gateway de pagamento', /dispatch-charge-job|payment-gateway/i],
    ['mutação de domínio', /updateLead|createAppointment|dispatchCharge|insertPatient|upsertLead/i],
  ])('módulo não importa %s', (_label, pattern) => {
    expect(source).not.toMatch(pattern);
  });

  it('lookup default usa SOMENTE o registry do catálogo (sem string livre)', () => {
    expect(source).toMatch(/getAction/);
    expect(source).toMatch(/action_id.*catálogo|nunca.*string livre/i);
  });

  it('persistência usa UPDATE condicional em observed (idempotente)', () => {
    expect(source).toMatch(/eq\(agentRuns\.status,\s*'observed'\)/);
  });
});
