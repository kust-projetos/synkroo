/**
 * Unit tests for executarFollowup action.
 *
 * Tests action → service forwarding with ctx.clinicId.
 */

import { executarFollowup } from '../executar-followup';

const mockExecutarAll = jest.fn();
const mockExecutarPostConsulta = jest.fn();
const mockExecutarLembretesRetorno = jest.fn();

jest.mock('../../services/followup-service', () => ({
  executarAll: (...a: unknown[]) => mockExecutarAll(...a),
  executarPostConsulta: (...a: unknown[]) => mockExecutarPostConsulta(...a),
  executarLembretesRetorno: (...a: unknown[]) => mockExecutarLembretesRetorno(...a),
}));

const ctx = {
  source: 'system' as const,
  clinicId: 'clinic-a',
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test' },
};

describe('executarFollowup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards ctx.clinicId to service.executarAll on type=all', async () => {
    mockExecutarAll.mockResolvedValueOnce({ processed: 1 });
    await executarFollowup.handler({ type: 'all' }, ctx as any);
    expect(mockExecutarAll).toHaveBeenCalledWith('clinic-a');
  });

  it('forwards ctx.clinicId to service.executarPostConsulta on type=post_consultation', async () => {
    mockExecutarPostConsulta.mockResolvedValueOnce({ processed: 1, sent: 1, failed: 0 });
    await executarFollowup.handler({ type: 'post_consultation' }, ctx as any);
    expect(mockExecutarPostConsulta).toHaveBeenCalledWith('clinic-a');
  });

  it('forwards ctx.clinicId to service.executarLembretesRetorno on type=return_reminder', async () => {
    mockExecutarLembretesRetorno.mockResolvedValueOnce({ processed: 0, sent: 0, failed: 0 });
    await executarFollowup.handler({ type: 'return_reminder' }, ctx as any);
    expect(mockExecutarLembretesRetorno).toHaveBeenCalledWith('clinic-a');
  });
});
