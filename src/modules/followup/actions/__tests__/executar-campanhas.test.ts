/**
 * Unit tests for executarCampanhas action.
 */

import { executarCampanhas } from '../executar-campanhas';

const mockExecutarCampanhas = jest.fn();

jest.mock('../../services/campaign-service', () => ({
  executarCampanhas: (...a: unknown[]) => mockExecutarCampanhas(...a),
}));

const ctx = {
  source: 'system' as const,
  clinicId: 'clinic-a',
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test' },
};

describe('executarCampanhas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards ctx.clinicId to service.executarCampanhas', async () => {
    mockExecutarCampanhas.mockResolvedValueOnce({ processed: 1 });
    await executarCampanhas.handler({}, ctx as any);
    expect(mockExecutarCampanhas).toHaveBeenCalledWith('clinic-a');
  });
});
