/**
 * P4 Slice 1B — preparo OBSERVÁVEL: contexto + RAG + proposta, sem LLM/execução.
 *
 * Unit puro (sem DB): envelope + tenant, RAG com o tenant do job, fontes
 * rastreáveis, saída inválida que nunca vira plano, gate OFF, replay
 * idempotente, negativo A×B e garantias estáticas (zero LLM/mutação/envio).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isPermanentOutboxError } from '@/lib/outbox/errors';
import { OUTBOX_OPERATIONS, buildAiControlPrepareBusinessKey } from '@/lib/outbox/operations';
import type { OutboxJob } from '@/lib/outbox/outbox-repository';
import {
  AI_CONTROL_PREPARE_EVENT_MISSING_CODE,
  AI_CONTROL_PREPARE_MODE_OFF_CODE,
  AI_CONTROL_PREPARE_OUTPUT_INVALID_CODE,
  dispatchAiControlPrepareJob,
  InvalidAiControlPrepareError,
  parseAiControlPreparePayload,
  parseAiControlProposal,
} from '../dispatch-ai-control-prepare';

const CLINIC_A = '11111111-1111-4111-8111-111111111111';
const CLINIC_B = '22222222-2222-4222-8222-222222222222';

function preparePayload(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'evt-001',
    clinicId: CLINIC_A,
    version: 1,
    ...overrides,
  };
}

function job(clinicId: string, payload: unknown, operation: string = OUTBOX_OPERATIONS.AI_CONTROL_PREPARE): OutboxJob {
  return { clinicId, operation, payload } as OutboxJob;
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    clinicId: CLINIC_A,
    eventId: 'evt-001',
    type: 'lead.created',
    version: 1,
    occurredAt: new Date('2026-10-13T12:00:00.000Z'),
    subjectType: 'lead',
    subjectId: 'lead-123',
    payload: { phone: '11999990001', conversationId: 'conv-1' },
    createdAt: new Date('2026-10-13T12:00:00.000Z'),
    ...overrides,
  } as any;
}

/** Fake tx que captura UPDATEs com semântica condicional (`queued` → novo status). */
function statefulTx() {
  const run: Record<string, unknown> = {
    status: 'queued',
    result: null,
    sources: null,
    errorCode: null,
  };
  const calls: Array<{ values: Record<string, unknown>; matched: number }> = [];
  const tx = {
    run,
    calls,
    update(_table: unknown) {
      return {
        set: (values: Record<string, unknown>) => ({
          where: async (..._args: unknown[]) => {
            if (run.status === 'queued') {
              Object.assign(run, values);
              calls.push({ values, matched: 1 });
              return [{ id: 'run-1' }];
            }
            calls.push({ values, matched: 0 });
            return [];
          },
        }),
      };
    },
  };
  return tx;
}

function baseDeps(overrides: Record<string, unknown> = {}) {
  const searchCalls: Array<{ clinicId: string; query: string }> = [];
  const searchFn = jest.fn(async (clinicId: string, query: string): Promise<unknown> => {
    searchCalls.push({ clinicId, query });
    return [{ id: 'k1', question: 'Como remarcar?', category: 'agendamento', answer: 'Pelo app.', relevance: 0.9 }];
  });
  return {
    searchCalls,
    searchFn,
    deps: {
      searchFn,
      loadEvent: jest.fn(async () => eventRow()),
      loadInterlocutorContext: jest.fn(async () => 'Paciente: Ana'),
      loadConversationContext: jest.fn(async () => [
        { role: 'user', content: 'quero remarcar', intent: null },
      ]),
      readMode: () => 'observe',
      ...(overrides as object),
    } as any,
  };
}

describe('parseAiControlPreparePayload', () => {
  it('aceita envelope válido', () => {
    expect(parseAiControlPreparePayload(job(CLINIC_A, preparePayload()))).toEqual({
      eventId: 'evt-001',
      clinicId: CLINIC_A,
      version: 1,
    });
  });

  it.each([
    ['operação desconhecida', job(CLINIC_A, preparePayload(), 'crm.contact.changed')],
    ['eventId ausente', job(CLINIC_A, preparePayload({ eventId: '' }))],
    ['clinicId ausente', job(CLINIC_A, preparePayload({ clinicId: '' }))],
    ['versão divergente', job(CLINIC_A, preparePayload({ version: 999 }))],
  ])('rejeita %s como permanente (DLQ, sem retry)', (_label, j) => {
    expect(() => parseAiControlPreparePayload(j)).toThrow(InvalidAiControlPrepareError);
    try {
      parseAiControlPreparePayload(j);
    } catch (err) {
      expect(isPermanentOutboxError(err)).toBe(true);
    }
  });

  it.each([
    ['payload null', null],
    ['payload array', [{ eventId: 'evt-001' }]],
  ])('%s é permanente (DLQ imediata)', (_label, payload) => {
    expect(() => parseAiControlPreparePayload(job(CLINIC_A, payload))).toThrow(InvalidAiControlPrepareError);
  });

  it('tenant descasado (payload B em job A) é permanente, nunca leitura cross-tenant', () => {
    const j = job(CLINIC_A, preparePayload({ clinicId: CLINIC_B }));
    expect(() => parseAiControlPreparePayload(j)).toThrow(InvalidAiControlPrepareError);
    try {
      parseAiControlPreparePayload(j);
    } catch (err) {
      expect(isPermanentOutboxError(err)).toBe(true);
    }
  });
});

describe('buildAiControlPrepareBusinessKey', () => {
  it('é determinística: JSON da tupla ["prepare", clinicId, eventId]', () => {
    expect(buildAiControlPrepareBusinessKey(CLINIC_A, 'evt-001')).toBe(
      `["prepare","${CLINIC_A}","evt-001"]`,
    );
  });

  it('eventos distintos geram chaves distintas (sem colisão lógica)', () => {
    expect(buildAiControlPrepareBusinessKey(CLINIC_A, 'e1')).not.toBe(
      buildAiControlPrepareBusinessKey(CLINIC_A, 'e2'),
    );
  });
});

describe('dispatchAiControlPrepareJob (consumidor 1B)', () => {
  it('RAG recebe o tenant do JOB e a proposta materializa fontes rastreáveis', async () => {
    const { deps, searchFn, searchCalls } = baseDeps();
    const hook = await dispatchAiControlPrepareJob(job(CLINIC_A, preparePayload()), deps);
    const tx = statefulTx();
    await (hook as (t: unknown) => Promise<void>)(tx);
    // RAG com o tenant do job (cerco: nunca tenant de outro).
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(searchCalls[0]?.clinicId).toBe(CLINIC_A);
    // Run promovida com proposta válida + fontes rastreáveis.
    expect(tx.run.status).toBe('observed');
    expect(tx.run.errorCode).toBeNull();
    const result = tx.run.result as { next_step: string };
    expect(typeof result.next_step).toBe('string');
    expect(result.next_step.length).toBeGreaterThan(0);
    expect(tx.run.sources).toEqual([{ id: 'k1', title: 'Como remarcar?' }]);
  });

  it('query RAG carrega só o nome como PII (sem telefone, sem IDs, sem conteúdo)', async () => {
    const { deps, searchCalls } = baseDeps();
    const hook = await dispatchAiControlPrepareJob(job(CLINIC_A, preparePayload()), deps);
    await (hook as (t: unknown) => Promise<void>)(statefulTx());
    const query = searchCalls[0]?.query ?? '';
    expect(query).toContain('Ana');
    expect(query).not.toContain('11999990001');
    expect(query).not.toContain('conv-1');
    expect(query).not.toContain('lead-123');
  });

  it('contexto de conversa é carregado tenant-scoped (não vaza para o RAG)', async () => {
    const { deps } = baseDeps();
    const loadConversationContext = deps.loadConversationContext as jest.Mock;
    const hook = await dispatchAiControlPrepareJob(job(CLINIC_A, preparePayload()), deps);
    await (hook as (t: unknown) => Promise<void>)(statefulTx());
    expect(loadConversationContext).toHaveBeenCalledWith(CLINIC_A, 'conv-1');
  });

  it('saída inválida do RAG nunca vira plano (failed + error_code, result nulo)', async () => {
    const { deps, searchFn } = baseDeps();
    searchFn.mockResolvedValueOnce([{ nope: true }]);
    const hook = await dispatchAiControlPrepareJob(job(CLINIC_A, preparePayload()), deps);
    const tx = statefulTx();
    await (hook as (t: unknown) => Promise<void>)(tx);
    expect(tx.run.status).toBe('failed');
    expect(tx.run.errorCode).toBe(AI_CONTROL_PREPARE_OUTPUT_INVALID_CODE);
    expect(tx.run.result).toBeNull();
    expect(tx.run.sources).toBeNull();
  });

  it('RAG fora do contrato (não-array) também é saída inválida', async () => {
    const { deps, searchFn } = baseDeps();
    searchFn.mockResolvedValueOnce(null);
    const hook = await dispatchAiControlPrepareJob(job(CLINIC_A, preparePayload()), deps);
    const tx = statefulTx();
    await (hook as (t: unknown) => Promise<void>)(tx);
    expect(tx.run.status).toBe('failed');
    expect(tx.run.errorCode).toBe(AI_CONTROL_PREPARE_OUTPUT_INVALID_CODE);
    expect(tx.run.result).toBeNull();
  });

  it('falha de infra do RAG propaga (retryável, nunca DLQ imediata)', async () => {
    const { deps, searchFn } = baseDeps();
    searchFn.mockRejectedValueOnce(new Error('rag-down'));
    await expect(
      dispatchAiControlPrepareJob(job(CLINIC_A, preparePayload()), deps),
    ).rejects.toThrow('rag-down');
  });

  it('evento ausente para o tenant marca failed observável (sem cross-tenant)', async () => {
    const { deps } = baseDeps({ loadEvent: jest.fn(async () => null) });
    const loadEvent = deps.loadEvent as jest.Mock;
    const hook = await dispatchAiControlPrepareJob(job(CLINIC_A, preparePayload()), deps);
    const tx = statefulTx();
    await (hook as (t: unknown) => Promise<void>)(tx);
    expect(loadEvent).toHaveBeenCalledWith(CLINIC_A, 'evt-001');
    expect(tx.run.status).toBe('failed');
    expect(tx.run.errorCode).toBe(AI_CONTROL_PREPARE_EVENT_MISSING_CODE);
    expect(tx.run.result).toBeNull();
  });

  it('OFF impede a análise: RAG e evento nem são tocados, run failed MODE_OFF', async () => {
    const { deps, searchFn } = baseDeps({ readMode: () => 'off' });
    const loadEvent = deps.loadEvent as jest.Mock;
    const hook = await dispatchAiControlPrepareJob(job(CLINIC_A, preparePayload()), deps);
    const tx = statefulTx();
    await (hook as (t: unknown) => Promise<void>)(tx);
    expect(searchFn).not.toHaveBeenCalled();
    expect(loadEvent).not.toHaveBeenCalled();
    expect(tx.run.status).toBe('failed');
    expect(tx.run.errorCode).toBe(AI_CONTROL_PREPARE_MODE_OFF_CODE);
    expect(tx.run.result).toBeNull();
  });

  it('OFF via env (AI_CONTROL_MODE=off) dispensa a análise sem efeito', async () => {
    const saved = process.env.AI_CONTROL_MODE;
    process.env.AI_CONTROL_MODE = 'off';
    try {
      const searchFn = jest.fn(async () => [{ id: 'k1', question: 'q', category: 'c' }]);
      const hook = await dispatchAiControlPrepareJob(job(CLINIC_A, preparePayload()), {
        searchFn,
        loadEvent: jest.fn(async () => eventRow()),
      });
      const tx = statefulTx();
      await (hook as (t: unknown) => Promise<void>)(tx);
      expect(searchFn).not.toHaveBeenCalled();
      expect(tx.run.status).toBe('failed');
      expect(tx.run.errorCode).toBe(AI_CONTROL_PREPARE_MODE_OFF_CODE);
    } finally {
      if (saved === undefined) delete process.env.AI_CONTROL_MODE;
      else process.env.AI_CONTROL_MODE = saved;
    }
  });

  it('replay do prepare não duplica: segundo hook casa 0 linhas e liquida ok', async () => {
    const { deps } = baseDeps();
    const hook = await dispatchAiControlPrepareJob(job(CLINIC_A, preparePayload()), deps);
    const tx = statefulTx();
    const runHook = hook as (t: unknown) => Promise<void>;
    await runHook(tx);
    expect(tx.calls).toHaveLength(1);
    expect(tx.calls[0]?.matched).toBe(1);
    const firstResult = tx.run.result;
    // Replay: a run já saiu de `queued` — 0 linhas, sem erro, sem mudar nada.
    await runHook(tx);
    expect(tx.calls).toHaveLength(2);
    expect(tx.calls[1]?.matched).toBe(0);
    expect(tx.run.status).toBe('observed');
    expect(tx.run.result).toBe(firstResult);
  });

  it('negativo A×B: payload de B em job A nunca chega ao RAG nem ao hook', async () => {
    const searchFn = jest.fn(async () => []);
    await expect(
      dispatchAiControlPrepareJob(job(CLINIC_A, preparePayload({ clinicId: CLINIC_B })), {
        searchFn,
        loadEvent: jest.fn(async () => eventRow()),
      }),
    ).rejects.toThrow(InvalidAiControlPrepareError);
    expect(searchFn).not.toHaveBeenCalled();
  });
});

describe('parseAiControlProposal', () => {
  it('aceita proposta válida e rejeita shape inválido', () => {
    expect(parseAiControlProposal({
      next_step: 'Observar lead.',
      sources: [{ id: 'k1', title: 'Como remarcar?' }],
    }).next_step).toBe('Observar lead.');
    expect(() => parseAiControlProposal({ next_step: '', sources: [{ id: '', title: '' }] })).toThrow();
    expect(() => parseAiControlProposal({ sources: [] })).toThrow();
  });
});

describe('1B estático: zero mutação, zero envio externo, zero LLM', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'dispatch-ai-control-prepare.ts'),
    'utf8',
  );

  it.each([
    ['LLM', /from\s+['"]@\/lib\/llm\//],
    ['provider IA vivo', /provider-zen|openai|minimax|openrouter/i],
    ['fetch externo', /fetch\s*\(/],
    ['envio WhatsApp/Evolution', /evolution|sendByChannel|send-message-service/i],
    ['gateway de pagamento', /dispatch-charge-job|payment-gateway/i],
    ['handlers de mutação de domínio', /updateLead|createAppointment|dispatchCharge|markCampaignRecipient|insertPatient|upsertLead/i],
  ])('módulo não importa %s', (_label, pattern) => {
    expect(source).not.toMatch(pattern);
  });

  it('operação registrada no catálogo do outbox e no worker', () => {
    expect(OUTBOX_OPERATIONS.AI_CONTROL_PREPARE).toBe('ai.control.prepare');
    const worker = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'lib', 'outbox', 'worker.ts'),
      'utf8',
    );
    expect(worker).toContain('AI_CONTROL_PREPARE');
    expect(worker).toContain('dispatchAiControlPrepareJob');
  });

  it('settlement usa UPDATE condicional (só promove `queued`)', () => {
    expect(source).toMatch(/eq\(agentRuns\.status,\s*'queued'\)/);
  });
});
