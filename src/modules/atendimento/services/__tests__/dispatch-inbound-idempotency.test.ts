/**
 * Fiação A3 — dispatch-inbound sendReply ancora no OutboxJob estável.
 *
 * Facades REAIS (channel-service + evolution-service) + claim in-memory:
 * redelivery do mesmo job (`whatsapp:send:<clinic>:inbox:<jobId>`) → provider 1 chamada.
 */

const outcomes: Array<'claimed' | 'completed' | 'in_progress' | 'retry_after'> = [];

jest.mock('@/lib/idempotency', () => ({
  claimIdempotencyKey: jest.fn(async () => outcomes.shift() ?? 'claimed'),
  markIdempotencyKeyCompleted: jest.fn(async () => undefined),
  markIdempotencyKeyFailed: jest.fn(async () => undefined),
  isIdempotencyKeyProcessed: jest.fn(async () => false),
  withIdempotency: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/modules/operacional/public', () => ({
  processConfirmationResponse: jest.fn(async () => ({ processed: false })),
  processWaitlistConfirmation: jest.fn(async () => ({ processed: false })),
  buscarPacientePorTelefone: jest.fn(async () => null),
}));

jest.mock('@/modules/comercial/public', () => ({
  buscarLeadPorTelefone: jest.fn(async () => null),
  capturarLeadInbound: jest.fn(async () => undefined),
}));

jest.mock('@/core/ia-channel/interlocutor', () => ({
  resolveInterlocutor: jest.fn(async () => null),
}));

jest.mock('@/core/ia-channel/agent-invoker', () => ({
  invokeAgent: jest.fn(),
}));

jest.mock('@/core/ia-channel/webhook-router', () => ({
  routeInboundToAgent: jest.fn(async (deps: any, jobCtx: any) => {
    await deps.sendReply(jobCtx.conversationId, 'Resposta do agente');
    return { from: jobCtx.phone, action: 'replied' };
  }),
}));

jest.mock('../../repositories/conversations-repository', () => ({
  appendOutboundMessage: jest.fn(async () => ({ id: 'out-1' })),
  updateConversationTimestamp: jest.fn(async () => undefined),
}));

import { dispatchInboundMessageJob } from '../dispatch-inbound-message';
import { routeInboundToAgent } from '@/core/ia-channel/webhook-router';
import { OutboundSendConflictError } from '@/lib/http/outbound-idempotency';

function makeJob(id: string): any {
  return {
    id,
    clinicId: 'clinic-1',
    payload: {
      clinicId: 'clinic-1',
      conversationId: 'conv-1',
      channel: 'whatsapp',
      externalConversationId: '5511999990001',
      externalProvider: 'evolution',
      externalMessageId: 'ext-1',
      content: 'Olá',
      messageType: 'text',
      metadata: {},
    },
  };
}

describe('dispatch-inbound sendReply idempotency wiring (A3)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    outcomes.length = 0;
    jest.clearAllMocks();
    // Re-arj o mock de roteamento (clearAllMocks preserva implementação base).
    (routeInboundToAgent as jest.Mock).mockImplementation(async (deps: any, jobCtx: any) => {
      await deps.sendReply(jobCtx.conversationId, 'Resposta do agente');
      return { from: jobCtx.phone, action: 'replied' };
    });
    process.env = { ...originalEnv };
    process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
    process.env.EVOLUTION_API_KEY = 'evo-key';
    delete process.env.WHATSAPP_FALLBACK_URL;
    delete process.env.WHATSAPP_FALLBACK_SECRET;
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { Info: { ID: 'evo-1' } } }),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('redelivery do mesmo job → provider chamado 1 vez', async () => {
    outcomes.push('claimed', 'completed');
    const job = makeJob('job-1');

    await dispatchInboundMessageJob(job);
    await dispatchInboundMessageJob(job);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('jobs distintos → envios independentes', async () => {
    outcomes.push('claimed', 'claimed');
    await dispatchInboundMessageJob(makeJob('job-a'));
    await dispatchInboundMessageJob(makeJob('job-b'));

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('job com outra execução ativa → ConflictError, provider NÃO chamado (job falha p/ retry)', async () => {
    outcomes.push('in_progress');

    await expect(dispatchInboundMessageJob(makeJob('job-busy'))).rejects.toBeInstanceOf(
      OutboundSendConflictError,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
