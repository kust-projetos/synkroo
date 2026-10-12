/**
 * Unit — invocação do CONSUMER/scheduler sob o pause de manutenção.
 *
 * O gate de manutenção tem autoridade no banco (trigger + claim), mas o
 * scheduler `processOutboxBatch` precisa provar, no nível do consumer, que uma
 * invocação com o controle PAUSADO não produz nenhum dispatch — não apenas o
 * helper de SQL/claim. O teste invoca o worker de verdade (mocks apenas nas
 * bordas: status do controle, dispatcher e manifest) e afirma:
 *   - pausado ⇒ `[]` e ZERO chamadas de dispatch (nenhum claim, nenhum handler);
 *   - rodando ⇒ o scheduler segue despachando (o cheque de pause não é um
 *     bloqueio cego que fabricaria parada);
 *   - falha ao ler o status NÃO fabrica pause: o gate do claim/trigger continua
 *     sendo a autoridade.
 */

const getOutboxControlStatus = jest.fn();
const dispatchNextOutbox = jest.fn();

jest.mock('../control', () => ({
  getOutboxControlStatus: (...args: unknown[]) => getOutboxControlStatus(...args),
}));

jest.mock('../dispatch-outbox', () => ({
  dispatchNextOutbox: (...args: unknown[]) => dispatchNextOutbox(...args),
}));

jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({
    enabledModules: async () => new Set(['financeiro', 'followup', 'atendimento', 'crm']),
  }),
}));

import { processOutboxBatch } from '../worker';

describe('processOutboxBatch — pause do consumo (nível de consumer)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dispatchNextOutbox.mockResolvedValue({ status: 'empty' });
  });

  it('consumer invocation com controle PAUSADO não produz dispatch nenhum', async () => {
    getOutboxControlStatus.mockResolvedValue({ paused: true, epoch: 3, releaseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });

    const results = await processOutboxBatch(5, 2);

    expect(results).toEqual([]);
    // Nenhum dispatch foi sequer tentado: sem claim, sem handler, sem marco.
    expect(dispatchNextOutbox).not.toHaveBeenCalled();
    // Otimização de scheduler: o status foi consultado uma vez.
    expect(getOutboxControlStatus).toHaveBeenCalledTimes(1);
  });

  it('controle RODANDO segue despachando (o cheque de pause não é bloqueio cego)', async () => {
    getOutboxControlStatus.mockResolvedValue({ paused: false, epoch: 3, releaseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    dispatchNextOutbox
      .mockResolvedValueOnce({ status: 'delivered', jobId: 'job-1' })
      .mockResolvedValueOnce({ status: 'empty' });

    const results = await processOutboxBatch(5, 1);

    expect(dispatchNextOutbox).toHaveBeenCalledTimes(2);
    expect(results).toEqual([{ status: 'delivered', jobId: 'job-1' }, { status: 'empty' }]);
  });

  it('falha ao ler o status não fabrica pause — o gate do banco decide', async () => {
    getOutboxControlStatus.mockRejectedValue(new Error('control unavailable'));
    dispatchNextOutbox.mockResolvedValueOnce({ status: 'empty' });

    const results = await processOutboxBatch(1, 1);

    expect(dispatchNextOutbox).toHaveBeenCalledTimes(1);
    expect(results).toEqual([{ status: 'empty' }]);
  });
});
