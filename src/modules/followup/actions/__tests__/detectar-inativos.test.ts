/**
 * Unit tests for detectarInativos action.
 */

import { detectarInativos } from '../detectar-inativos';

const mockRunInactivity = jest.fn();

jest.mock('../../services/inactive-service', () => ({
  runInactivityDetection: (...a: unknown[]) => mockRunInactivity(...a),
}));

const ctx = {
  source: 'system' as const,
  clinicId: 'clinic-a',
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test' },
};

describe('detectarInativos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards ctx.clinicId to service.runInactivityDetection', async () => {
    mockRunInactivity.mockResolvedValueOnce({ processed: 1 });
    await detectarInativos.handler({}, ctx as any);
    expect(mockRunInactivity).toHaveBeenCalledWith('clinic-a');
  });
});
