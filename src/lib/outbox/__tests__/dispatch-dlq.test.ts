import { dispatchNextOutbox } from '../dispatch-outbox';
import { OutboxDeferredError, OutboxDeliveryUnknownError } from '../errors';

jest.mock('../outbox-repository', () => ({
  claimOutboxJob: jest.fn(),
  markOutboxDelivered: jest.fn(),
  markOutboxRetry: jest.fn(),
  markOutboxDeadLetter: jest.fn(),
  markOutboxDeferred: jest.fn(),
}));

const { claimOutboxJob, markOutboxRetry, markOutboxDelivered, markOutboxDeadLetter, markOutboxDeferred } = require('../outbox-repository');

/** Jobs claimed carregam a geração do lease; liquidações confirmam por padrão. */
function claimedJob(id: string, attempts: number, claimGeneration = 1) {
  return { id, attempts, claimGeneration, operation: 'followup.campaign.recipient', payload: { recipientId: 'r1' } };
}

describe('F7.07 retry bounded + DLQ observável', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    markOutboxDelivered.mockResolvedValue(true);
    markOutboxRetry.mockResolvedValue(true);
    markOutboxDeadLetter.mockResolvedValue(true);
    markOutboxDeferred.mockResolvedValue(true);
  });

  test('retryable when attempts <5', async () => {
    claimOutboxJob.mockResolvedValueOnce(claimedJob('j1', 2));
    const sender = jest.fn().mockRejectedValueOnce(new Error('CAMPAIGN_SEND_FAILED'));
    const onDeadLetter = jest.fn();
    const res = await dispatchNextOutbox(sender, { onDeadLetter });
    expect(res.status).toBe('retryable');
    // A fence é (id, geração do claim): `attempts` continua sendo só o orçamento.
    expect(markOutboxRetry).toHaveBeenCalledWith('j1', 1, 2, 'Error');
    expect(onDeadLetter).not.toHaveBeenCalled();
  });

  test('dead_letter when attempts >=5 and onDeadLetter called', async () => {
    claimOutboxJob.mockResolvedValueOnce(claimedJob('j2', 5, 11));
    const sender = jest.fn().mockRejectedValueOnce(new Error('OUT OF RETRIES'));
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);
    const res = await dispatchNextOutbox(sender, { onDeadLetter });
    expect(res.status).toBe('dead_letter');
    expect(markOutboxRetry).toHaveBeenCalledWith('j2', 11, 5, 'Error');
    expect(onDeadLetter).toHaveBeenCalledWith(expect.objectContaining({ id: 'j2' }), expect.any(Error));
  });

  test('delivered on success', async () => {
    claimOutboxJob.mockResolvedValueOnce(claimedJob('j3', 0, 2));
    const sender = jest.fn().mockResolvedValueOnce(undefined);
    const res = await dispatchNextOutbox(sender, {});
    expect(res.status).toBe('delivered');
    // Sender sem hook: o terceiro argumento (hook) chega `undefined`.
    expect(markOutboxDelivered).toHaveBeenCalledWith('j3', 2, undefined);
  });

  // ─── E4 — entrega não confirmada é PERMANENTE ────────────────────────────
  // Diferente das falhas determinísticas acima, o efeito pode já ter ocorrido:
  // retry automático reexecutaria o envio (duplicate-send).

  test('delivery unknown → dead_letter imediato, sem consumir retry', async () => {
    claimOutboxJob.mockResolvedValueOnce(claimedJob('j4', 0, 3));
    const sender = jest.fn().mockRejectedValueOnce(new OutboxDeliveryUnknownError());
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);

    const res = await dispatchNextOutbox(sender, { onDeadLetter });

    expect(res.status).toBe('dead_letter');
    expect(markOutboxDeadLetter).toHaveBeenCalledWith('j4', 3, 'OUTBOX_DELIVERY_UNKNOWN');
    expect(markOutboxRetry).not.toHaveBeenCalled();
    expect(markOutboxDelivered).not.toHaveBeenCalled();
    expect(onDeadLetter).toHaveBeenCalledWith(expect.objectContaining({ id: 'j4' }), expect.any(OutboxDeliveryUnknownError));
  });

  // ─── Defer — conflito de claim (interação com a DLQ) ───────────────────────
  // Um job aguardando o TTL de uma chave de idempotência alheia NÃO é falha:
  // mesmo com attempts no limite, não há DLQ nem retry ordinário — só o defer,
  // que devolve a tentativa do claim.

  test('defer com attempts no limite → retryable, sem DLQ e sem markRetry', async () => {
    claimOutboxJob.mockResolvedValueOnce(claimedJob('j5', 5, 4));
    const sender = jest.fn().mockRejectedValueOnce(new OutboxDeferredError(600));
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);

    const res = await dispatchNextOutbox(sender, { onDeadLetter });

    expect(res.status).toBe('retryable');
    expect(markOutboxDeferred).toHaveBeenCalledWith('j5', 4, 'OUTBOX_SEND_DEFERRED', 600);
    expect(markOutboxRetry).not.toHaveBeenCalled();
    expect(markOutboxDeadLetter).not.toHaveBeenCalled();
    expect(onDeadLetter).not.toHaveBeenCalled();
  });

  // ─── Fence do lease — liquidação de lease já perdido ──────────────────────
  // Sem a geração do claim, um settlement atrasado (holder antigo) liquidaria a
  // execução nova: `attempts` se repete por causa do defer, então ele NÃO
  // distingue os dois holders. `lease_lost` é o resultado honesto.

  test('liquidação recusada pelo banco → lease_lost, sem callback de DLQ', async () => {
    claimOutboxJob.mockResolvedValueOnce(claimedJob('j6', 5, 6));
    const sender = jest.fn().mockRejectedValueOnce(new OutboxDeliveryUnknownError());
    markOutboxDeadLetter.mockResolvedValue(false);
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);

    const res = await dispatchNextOutbox(sender, { onDeadLetter });

    expect(res).toEqual({ status: 'lease_lost', jobId: 'j6' });
    expect(onDeadLetter).not.toHaveBeenCalled();
  });

  test('retry/defer recusados pelo banco também devolvem lease_lost', async () => {
    claimOutboxJob.mockResolvedValueOnce(claimedJob('j7', 1, 7));
    const sender = jest.fn().mockRejectedValueOnce(new Error('CAMPAIGN_SEND_FAILED'));
    markOutboxRetry.mockResolvedValue(false);

    await expect(dispatchNextOutbox(sender)).resolves.toEqual({ status: 'lease_lost', jobId: 'j7' });

    claimOutboxJob.mockResolvedValueOnce(claimedJob('j8', 1, 8));
    markOutboxDeferred.mockResolvedValue(false);
    await expect(dispatchNextOutbox(jest.fn().mockRejectedValueOnce(new OutboxDeferredError(600))))
      .resolves.toEqual({ status: 'lease_lost', jobId: 'j8' });
  });
});
