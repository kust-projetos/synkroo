import { parseRuntimeEnv } from '../runtime-env';

describe('F6.13 sidecar env fail-closed', () => {
  test('requires SIDECAR_SHARED_SECRET', () => {
    expect(() => parseRuntimeEnv('sidecar', {} as any)).toThrow(/SIDECAR_SHARED_SECRET|invalid required fields/);
  });

  test('requires SIDECAR_EGRESS_ALLOWLIST and DEFAULT_OFF', () => {
    expect(() =>
      parseRuntimeEnv('sidecar', {
        SIDECAR_SHARED_SECRET: 'a'.repeat(32),
      } as any),
    ).toThrow(/SIDECAR_EGRESS_ALLOWLIST/);
  });

  test('parses when all sidecar fields present', () => {
    const out = parseRuntimeEnv('sidecar', {
      SIDECAR_SHARED_SECRET: 'a'.repeat(32),
      SIDECAR_EGRESS_ALLOWLIST: 'https://allowed.com',
      SIDECAR_DEFAULT_OFF: 'true',
    } as any);
    expect((out as any).SIDECAR_DEFAULT_OFF).toBe('true');
  });

  test('app runtime requires AUTH_SECRET/JWT_SECRET', () => {
    expect(() =>
      parseRuntimeEnv('app', { NODE_ENV: 'production', JWT_SECRET: 'short' } as any),
    ).toThrow(/AUTH_SECRET|JWT_SECRET|invalid required fields/);
  });
});
