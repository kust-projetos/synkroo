const limit = jest.fn();
const where = jest.fn(() => ({ limit }));
const from = jest.fn(() => ({ where }));
const select = jest.fn(() => ({ from }));
const execute = jest.fn();

jest.mock('@/lib/db/client', () => ({
  getDb: () => ({ select, execute }),
}));

import {
  hashChannelSecret,
  resolveChannelInstallation,
  resolveEnabledChannelInstallation,
  resolveWidgetInstallation,
  resolveMetaInstallation,
  isAllowedWidgetOrigin,
} from '../resolve-channel-installation';

describe('resolveChannelInstallation suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveChannelInstallation', () => {
    it('returns null immediately when installationId or providedSecret is missing', async () => {
      await expect(resolveChannelInstallation({ installationId: '', providedSecret: 'secret' })).resolves.toBeNull();
      await expect(resolveChannelInstallation({ installationId: 'inst-1', providedSecret: '' })).resolves.toBeNull();
      expect(select).not.toHaveBeenCalled();
    });

    it('rejects disabled installations even when the secret matches', async () => {
      limit.mockResolvedValue([]);

      await expect(resolveChannelInstallation({
        installationId: 'disabled-installation',
        providedSecret: 'shared-secret',
      })).resolves.toBeNull();

      expect(limit).toHaveBeenCalledWith(1);
    });

    it('rejects when secret does not match stored hash', async () => {
      limit.mockResolvedValue([{
        installationId: 'enabled-inst',
        clinicId: 'clinic-1',
        secretHash: hashChannelSecret('correct-secret'),
      }]);

      await expect(resolveChannelInstallation({
        installationId: 'enabled-inst',
        providedSecret: 'wrong-secret',
      })).resolves.toBeNull();
    });

    it('rejects safely when stored secretHash is malformed or invalid', async () => {
      limit.mockResolvedValue([{
        installationId: 'enabled-inst',
        clinicId: 'clinic-1',
        secretHash: 'invalid-non-hex-hash',
      }]);

      await expect(resolveChannelInstallation({
        installationId: 'enabled-inst',
        providedSecret: 'shared-secret',
      })).resolves.toBeNull();
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
        provider: 'evolution',
      })).resolves.toEqual({ installationId: 'enabled-installation', clinicId: 'clinic-1' });
    });

    it('fails closed and logs sanitized error when DB query fails', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      limit.mockRejectedValue(new Error('Connection timeout to PostgreSQL'));

      await expect(resolveChannelInstallation({
        installationId: 'enabled-installation',
        providedSecret: 'shared-secret',
      })).resolves.toBeNull();

      expect(errorSpy).toHaveBeenCalledWith(
        '[resolveChannelInstallation] DB lookup failed',
      );
      errorSpy.mockRestore();
    });

    it('never leaks internal DB details into logs on failure', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const sensitive = new Error('connect postgres://synkroo:super-secret-pw@187.77.249.47:15432/synkroo at channel_installations');
      (sensitive as Error & { stack?: string }).stack = 'Error: secret-stack-trace with password=super-secret-pw';
      limit.mockRejectedValue(sensitive);

      await expect(resolveChannelInstallation({
        installationId: 'enabled-installation',
        providedSecret: 'shared-secret',
      })).resolves.toBeNull();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const logged = errorSpy.mock.calls.map((args) => args.map(String).join(' ')).join('\n');
      expect(logged).not.toContain('super-secret-pw');
      expect(logged).not.toContain('channel_installations');
      expect(logged).not.toContain('secret-stack-trace');
      errorSpy.mockRestore();
    });

    it('fails closed when the DB rejects with a non-Error value', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      limit.mockRejectedValue('string-rejection-with-internal-detail');

      await expect(resolveChannelInstallation({
        installationId: 'enabled-installation',
        providedSecret: 'shared-secret',
      })).resolves.toBeNull();

      expect(errorSpy).toHaveBeenCalledWith(
        '[resolveChannelInstallation] DB lookup failed',
      );
      errorSpy.mockRestore();
    });

    it('rejects when the stored row has no secretHash (invalid installation)', async () => {
      limit.mockResolvedValue([{
        installationId: 'enabled-inst',
        clinicId: 'clinic-1',
        secretHash: null,
      }]);

      await expect(resolveChannelInstallation({
        installationId: 'enabled-inst',
        providedSecret: 'shared-secret',
      })).resolves.toBeNull();
    });

    it('rejects when installationId is unknown (no row returned)', async () => {
      limit.mockResolvedValue([]);

      await expect(resolveChannelInstallation({
        installationId: 'ghost-installation',
        providedSecret: 'shared-secret',
      })).resolves.toBeNull();
    });
  });

  describe('resolveEnabledChannelInstallation', () => {
    it('returns null when input fields are missing', async () => {
      await expect(resolveEnabledChannelInstallation({ installationId: '', provider: 'meta' })).resolves.toBeNull();
      await expect(resolveEnabledChannelInstallation({ installationId: 'inst-1', provider: '' })).resolves.toBeNull();
      expect(select).not.toHaveBeenCalled();
    });

    it('resolves enabled installation successfully', async () => {
      limit.mockResolvedValue([{ installationId: 'inst-1', clinicId: 'clinic-1' }]);
      await expect(resolveEnabledChannelInstallation({ installationId: 'inst-1', provider: 'meta' })).resolves.toEqual({
        installationId: 'inst-1',
        clinicId: 'clinic-1',
      });
    });

    it('returns null when installation is not found', async () => {
      limit.mockResolvedValue([]);
      await expect(resolveEnabledChannelInstallation({ installationId: 'not-found', provider: 'meta' })).resolves.toBeNull();
    });

    it('fails closed on DB error', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      limit.mockRejectedValue(new Error('DB unreachable'));
      await expect(resolveEnabledChannelInstallation({ installationId: 'inst-1', provider: 'meta' })).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        '[resolveEnabledChannelInstallation] DB lookup failed',
      );
      errorSpy.mockRestore();
    });

    it('fails closed without leaking details when DB error carries secrets', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      limit.mockRejectedValue(new Error('password authentication failed for user "synkroo_staging" password=hunter2'));
      await expect(resolveEnabledChannelInstallation({ installationId: 'inst-1', provider: 'meta' })).resolves.toBeNull();
      const logged = errorSpy.mock.calls.map((args) => args.map(String).join(' ')).join('\n');
      expect(logged).not.toContain('hunter2');
      errorSpy.mockRestore();
    });
  });

  describe('isAllowedWidgetOrigin', () => {
    it('allows valid HTTPS origins', () => {
      expect(isAllowedWidgetOrigin('https://example.com')).toBe(true);
      expect(isAllowedWidgetOrigin('https://portal.clinic.com.br')).toBe(true);
    });

    it('rejects HTTP, invalid URLs, and origins with paths', () => {
      expect(isAllowedWidgetOrigin('')).toBe(false);
      expect(isAllowedWidgetOrigin('http://insecure.com')).toBe(false);
      expect(isAllowedWidgetOrigin('not-a-url')).toBe(false);
      expect(isAllowedWidgetOrigin('https://example.com/path')).toBe(false);
    });
  });

  describe('resolveWidgetInstallation', () => {
    it('returns null on invalid input or disallowed protocol', async () => {
      await expect(resolveWidgetInstallation('', 'https://example.com')).resolves.toBeNull();
      await expect(resolveWidgetInstallation('widget-1', 'http://insecure.com')).resolves.toBeNull();
    });

    it('resolves widget installation when origin is in allowedOrigins', async () => {
      limit.mockResolvedValue([{
        installationId: 'widget-1',
        clinicId: 'clinic-1',
        allowedOrigins: ['https://example.com', 'https://other.com'],
      }]);

      await expect(resolveWidgetInstallation('widget-1', 'https://example.com')).resolves.toEqual({
        installationId: 'widget-1',
        clinicId: 'clinic-1',
        allowedOrigins: ['https://example.com', 'https://other.com'],
      });
    });

    it('returns null when origin is not in allowedOrigins', async () => {
      limit.mockResolvedValue([{
        installationId: 'widget-1',
        clinicId: 'clinic-1',
        allowedOrigins: ['https://allowed.com'],
      }]);

      await expect(resolveWidgetInstallation('widget-1', 'https://attacker.com')).resolves.toBeNull();
    });

    it('fails closed on DB error', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      limit.mockRejectedValue(new Error('DB error'));
      await expect(resolveWidgetInstallation('widget-1', 'https://example.com')).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        '[resolveWidgetInstallation] DB lookup failed',
      );
      errorSpy.mockRestore();
    });

    it('returns null when stored allowedOrigins diverge from the request payload', async () => {
      limit.mockResolvedValue([{
        installationId: 'widget-1',
        clinicId: 'clinic-1',
        allowedOrigins: null,
      }]);
      await expect(resolveWidgetInstallation('widget-1', 'https://example.com')).resolves.toBeNull();

      limit.mockResolvedValue([{
        installationId: 'widget-1',
        clinicId: 'clinic-1',
        allowedOrigins: 'https://example.com',
      }]);
      await expect(resolveWidgetInstallation('widget-1', 'https://example.com')).resolves.toBeNull();
    });
  });

  describe('resolveMetaInstallation', () => {
    it('returns null for empty phoneNumberId', async () => {
      await expect(resolveMetaInstallation('')).resolves.toBeNull();
      expect(select).not.toHaveBeenCalled();
    });

    it('resolves from channel_installations table', async () => {
      limit.mockResolvedValue([{ installationId: 'phone-123', clinicId: 'clinic-1' }]);
      await expect(resolveMetaInstallation('phone-123')).resolves.toEqual({
        installationId: 'phone-123',
        clinicId: 'clinic-1',
      });
    });

    it('resolves from clinic settings fallback when not in channel_installations', async () => {
      limit.mockResolvedValue([]);
      execute.mockResolvedValue({ rows: [{ clinic_id: 'clinic-fallback-id' }] });

      await expect(resolveMetaInstallation('phone-fallback')).resolves.toEqual({
        installationId: 'phone-fallback',
        clinicId: 'clinic-fallback-id',
      });
    });

    it('returns null when not found anywhere', async () => {
      limit.mockResolvedValue([]);
      execute.mockResolvedValue({ rows: [] });

      await expect(resolveMetaInstallation('unknown-phone')).resolves.toBeNull();
    });

    it('fails closed on DB error', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      limit.mockRejectedValue(new Error('DB network failure'));
      await expect(resolveMetaInstallation('phone-123')).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        '[resolveMetaInstallation] DB lookup failed',
      );
      errorSpy.mockRestore();
    });

    it('fails closed when the settings-fallback query throws (divergent payload)', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      limit.mockResolvedValue([]);
      execute.mockRejectedValue(new Error('relation "clinics" does not exist'));
      await expect(resolveMetaInstallation('phone-divergent')).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        '[resolveMetaInstallation] DB lookup failed',
      );
      const logged = errorSpy.mock.calls.map((args) => args.map(String).join(' ')).join('\n');
      expect(logged).not.toContain('clinics');
      errorSpy.mockRestore();
    });
  });
});
