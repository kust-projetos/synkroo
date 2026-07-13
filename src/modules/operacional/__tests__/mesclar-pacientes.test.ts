jest.mock('@/lib/db/client', () => {
  const { mockDb } = jest.requireActual('@/test-utils/db-mock');
  return { getDb: jest.fn(() => mockDb), closeDb: jest.fn() };
});

import { mesclarPacientes } from '@/modules/operacional/actions';
import { operacionalActions } from '@/modules/operacional';

describe('Operacional — patient merge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defines the internal merge action with correct permission', () => {
    expect(mesclarPacientes).toMatchObject({
      name: 'operacional.mesclarPacientes',
      module: 'operacional',
      requires: 'operacional:manage_patients',
    });
  });

  it('does not expose the merge action in the public action array', () => {
    const names = operacionalActions.map((a) => a.name);
    expect(names).not.toContain('operacional.mesclarPacientes');
  });

  it('registers handler with shape expected by CRM coordinator', () => {
    expect(mesclarPacientes.handler).toBeInstanceOf(Function);
    expect(mesclarPacientes.input).toBeDefined();
  });
});
