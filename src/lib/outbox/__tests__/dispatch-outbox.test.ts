const claimOutboxJob = jest.fn();
const markOutboxDelivered = jest.fn();
const markOutboxRetry = jest.fn();
const markOutboxDeadLetter = jest.fn();
const markOutboxDeferred = jest.fn();

jest.mock('../outbox-repository', () => ({
  claimOutboxJob: (...args: unknown[]) => claimOutboxJob(...args),
  markOutboxDelivered: (...args: unknown[]) => markOutboxDelivered(...args),
  markOutboxRetry: (...args: unknown[]) => markOutboxRetry(...args),
  markOutboxDeadLetter: (...args: unknown[]) => markOutboxDeadLetter(...args),
  markOutboxDeferred: (...args: unknown[]) => markOutboxDeferred(...args),
}));

import { dispatchNextOutbox, type OutboxSender } from '../dispatch-outbox';
import {
  OutboxDeferredError,
  OutboxDeliveryUnknownError,
  ReminderSettlementRejectedError,
} from '../errors';
import type { OutboxSuccessHook } from '../outbox-repository';

const job = { id: 'job-1', attempts: 1, claimGeneration: 7 } as any;

/** Todo mock de liquidação confirma o lease por padrão. */
function settlementsConfirm() {
  markOutboxDelivered.mockResolvedValue(true);
  markOutboxRetry.mockResolvedValue(true);
  markOutboxDeadLetter.mockResolvedValue(true);
  markOutboxDeferred.mockResolvedValue(true);
}

describe('outbox dispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settlementsConfirm();
  });

  it('delivers a claimed job once', async () => {
    claimOutboxJob.mockResolvedValue(job);

    await expect(dispatchNextOutbox(async () => undefined)).resolves.toEqual({ status: 'delivered', jobId: 'job-1' });
    // A fence carrega o id E a geração devolvida pelo claim.
    expect(markOutboxDelivered).toHaveBeenCalledWith('job-1', 7, undefined);
  });

  // ─── Hook de liquidação de sucesso (E4) ───────────────────────────────────
  // Um sender que devolve hook em vez de `void` delega um efeito colateral
  // (ex.: marcar o lembrete como entregue). O hook NUNCA pode rodar antes do
  // fence confirmar a propriedade da linha.

  it('hook de sucesso é encaminhado ao marco de entrega com o fence do lease', async () => {
    claimOutboxJob.mockResolvedValue(job);
    const hook = jest.fn(async () => undefined) as unknown as OutboxSuccessHook;

    await expect(dispatchNextOutbox(async () => hook)).resolves.toEqual({ status: 'delivered', jobId: 'job-1' });

    expect(markOutboxDelivered).toHaveBeenCalledWith('job-1', 7, hook);
  });

  it('lease perdido na entrega → lease_lost e o hook de sucesso NUNCA é invocado pelo dispatcher', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-hook-lost', attempts: 1, claimGeneration: 8 });
    const hook = jest.fn(async () => undefined);
    markOutboxDelivered.mockResolvedValue(false);

    await expect(dispatchNextOutbox(async () => hook)).resolves.toEqual({ status: 'lease_lost', jobId: 'job-hook-lost' });

    // O hook chega ao marco cercado (é lá que o fence decide), mas o dispatcher
    // não reporta desfecho nenhum — e a execução atual não é dona da linha.
    expect(markOutboxDelivered).toHaveBeenCalledWith('job-hook-lost', 8, hook);
    expect(markOutboxRetry).not.toHaveBeenCalled();
    expect(markOutboxDeadLetter).not.toHaveBeenCalled();
    expect(markOutboxDeferred).not.toHaveBeenCalled();
  });

  it('sender que lança não produz hook: o caminho de erro nunca passa pelo marco de entrega', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-err', attempts: 1, claimGeneration: 5 });

    await expect(dispatchNextOutbox(async () => { throw new OutboxDeliveryUnknownError(); }))
      .resolves.toEqual({ status: 'dead_letter', jobId: 'job-err' });
    expect(markOutboxDelivered).not.toHaveBeenCalled();
  });

  it('returns empty when no pending job exists', async () => {
    claimOutboxJob.mockResolvedValue(undefined);

    await expect(dispatchNextOutbox(async () => undefined)).resolves.toEqual({ status: 'empty' });
  });
  it('routes operation filters and dead-letter callbacks', async () => {
    const deadLetterJob = { ...job, attempts: 5, operation: 'campaign' };
    claimOutboxJob.mockResolvedValue(deadLetterJob);
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);

    await expect(dispatchNextOutbox(async () => { throw new Error('provider down'); }, { operations: ['campaign'], onDeadLetter }))
      .resolves.toEqual({ status: 'dead_letter', jobId: 'job-1' });
    expect(claimOutboxJob).toHaveBeenCalledWith({ operations: ['campaign'] });
    expect(markOutboxRetry).toHaveBeenCalledWith('job-1', 7, 5, 'Error');
    expect(onDeadLetter).toHaveBeenCalledWith(deadLetterJob, expect.any(Error));
  });

  // ─── Fence do lease (migration 0036) ──────────────────────────────────────
  // `attempts` volta a repetir depois do defer + reclaim (ABA), então a fence é
  // a geração do claim. Quando o UPDATE não casa o lease inteiro, a execução
  // não é dona da linha: nenhum desfecho é reportado e nenhum callback roda.

  const leaseLostCases: Array<{
    label: string;
    /** Marco que o dispatcher escolheria se o lease ainda fosse dele. */
    milestone: string;
    /** Resultado que NÃO pode ser devolvido nesse caminho. */
    wouldReport: 'delivered' | 'retryable' | 'dead_letter';
    sender: OutboxSender;
  }> = [
    {
      label: 'entrega',
      milestone: 'markOutboxDelivered',
      wouldReport: 'delivered',
      sender: async () => undefined,
    },
    {
      label: 'falha conhecida',
      milestone: 'markOutboxRetry',
      wouldReport: 'retryable',
      sender: async () => { throw new Error('provider down'); },
    },
    {
      label: 'defer',
      milestone: 'markOutboxDeferred',
      wouldReport: 'retryable',
      sender: async () => { throw new OutboxDeferredError(600); },
    },
    {
      label: 'falha permanente',
      milestone: 'markOutboxDeadLetter',
      wouldReport: 'dead_letter',
      sender: async () => { throw new OutboxDeliveryUnknownError(); },
    },
  ];

  for (const testCase of leaseLostCases) {
    it(`lease perdido na liquidação (${testCase.label}) → lease_lost, sem desfecho nem callback`, async () => {
      settlementsConfirm();
      claimOutboxJob.mockResolvedValue({ id: 'job-lost', attempts: 1, claimGeneration: 3 });
      const marks: Record<string, jest.Mock> = {
        markOutboxDelivered, markOutboxRetry, markOutboxDeferred, markOutboxDeadLetter,
      };
      marks[testCase.milestone].mockResolvedValue(false);
      const onDeadLetter = jest.fn().mockResolvedValue(undefined);

      await expect(dispatchNextOutbox(testCase.sender, { onDeadLetter })).resolves.toEqual({
        status: 'lease_lost',
        jobId: 'job-lost',
      });
      // Nenhum outro marco foi tentado e o callback NUNCA dispara.
      for (const [name, mark] of Object.entries(marks)) {
        if (name === testCase.milestone) continue;
        expect(mark).not.toHaveBeenCalled();
      }
      expect(onDeadLetter).not.toHaveBeenCalled();
      expect(testCase.wouldReport).not.toBe('lease_lost');
    });
  }

  it('falha de gravação na liquidação PROPAGA (não vira falha de provider)', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-db', attempts: 1, claimGeneration: 4 });
    markOutboxDelivered.mockRejectedValue(new Error('db down during settlement'));

    // O sender funcionou: a queda do banco na liquidação NÃO pode ser lida como
    // erro do provider — isso levaria a retry/DLQ de um efeito já ocorrido.
    await expect(dispatchNextOutbox(async () => undefined)).rejects.toThrow('db down during settlement');
    expect(markOutboxRetry).not.toHaveBeenCalled();
    expect(markOutboxDeadLetter).not.toHaveBeenCalled();
    expect(markOutboxDeferred).not.toHaveBeenCalled();
  });

  // ─── E4 — rejeição SEMÂNTICA da liquidação (hook) ─────────────────────────
  // O hook roda DENTRO da transação de liquidação. Quando ele recusa por
  // semântica (nenhuma linha de lembrete casou o cerco de tenant), o `delivered`
  // foi desfeito com ele e a entrega AO PROVIDER já ocorreu: reexecutar o job
  // reexecutaria o envio. O dispatcher captura EXATAMENTE esse tipo e move a
  // linha para a DLQ com código fixo — nunca `markOutboxRetry` (não é falha de
  // provider) e nunca `delivered`.

  it('liquidação recusada por semântica → dead_letter com código fixo, sem retry', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-settlement', attempts: 3, claimGeneration: 12 });
    markOutboxDelivered.mockRejectedValue(new ReminderSettlementRejectedError());
    const hook = jest.fn(async () => undefined) as unknown as OutboxSuccessHook;
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);

    await expect(dispatchNextOutbox(async () => hook, { onDeadLetter })).resolves.toEqual({
      status: 'dead_letter',
      jobId: 'job-settlement',
    });

    // Código fixo e sanitizado, cercado pelo lease (id + geração do claim).
    expect(markOutboxDeadLetter).toHaveBeenCalledWith('job-settlement', 12, 'REMINDER_SETTLEMENT_REJECTED');
    // Nenhuma nova tentativa (não é falha de provider), nenhum defer, nenhuma
    // entrega reportada e nenhum segundo envio.
    expect(markOutboxRetry).not.toHaveBeenCalled();
    expect(markOutboxDeferred).not.toHaveBeenCalled();
    expect(markOutboxDelivered).toHaveBeenCalledTimes(1);
    expect(onDeadLetter).toHaveBeenCalledTimes(1);
    expect(onDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-settlement' }),
      expect.any(ReminderSettlementRejectedError),
    );
  });

  it('liquidação recusada por semântica com fence vencido → lease_lost, sem callback', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-settlement-lost', attempts: 0, claimGeneration: 13 });
    markOutboxDelivered.mockRejectedValue(new ReminderSettlementRejectedError());
    markOutboxDeadLetter.mockResolvedValue(false);
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);

    await expect(dispatchNextOutbox(async () => undefined, { onDeadLetter })).resolves.toEqual({
      status: 'lease_lost',
      jobId: 'job-settlement-lost',
    });
    // Sem confirmação da DLQ não há reconciliação: o callback NUNCA dispara.
    expect(onDeadLetter).not.toHaveBeenCalled();
  });

  it('outro erro da liquidação (banco) PROPAGA — não vira DLQ nem falha de provider', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-settlement-db', attempts: 1, claimGeneration: 14 });
    markOutboxDelivered.mockRejectedValue(new Error('reminder write unavailable'));
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);

    // Falha de escrita NÃO é rejeição semântica: o efeito colateral não tem
    // desfecho conhecido, então o erro PROPAGA e nenhum marco é tentado.
    await expect(dispatchNextOutbox(async () => undefined, { onDeadLetter }))
      .rejects.toThrow('reminder write unavailable');
    expect(markOutboxDeadLetter).not.toHaveBeenCalled();
    expect(markOutboxRetry).not.toHaveBeenCalled();
    expect(markOutboxDeferred).not.toHaveBeenCalled();
    expect(onDeadLetter).not.toHaveBeenCalled();
  });

  it('hook de sucesso que lança PROPAGA junto com a falha do marco de entrega', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-hook-boom', attempts: 1, claimGeneration: 6 });
    const boom = jest.fn(async () => { throw new Error('reminder write failed'); }) as unknown as OutboxSuccessHook;
    markOutboxDelivered.mockRejectedValue(new Error('reminder write failed'));

    // O hook roda DENTRO da transação da liquidação: a falha dele é falha da
    // liquidação e propaga — nunca é reinterpretada como falha de provider
    // (o efeito externo já ocorreu). Nenhum outro marco é tentado.
    await expect(dispatchNextOutbox(async () => boom)).rejects.toThrow('reminder write failed');
    expect(markOutboxRetry).not.toHaveBeenCalled();
    expect(markOutboxDeadLetter).not.toHaveBeenCalled();
    expect(markOutboxDeferred).not.toHaveBeenCalled();
  });

  it('callback de DLQ que lança não gera uma segunda liquidação', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-cb', attempts: 0, claimGeneration: 9 });
    const onDeadLetter = jest.fn().mockRejectedValue(new Error('callback boom'));

    await expect(
      dispatchNextOutbox(async () => { throw new OutboxDeliveryUnknownError(); }, { onDeadLetter }),
    ).rejects.toThrow('callback boom');
    expect(markOutboxDeadLetter).toHaveBeenCalledTimes(1);
    expect(markOutboxDelivered).not.toHaveBeenCalled();
    expect(markOutboxRetry).not.toHaveBeenCalled();
  });

  it('falha fechada quando o claim não devolve a geração do lease', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-nogen', attempts: 0 });

    await expect(dispatchNextOutbox(async () => undefined)).rejects.toThrow('OUTBOX_LEASE_INCOMPLETE');
    expect(markOutboxDelivered).not.toHaveBeenCalled();
  });

  // ─── E4 — falha permanente (efeito possivelmente ocorrido) ────────────────
  // Retry automático reexecutaria o side effect. A linha vai direto para a
  // DLQ, sem consumir tentativa, e NUNCA é marcada como entregue.

  it('erro permanente → dead_letter imediato, sem retry count e sem entregar', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-perm', attempts: 0, claimGeneration: 1 });
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);
    const sender = jest.fn().mockRejectedValue(new OutboxDeliveryUnknownError());

    await expect(dispatchNextOutbox(sender, { onDeadLetter })).resolves.toEqual({
      status: 'dead_letter',
      jobId: 'job-perm',
    });
    expect(markOutboxDeadLetter).toHaveBeenCalledWith('job-perm', 1, 'OUTBOX_DELIVERY_UNKNOWN');
    // Nenhuma tentativa de retry é consumida e o job NUNCA é entregue.
    expect(markOutboxRetry).not.toHaveBeenCalled();
    expect(markOutboxDelivered).not.toHaveBeenCalled();
    expect(onDeadLetter).toHaveBeenCalledTimes(1);
  });

  it('erro permanente sem callback de DLQ não quebra o dispatcher', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-perm-2', attempts: 3, claimGeneration: 2 });

    await expect(dispatchNextOutbox(async () => { throw new OutboxDeliveryUnknownError(); })).resolves.toEqual({
      status: 'dead_letter',
      jobId: 'job-perm-2',
    });
    expect(markOutboxDeadLetter).toHaveBeenCalledWith('job-perm-2', 2, 'OUTBOX_DELIVERY_UNKNOWN');
  });

  it('código da DLQ é sanitizado (sem payload/telefone/texto/token)', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-perm-3', attempts: 0, claimGeneration: 3 });

    await dispatchNextOutbox(async () => { throw new OutboxDeliveryUnknownError(); });

    const [, , code] = markOutboxDeadLetter.mock.calls[0];
    expect(code).toBe('OUTBOX_DELIVERY_UNKNOWN');
    expect(code).not.toMatch(/\+?\d{8,}/);
  });

  // ─── Defer — conflito de claim de idempotência ─────────────────────────────
  // O handler não rodou (a chave segue ativa ou falhou recentemente): não é
  // falha do job. Retry normal agora reenviaria o conflito contra o TTL de
  // 600s do claim e esgotaria o orçamento; DLQ seria prematura. O job volta a
  // `pending` depois do TTL, com a tentativa do claim devolvida.

  it('defer → pending adiado sem markRetry, sem DLQ e sem marcar entrega', async () => {
    // attempts no limite: esperar por uma chave alheia NUNCA pode levar à DLQ.
    claimOutboxJob.mockResolvedValue({ id: 'job-def', attempts: 5, claimGeneration: 4 });
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);
    const sender = jest.fn().mockRejectedValue(new OutboxDeferredError(600));

    await expect(dispatchNextOutbox(sender, { onDeadLetter })).resolves.toEqual({
      status: 'retryable',
      jobId: 'job-def',
    });
    // Adiado depois do TTL do claim, com a tentativa devolvida pelo repositório.
    expect(markOutboxDeferred).toHaveBeenCalledTimes(1);
    expect(markOutboxDeferred).toHaveBeenCalledWith('job-def', 4, 'OUTBOX_SEND_DEFERRED', 600);
    // Nenhum retry ordinário, nenhuma DLQ, nenhuma entrega.
    expect(markOutboxRetry).not.toHaveBeenCalled();
    expect(markOutboxDeadLetter).not.toHaveBeenCalled();
    expect(markOutboxDelivered).not.toHaveBeenCalled();
    expect(onDeadLetter).not.toHaveBeenCalled();
  });

  it('defer sem callback de DLQ não quebra o dispatcher', async () => {
    claimOutboxJob.mockResolvedValue({ id: 'job-def-2', attempts: 2, claimGeneration: 5 });

    await expect(dispatchNextOutbox(async () => { throw new OutboxDeferredError(600); })).resolves.toEqual({
      status: 'retryable',
      jobId: 'job-def-2',
    });
    expect(markOutboxDeferred).toHaveBeenCalledWith('job-def-2', 5, 'OUTBOX_SEND_DEFERRED', 600);
  });
});
