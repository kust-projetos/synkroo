const SENSITIVE_KEY = /token|secret|password|email|phone|cpf|patient|payload|authorization/i;

export function redactSmokeOutput(value) {
  if (Array.isArray(value)) return value.map(redactSmokeOutput);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactSmokeOutput(item),
  ]));
}

async function check(baseUrl, name, path, init = {}) {
  try {
    const response = await fetch(new URL(path, baseUrl), { ...init, signal: AbortSignal.timeout(10_000) });
    return { name, status: response.ok ? 'pass' : 'fail', httpStatus: response.status };
  } catch (error) {
    return { name, status: 'fail', error: error instanceof Error ? error.name : 'request_failed' };
  }
}

export async function runSmoke(baseUrl) {
  const checks = await Promise.all([
    check(baseUrl, 'health', '/api/health'),
    check(baseUrl, 'invalid-auth', '/api/auth/session'),
    check(baseUrl, 'protected-readiness', '/api/internal/readiness'),
    check(baseUrl, 'invalid-webhook', '/api/messages/inbound', { method: 'POST', body: '{}' }),
  ]);
  return checks.map(redactSmokeOutput);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const baseUrl = process.env.STAGING_BASE_URL;
  if (!baseUrl) throw new Error('STAGING_BASE_URL is required');
  const results = await runSmoke(baseUrl);
  for (const result of results) console.log(JSON.stringify(result));
  if (results.some((result) => result.status !== 'pass')) process.exitCode = 1;
}
