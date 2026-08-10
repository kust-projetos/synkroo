const limit = jest.fn();
const where = jest.fn(() => ({ limit }));
const from = jest.fn(() => ({ where }));
const select = jest.fn(() => ({ from }));

jest.mock('@/lib/db/client', () => ({
  getDb: () => ({ select }),
}));

import { hashChannelSecret, resolveChannelInstallation } from '../resolve-channel-installation';

describe('resolveChannelInstallation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects disabled installations even when the secret matches', async () => {
    limit.mockResolvedValue([]);

    await expect(resolveChannelInstallation({
      installationId: 'disabled-installation',
      providedSecret: 'shared-secret',
    })).resolves.toBeNull();

    expect(limit).toHaveBeenCalledWith(1);
  });

  it('resolves an enabled installation with a matching secret', async () => {
    limit.mockResolvedValue([{
      installationId: 'enabled-installation',
      clinicId: 'clinic-1',
      secretHash: hashChannelSecret('shared-secret'),
    }]);

    await expect(resolveChannelInstallation({
      installationId: 'enabled-installation',
      providedSecret: 'shared-secret',
    })).resolves.toEqual({ installationId: 'enabled-installation', clinicId: 'clinic-1' });
  });
});
