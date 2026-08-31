import { bootstrapActions, resetBootstrapForTests } from '@/core/actions/bootstrap';
import {
  getOwnerMergeDispatcher,
  getRegisteredOwnerMergeTypes,
  registerOwnerMerge,
} from '@/modules/crm/services/owner-merge-registry';

describe('owner-merge composition root', () => {
  beforeEach(() => {
    resetBootstrapForTests();
  });

  it('module imports do not register owner adapters', async () => {
    await import('@/modules/comercial');
    await import('@/modules/operacional');

    expect(getRegisteredOwnerMergeTypes()).toEqual([]);
  });

  it('bootstrap registers exactly one adapter for each owner', async () => {
    await bootstrapActions();

    expect(getRegisteredOwnerMergeTypes().sort()).toEqual(['lead', 'patient']);
    expect(getOwnerMergeDispatcher('lead')).toEqual(expect.any(Function));
    expect(getOwnerMergeDispatcher('patient')).toEqual(expect.any(Function));
  });

  it('duplicate adapter registration fails instead of overwriting', () => {
    const dispatcher = async () => true;
    registerOwnerMerge('patient', dispatcher);

    expect(() => registerOwnerMerge('patient', dispatcher)).toThrow(
      'duplicate owner merge adapter: patient',
    );
  });
});
