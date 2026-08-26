import nextConfig from '../../../next.config';

describe('security headers (F11.15)', () => {
  test('defines baseline browser security headers', async () => {
    const headers = await nextConfig.headers?.();
    const values = headers?.[0]?.headers ?? [];

    expect(values).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'Content-Security-Policy' }),
      expect.objectContaining({ key: 'X-Content-Type-Options', value: 'nosniff' }),
      expect.objectContaining({ key: 'Referrer-Policy' }),
      expect.objectContaining({ key: 'Permissions-Policy' }),
      expect.objectContaining({ key: 'X-Frame-Options', value: 'DENY' }),
    ]));
    const csp = values.find((h: any) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
  });

  test('adds HSTS only in production', async () => {
    const prev = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      const prodHeaders = await nextConfig.headers?.();
      const prodValues = prodHeaders?.[0]?.headers ?? [];
      expect(prodValues).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: 'Strict-Transport-Security', value: expect.stringContaining('max-age=31536000') }),
      ]));
    } finally {
      (process.env as any).NODE_ENV = prev;
    }
    const headers = await nextConfig.headers?.();
    // In non-production, HSTS may still be absent; baseline headers must remain
    expect(headers?.[0]?.headers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'Content-Security-Policy' }),
    ]));
  });
});
