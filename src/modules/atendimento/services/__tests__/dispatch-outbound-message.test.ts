/**
 * Unit test — dispatcher de outbox `atendimento.outbound.message` (E4).
 *
 * Prova as três pontas do residual de duplicate-send:
 *  1. todo job de WhatsApp é enviado sob uma chave estável ancorada em
 *     (tenant, job) — `whatsapp:send:<clinicId>:outbox:<jobId>` — cobrindo
 *     WAHA + fallback sidecar sob o MESMO claim;
 *  2. o retry/redelivery do MESMO job reusa a chave e chama o provider UMA
 *     vez (o claim deduplica; sem ele cada retry reexecutaria o envio);
 *  3. entrega NÃO confirmada (`delivery: 'unknown'`) é falha PERMANENTE
 *     (`OutboxDeliveryUnknownError`), nunca sucesso e nunca retry cego;
 *  4. conflito do claim (`in_progress`/`retry_after` — o handler NÃO rodou) é
 *     ADIADO (`OutboxDeferredError`): provider não é chamado, a tentativa não
 *     é consumida e o erro nunca é confundido com falha de provider;
 *  5. recusa SEMÂNTICA da liquidação do lembrete (nenhuma linha casou no cerco
 *     de tenant) é falha PERMANENTE tipada
 *     (`ReminderSettlementRejectedError`, código fixo
 *     `REMINDER_SETTLEMENT_REJECTED`) — distinta de uma falha de escrita no
 *     banco, que continua propagando.
 *
 * Provider real NÃO é usado: o adapter é injetado no seam do registry
 * (`whatsapp-provider-registry`) e o claim de idempotência roda em memória com
 * a mesma semântica de estados do `src/lib/idempotency`.
 */

const claims = new Map<string, { status: string; expiresAt: number | null }>();

type ClaimOutcome = 'claimed' | 'completed' | 'in_progress' | 'retry_after' | 'unknown';

jest.mock('@/lib/idempotency', () => {
  class IdempotencyInfraError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'IdempotencyInfraError';
    }
  }
  const now = (): number => Date.now();
  return {
    IdempotencyInfraError,
    claimIdempotencyKey: jest.fn(async (key: string, _jobType: string, opts: { ttlSeconds?: number; completedTtlMs?: number } = {}) => {
      const row = claims.get(key);
      if (!row) {
        claims.set(key, { status: 'in_progress', expiresAt: now() + (opts.ttlSeconds ?? 3600) * 1000 });
        return 'claimed';
      }
      // Estado terminal do efeito (inclui o marco durável `dispatching`).
      if (row.status === 'unknown' || row.status === 'dispatching') return 'unknown';
      if (row.status === 'completed') {
        return opts.completedTtlMs === undefined || !row.expiresAt || row.expiresAt > now() ? 'completed' : 'retry_after';
      }
      const expired = !row.expiresAt || row.expiresAt <= now();
      if (expired) {
        claims.set(key, { status: 'in_progress', expiresAt: now() + (opts.ttlSeconds ?? 3600) * 1000 });
        return 'claimed';
      }
      return row.status === 'failed' ? 'retry_after' : 'in_progress';
    }) as unknown as jest.Mock,
    markIdempotencyKeyCompleted: jest.fn(async (key: string, completedTtlMs?: number) => {
      claims.set(key, {
        status: 'completed',
        expiresAt: completedTtlMs === undefined ? null : now() + completedTtlMs,
      });
    }),
    markIdempotencyKeyDispatching: jest.fn(async (key: string) => {
      const row = claims.get(key);
      if (!row || row.status !== 'in_progress') return false;
      claims.set(key, { status: 'dispatching', expiresAt: null });
      return true;
    }),
    markIdempotencyKeyFailed: jest.fn(async (key: string, _error: string, ttlSeconds?: number) => {
      claims.set(key, { status: 'failed', expiresAt: ttlSeconds === undefined ? null : now() + ttlSeconds * 1000 });
    }),
    markIdempotencyKeyUnknown: jest.fn(async (key: string) => {
      claims.set(key, { status: 'unknown', expiresAt: null });
    }),
    isIdempotencyKeyProcessed: jest.fn(async (key: string) => claims.get(key)?.status === 'completed'),
    withIdempotency: jest.fn(),
  };
});

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/modules/operacional/public', () => ({
  // Default: liquidação casa o lembrete (linha atualizada). Os testes de
  // recusa sobrescrevem com `mockResolvedValueOnce(null)`.
  markReminderDelivered: jest.fn(async () => ({ id: 'rem-1' })),
}));

const fakeAdapters = new Map<string, { isAvailable: () => boolean; sendTextMessage: jest.Mock }>();

jest.mock('../../integrations/whatsapp-provider-registry', () => ({
  getWhatsAppProviderAdapter: jest.fn((id: string) => fakeAdapters.get(id) ?? null),
}));

import { dispatchOutboundMessageJob } from '../dispatch-outbound-message';
import { IdempotencyInfraError, claimIdempotencyKey } from '@/lib/idempotency';
import {
  OutboxDeferredError,
  OutboxDeliveryUnknownError,
  PermanentOutboxError,
  ReminderSettlementRejectedError,
} from '@/lib/outbox/errors';
import { buildOutboundIdempotencyKey } from '@/lib/http/outbound-idempotency';
import { markReminderDelivered } from '@/modules/operacional/public';
import type { OutboxJob } from '@/lib/outbox/outbox-repository';

const clinicId = '11111111-1111-1111-1111-111111111111';

function whatsappJob(overrides: Partial<OutboxJob> = {}): OutboxJob {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    clinicId,
    operation: 'atendimento.outbound.message',
    businessKey: 'outbound:1',
    payload: { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá' },
    status: 'processing',
    attempts: 1,
    nextAttemptAt: new Date(),
    lastErrorCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as OutboxJob;
}

function fakeAdapter(id = 'waha') {
  const adapter = { id, isAvailable: () => true, sendTextMessage: jest.fn() };
  fakeAdapters.set(id, adapter);
  return adapter;
}

describe('dispatch-outbound-message (E4 — envio com chave estável)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    claims.clear();
    fakeAdapters.clear();
    process.env = { ...originalEnv };
    process.env.WAHA_API_URL = 'https://waha.example.com';
    process.env.WAHA_API_KEY = 'waha-key';
    delete process.env.WHATSAPP_FALLBACK_URL;
    delete process.env.WHATSAPP_FALLBACK_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('whatsapp: envia sob chave estável tenant/job-bound (WAHA + fallback no mesmo claim)', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-1' });

    await expect(dispatchOutboundMessageJob(whatsappJob())).resolves.toBeUndefined();

    expect(adapter.sendTextMessage).toHaveBeenCalledWith('5511999990000', 'Olá');
    // Chave determinística: mesma clínica + mesmo job ⇒ mesma chave.
    const key = buildOutboundIdempotencyKey('whatsapp', clinicId, 'outbox:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(claimIdempotencyKey).toHaveBeenCalledWith(key, 'whatsapp:outbound', expect.objectContaining({ ttlSeconds: 600 }));
    expect(claims.get(key)?.status).toBe('completed');
  });

  // ─── E4 — liquidação do lembrete por hook, não por escrita imediata ───────
  // O provider confirmou, mas a execução ainda não é dona COMPROVADA da linha
  // do outbox (lease de 5min recuperável). Marcar `appointment_reminders`
  // dentro do handler marcaria um job cuja liquidação o fence vai recusar.

  it('sucesso com reminderId → devolve hook e NÃO escreve o lembrete imediatamente', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-1' });
    const job = whatsappJob({
      payload: { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá', reminderId: 'rem-1' },
    });

    const hook = await dispatchOutboundMessageJob(job);

    expect(typeof hook).toBe('function');
    // Nenhuma escrita antes do fence: o dispatcher ainda não confirmou a posse.
    expect(markReminderDelivered).not.toHaveBeenCalled();

    // O hook escreve o lembrete dentro do `tx` da liquidação, cercado pelo
    // tenant do job (`clinicId`).
    const fakeTx = { update: jest.fn() };
    await hook!(fakeTx);

    expect(markReminderDelivered).toHaveBeenCalledWith('rem-1', clinicId, 'waha-1', fakeTx);
  });

  it('liquidação sem linha atualizada (reminderId/clinic descasados) → falha PERMANENTE tipada e sanitizada', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-1' });
    const job = whatsappJob({
      payload: { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá', reminderId: 'rem-1' },
    });
    // Repositório recusou: nenhuma linha casou (id inexistente, status não
    // `queued` ou compromisso em outra clínica).
    (markReminderDelivered as jest.Mock).mockResolvedValueOnce(null);

    const hook = await dispatchOutboundMessageJob(job);

    const err = await hook!({ update: jest.fn() }).catch((e) => e);
    // Falha PERMANENTE tipada: o dispatcher move a linha direto para a DLQ com
    // este código fixo, sem reexecutar o job (a entrega ao provider ocorreu).
    expect(err).toBeInstanceOf(ReminderSettlementRejectedError);
    expect(err).toBeInstanceOf(PermanentOutboxError);
    expect((err as ReminderSettlementRejectedError).code).toBe('REMINDER_SETTLEMENT_REJECTED');
    // O tenant do job foi usado no cerco: o hook nunca marca sem ele.
    expect(markReminderDelivered).toHaveBeenCalledWith('rem-1', clinicId, 'waha-1', expect.anything());
    // Mensagem fixa: nem reminderId, nem telefone, nem detalhe de banco.
    expect((err as Error).message).not.toContain('rem-1');
    expect((err as Error).message).not.toContain('5511999990000');
  });

  it('hook de liquidação é isolado por job: cada execução carrega seu reminderId/messageId', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-1' });
    const job = whatsappJob({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      payload: { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá', reminderId: 'rem-2' },
    });

    const hook = await dispatchOutboundMessageJob(job);
    await hook!({});

    expect(markReminderDelivered).toHaveBeenCalledWith('rem-2', clinicId, 'waha-1', expect.anything());
  });

  it('chave é tenant-bound: outro clinicId NÃO deduplica o mesmo job', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-1' });

    await dispatchOutboundMessageJob(whatsappJob());
    await dispatchOutboundMessageJob(whatsappJob({ clinicId: '22222222-2222-2222-2222-222222222222' } as Partial<OutboxJob>));

    expect(claims.has(buildOutboundIdempotencyKey('whatsapp', clinicId, 'outbox:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))).toBe(true);
    expect(claims.has(buildOutboundIdempotencyKey('whatsapp', '22222222-2222-2222-2222-222222222222', 'outbox:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))).toBe(true);
    expect(adapter.sendTextMessage).toHaveBeenCalledTimes(2);
  });

  it('retry/redelivery do MESMO job reusa a chave e chama o provider UMA vez', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-1' });
    const job = whatsappJob();

    await dispatchOutboundMessageJob(job);
    // Replay do mesmo job (outage, reexecução do worker, re-fetch): não lança
    // (o claim dedup como sucesso) e NÃO reenvia ao provider.
    await expect(dispatchOutboundMessageJob(job)).resolves.toBeUndefined();
    await expect(dispatchOutboundMessageJob(job)).resolves.toBeUndefined();

    expect(adapter.sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it('falha de infra no claim → fail-closed: provider NUNCA é chamado', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-1' });
    (claimIdempotencyKey as jest.Mock).mockRejectedValueOnce(new IdempotencyInfraError('db offline'));

    await expect(dispatchOutboundMessageJob(whatsappJob())).rejects.toBeInstanceOf(IdempotencyInfraError);
    expect(adapter.sendTextMessage).not.toHaveBeenCalled();
  });

  it('operação desconhecida lança ANTES de qualquer envio: sem hook, sem lembrete marcado', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-1' });
    const job = whatsappJob({ operation: 'financeiro.charge.create' });

    await expect(dispatchOutboundMessageJob(job)).rejects.toThrow('UNKNOWN_OUTBOX_OPERATION');
    expect(adapter.sendTextMessage).not.toHaveBeenCalled();
    expect(claimIdempotencyKey).not.toHaveBeenCalled();
    // Nenhum hook é criado: o caminho desconhecido aborta antes.
    expect(markReminderDelivered).not.toHaveBeenCalled();
  });

  it('entrega não confirmada → falha PERMANENTE (nunca sucesso, nunca retry cego)', async () => {
    const adapter = fakeAdapter();
    // Exceção ambígua (sem marcador `delivery: 'not_attempted'`): o dispatch
    // pode ter ocorrido — nenhum fallback, nenhum retry.
    adapter.sendTextMessage.mockRejectedValue(new Error('provider timeout'));
    const job = whatsappJob({
      payload: { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá', reminderId: 'rem-1' },
    });

    await expect(dispatchOutboundMessageJob(job)).rejects.toBeInstanceOf(OutboxDeliveryUnknownError);

    // A linha de idempotência fica TERMINAL `unknown`: replay não reenvia.
    const key = buildOutboundIdempotencyKey('whatsapp', clinicId, 'outbox:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(claims.get(key)?.status).toBe('unknown');
    await expect(dispatchOutboundMessageJob(job)).rejects.toBeInstanceOf(OutboxDeliveryUnknownError);
    expect(adapter.sendTextMessage).toHaveBeenCalledTimes(1);
    // Sem entrega confirmada, o lembrete NÃO é marcado como entregue.
    expect(markReminderDelivered).not.toHaveBeenCalled();
  });

  it('falha determinística conhecida segue retryável (claim failed, TTL libera retry)', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockRejectedValue(Object.assign(new Error('invalid destination'), { delivery: 'not_attempted' }));

    await expect(dispatchOutboundMessageJob(whatsappJob())).rejects.toThrow('invalid destination');

    const key = buildOutboundIdempotencyKey('whatsapp', clinicId, 'outbox:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(claims.get(key)?.status).toBe('failed');
  });

  // ─── Defer — conflito do claim de idempotência ─────────────────────────────
  // O handler NÃO rodou: a chave está ativa (outra execução dona da operação
  // lógica) ou a falha determinística anterior ainda vive dentro do TTL de
  // 600s. Retry normal agora reenviaria o conflito antes do TTL e consumiria
  // o orçamento de tentativas — o job é adiado (`OutboxDeferredError`), nunca
  // marcado como entregue e nunca tratado como falha de provider.

  it('conflito in_progress → defer, provider NÃO é chamado', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-1' });
    const key = buildOutboundIdempotencyKey('whatsapp', clinicId, 'outbox:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    // Outra execução já segura a chave (claim vivo, dentro do TTL de 600s).
    claims.set(key, { status: 'in_progress', expiresAt: Date.now() + 600_000 });

    await expect(dispatchOutboundMessageJob(whatsappJob())).rejects.toBeInstanceOf(OutboxDeferredError);

    expect(adapter.sendTextMessage).not.toHaveBeenCalled();
    expect(markReminderDelivered).not.toHaveBeenCalled();
  });

  it('conflito retry_after (falha determinística anterior dentro do TTL) → defer', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockRejectedValue(Object.assign(new Error('invalid destination'), { delivery: 'not_attempted' }));
    const job = whatsappJob();

    // 1ª execução: falha determinística conhecida — retryável comum.
    await expect(dispatchOutboundMessageJob(job)).rejects.toThrow('invalid destination');
    // 2ª execução antes do TTL do claim: conflito → defer (não reenvia).
    await expect(dispatchOutboundMessageJob(job)).rejects.toBeInstanceOf(OutboxDeferredError);

    // O provider foi chamado UMA única vez: nenhum retry cego dentro do TTL.
    expect(adapter.sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it('defer carrega o piso do TTL do claim e mensagem sanitizada (sem chave/telefone)', async () => {
    const adapter = fakeAdapter();
    adapter.sendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-1' });
    const key = buildOutboundIdempotencyKey('whatsapp', clinicId, 'outbox:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    claims.set(key, { status: 'in_progress', expiresAt: Date.now() + 600_000 });

    const err = await dispatchOutboundMessageJob(whatsappJob()).catch((e) => e);

    expect(err).toBeInstanceOf(OutboxDeferredError);
    expect((err as OutboxDeferredError).retryAfterSeconds).toBe(600);
    expect((err as OutboxDeferredError).code).toBe('OUTBOX_SEND_DEFERRED');
    expect((err as OutboxDeferredError).message).not.toContain('5511999990000');
    expect((err as OutboxDeferredError).message).not.toContain(key);
    expect(adapter.sendTextMessage).not.toHaveBeenCalled();
  });

  it('instagram e web preservam contratos: nenhuma chave de idempotência é criada', async () => {
    const instagram = { ...whatsappJob(), payload: { channel: 'instagram', externalId: 'ig-1', message: 'Oi' } } as OutboxJob;
    await expect(dispatchOutboundMessageJob(instagram)).rejects.toThrow('Instagram outbound not yet implemented');

    const web = { ...whatsappJob(), payload: { channel: 'web', externalId: 'w-1', message: 'Oi' } } as OutboxJob;
    await expect(dispatchOutboundMessageJob(web)).rejects.toThrow('Web widget is receive-only');

    expect(claims.size).toBe(0);
    expect(claimIdempotencyKey).not.toHaveBeenCalled();
  });
});
