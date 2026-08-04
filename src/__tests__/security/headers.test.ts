import nextConfig from '../../../next.config';

test('defines baseline browser security headers', async () => {
  const headers = await nextConfig.headers?.();
  const values = headers?.[0]?.headers ?? [];

  expect(values).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'X-Content-Type-Options', value: 'nosniff' }),
    expect.objectContaining({ key: 'Referrer-Policy' }),
    expect.objectContaining({ key: 'Permissions-Policy' }),
  ]));
});
