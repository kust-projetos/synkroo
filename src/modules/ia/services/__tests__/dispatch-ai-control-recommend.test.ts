/**
 * P4 Slice 1A — ingestão OBSERVE: envelope, tenant, determinismo e OBSERVE.
 *
 * Unit puro (sem DB): validação do envelope, chave de negócio
 * determinística, cerco de tenant por construção e garantias estáticas de
 * OBSERVE (zero LLM/RAG/handlers de mutação/envio externo).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isPermanentOutboxError } from '@/lib/outbox/errors';
import { OUTBOX_OPERATIONS } from '@/lib/outbox/operations';
import type { OutboxJob } from '@/lib/outbox/outbox-repository';
import {
  AI_CONTROL_ENVELOPE_VERSION,
  buildAiControlBusinessKey,
  dispatchAiControlRecommendJob,
  enqueueAiControlRecommend,
  InvalidAiControlRecommendError,
  parseAiControlRecommendPayload,
} from '../dispatch-ai-control-recommend';

jest.mock('@/lib/outbox/outbox-repository', () => {
  const actual = jest.requireActual('@/lib/outbox/outbox-repository');
  return { ...actual, enqueueOutbox: jest.fn(async () => undefined) };
});

import { enqueueOutbox } from '@/lib/outbox/outbox-repository';

const mockEnqueueOutbox = enqueueOutbox as jest.Mock;

const CLINIC_A = '11111111-1111-4111-8111-111111111111';
const CLINIC_B = '22222222-2222-4222-8222-222222222222';

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'evt-001',
    type: 'lead.created',
    version: AI_CONTROL_ENVELOPE_VERSION,
    occurredAt: '2026-10-13T12:00:00.000Z',
    subjectType: 'lead',
    subjectId: 'lead-123',
    clinicId: CLINIC_A,
    data: { source: 'widget' },
    ...overrides,
  };
}

function job(clinicId: string, payload: unknown, operation: string = OUTBOX_OPERATIONS.AI_CONTROL_RECOMMEND): OutboxJob {
  return { clinicId, operation, payload } as OutboxJob;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseAiControlRecommendPayload', () => {
  it('aceita envelope válido', () => {
    const parsed = parseAiControlRecommendPayload(job(CLINIC_A, envelope()));
    expect(parsed.eventId).toBe('evt-001');
    expect(parsed.version).toBe(AI_CONTROL_ENVELOPE_VERSION);
  });

  it.each([
    ['operação desconhecida', job(CLINIC_A, envelope(), 'crm.contact.changed')],
    ['eventId ausente', job(CLINIC_A, envelope({ eventId: '' }))],
    ['type ausente', job(CLINIC_A, envelope({ type: '' }))],
    ['versão divergente', job(CLINIC_A, envelope({ version: 999 }))],
    ['occurredAt inválido', job(CLINIC_A, envelope({ occurredAt: 'not-a-date' }))],
    ['subjectType ausente', job(CLINIC_A, envelope({ subjectType: '' }))],
    ['subjectId ausente', job(CLINIC_A, envelope({ subjectId: '' }))],
    ['clinicId ausente', job(CLINIC_A, envelope({ clinicId: '' }))],
    ['data não-objeto', job(CLINIC_A, envelope({ data: ['x'] }))],
  ])('rejeita %s como permanente (DLQ, sem retry)', (_label, j) => {
    expect(() => parseAiControlRecommendPayload(j)).toThrow(InvalidAiControlRecommendError);
    try {
      parseAiControlRecommendPayload(j);
    } catch (err) {
      expect(isPermanentOutboxError(err)).toBe(true);
    }
  });

  it('tenant descasado (payload B em job A) é permanente, nunca escrita cross-tenant', () => {
    const j = job(CLINIC_A, envelope({ clinicId: CLINIC_B }));
    expect(() => parseAiControlRecommendPayload(j)).toThrow(InvalidAiControlRecommendError);
  });

  it.each([
    ['payload null', null],
    ['payload string', 'not-an-object'],
    ['payload number', 42],
    ['payload array', [{ eventId: 'evt-001' }]],
  ])('%s é permanente (DLQ imediata, sem retry)', (_label, payload) => {
    const j = job(CLINIC_A, payload);
    expect(() => parseAiControlRecommendPayload(j)).toThrow(InvalidAiControlRecommendError);
    try {
      parseAiControlRecommendPayload(j);
    } catch (err) {
      expect(isPermanentOutboxError(err)).toBe(true);
    }
  });
});

describe('buildAiControlBusinessKey', () => {
  it('é determinística e segue JSON da tupla [subjectType, subjectId, eventId]', () => {
    const env = { subjectType: 'lead', subjectId: 'lead-123', eventId: 'evt-001' };
    expect(buildAiControlBusinessKey(env)).toBe('["lead","lead-123","evt-001"]');
    expect(buildAiControlBusinessKey(env)).toBe(buildAiControlBusinessKey({ ...env }));
  });

  it('nunca embute aleatoriedade (duas construções independentes coincidem)', () => {
    const a = buildAiControlBusinessKey({ subjectType: 'lead', subjectId: 'x', eventId: 'e' });
    const b = buildAiControlBusinessKey({ subjectType: 'lead', subjectId: 'x', eventId: 'e' });
    expect(a).toBe(b);
    expect(a).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  it('eventos distintos geram chaves distintas (sem colisão lógica)', () => {
    const a = buildAiControlBusinessKey({ subjectType: 'lead', subjectId: 'x', eventId: 'e1' });
    const b = buildAiControlBusinessKey({ subjectType: 'lead', subjectId: 'x', eventId: 'e2' });
    expect(a).not.toBe(b);
  });

  it('separadores embutidos não fundem fronteiras (x:y/z vs x/y:z colidiriam no join)', () => {
    const a = buildAiControlBusinessKey({ subjectType: 'lead', subjectId: 'x:y', eventId: 'z' });
    const b = buildAiControlBusinessKey({ subjectType: 'lead', subjectId: 'x', eventId: 'y:z' });
    expect(a).not.toBe(b);
  });
});

describe('enqueueAiControlRecommend (produtor)', () => {
  it('enfileira na MESMA transação do fato (rollback ⇒ zero órfão)', async () => {
    const tx = { __tx: 'same-connection' };
    await enqueueAiControlRecommend(tx, CLINIC_A, {
      eventId: 'evt-001',
      type: 'lead.created',
      occurredAt: '2026-10-13T12:00:00.000Z',
      subjectType: 'lead',
      subjectId: 'lead-123',
    });
    expect(mockEnqueueOutbox).toHaveBeenCalledTimes(1);
    const [usedTx, usedJob] = mockEnqueueOutbox.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(usedTx).toBe(tx);
    expect(usedJob.clinicId).toBe(CLINIC_A);
    expect(usedJob.operation).toBe(OUTBOX_OPERATIONS.AI_CONTROL_RECOMMEND);
    expect(usedJob.businessKey).toBe('["lead","lead-123","evt-001"]');
  });

  it('fail-fast: envelope malformado nunca entra na fila', async () => {
    await expect(
      enqueueAiControlRecommend({}, CLINIC_A, {
        eventId: '',
        type: 'lead.created',
        occurredAt: '2026-10-13T12:00:00.000Z',
        subjectType: 'lead',
        subjectId: 'lead-123',
      }),
    ).rejects.toThrow(InvalidAiControlRecommendError);
    expect(mockEnqueueOutbox).not.toHaveBeenCalled();
  });
});

describe('dispatchAiControlRecommendJob (consumidor OBSERVE)', () => {
  /** Fake tx que captura inserts e simula `onConflictDoNothing`. */
  function fakeTx() {
    const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const tx = {
      inserts,
      insert(table: unknown) {
        return {
          values: (values: Record<string, unknown>) => {
            inserts.push({ table, values });
            return { onConflictDoNothing: jest.fn(async () => undefined) };
          },
        };
      },
    };
    return tx as unknown as { inserts: typeof inserts } & Record<string, unknown>;
  }

  it('hook materializa Event + Goal + Run com o tenant do job (anti-cross-tenant por construção)', async () => {
    const hook = await dispatchAiControlRecommendJob(job(CLINIC_A, envelope()));
    const tx = fakeTx();
    await (hook as (t: unknown) => Promise<void>)(tx);
    expect(tx.inserts).toHaveLength(3);
    for (const ins of tx.inserts) {
      expect(ins.values.clinicId).toBe(CLINIC_A);
      expect(ins.values.eventId).toBe('evt-001');
    }
    const statuses = tx.inserts.map((i) => i.values.status).filter(Boolean);
    expect(statuses).toEqual(expect.arrayContaining(['queued', 'queued']));
  });

  it('payload de outro tenant nunca gera hook (rejeita antes de qualquer escrita)', async () => {
    await expect(
      dispatchAiControlRecommendJob(job(CLINIC_A, envelope({ clinicId: CLINIC_B }))),
    ).rejects.toThrow(InvalidAiControlRecommendError);
  });

  it('run nasce queued em modo observe (sem executor neste slice)', async () => {
    const hook = await dispatchAiControlRecommendJob(job(CLINIC_A, envelope()));
    const tx = fakeTx();
    await (hook as (t: unknown) => Promise<void>)(tx);
    const run = tx.inserts.find((i) => (i.values.mode as string) === 'observe');
    expect(run).toBeDefined();
    expect(run?.values.status).toBe('queued');
  });

  it('hook encadeia o prepare 1B na MESMA transação (businessKey determinística)', async () => {
    const hook = await dispatchAiControlRecommendJob(job(CLINIC_A, envelope()));
    const tx = fakeTx();
    await (hook as (t: unknown) => Promise<void>)(tx);
    expect(mockEnqueueOutbox).toHaveBeenCalledTimes(1);
    const [usedTx, usedJob] = mockEnqueueOutbox.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(usedTx).toBe(tx);
    expect(usedJob.clinicId).toBe(CLINIC_A);
    expect(usedJob.operation).toBe(OUTBOX_OPERATIONS.AI_CONTROL_PREPARE);
    expect(usedJob.businessKey).toBe(`["prepare","${CLINIC_A}","evt-001"]`);
    expect(usedJob.payload).toEqual({
      eventId: 'evt-001',
      clinicId: CLINIC_A,
      version: AI_CONTROL_ENVELOPE_VERSION,
    });
  });
});

describe('OBSERVE estático: zero mutação, zero envio externo, zero LLM/RAG', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'dispatch-ai-control-recommend.ts'),
    'utf8',
  );

  it.each([
    ['LLM', /from\s+['"]@\/lib\/llm\//],
    ['RAG', /rag\.service|from\s+['"]@\/modules\/ia\/services\/rag/],
    ['envio WhatsApp/Evolution', /evolution|sendByChannel|send-message-service/i],
    ['gateway de pagamento', /dispatch-charge-job|payment-gateway/i],
    ['provider IA vivo', /provider-zen|openai|minimax|openrouter/i],
    ['fetch externo', /fetch\s*\(/],
    ['handlers de mutação de domínio', /updateLead|createAppointment|dispatchCharge|markCampaignRecipient/i],
  ])('módulo não importa %s', (_label, pattern) => {
    expect(source).not.toMatch(pattern);
  });

  it('operação registrada no catálogo do outbox', () => {
    expect(OUTBOX_OPERATIONS.AI_CONTROL_RECOMMEND).toBe('ai.control.recommend');
  });
});
