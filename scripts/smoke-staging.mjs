const SENSITIVE_KEY = /token|secret|password|email|phone|cpf|patient|payload|authorization/i;
const DEFAULT_PATHS = {
  liveness: '/api/health',
  session: '/api/auth/session',
  switchClinic: '/api/auth/switch-clinic',
  protectedRoute: '/dashboard',
  appointments: '/api/appointments',
  invalidWebhook: '/api/messages/inbound',
  readiness: '/api/internal/readiness',
  assets: '/widget.js',
};

export function redactSmokeOutput(value) {
  if (Array.isArray(value)) return value.map(redactSmokeOutput);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactSmokeOutput(item),
  ]));
}

function blocked(name) {
  return { name, status: 'blocked', reason: 'synthetic staging auth is required' };
}

function isSuccess(status) {
  return status >= 200 && status < 300;
}

function isUnauthorized(status) {
  return status === 401 || status === 403 || (status >= 300 && status < 400);
}

async function check(baseUrl, name, path, { fetchImpl, expected, ...init } = {}) {
  try {
    const response = await fetchImpl(new URL(path, baseUrl), {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });
    return {
      name,
      status: expected(response.status) ? 'pass' : 'fail',
      httpStatus: response.status,
    };
  } catch (error) {
    return { name, status: 'fail', error: error instanceof Error ? error.name : 'request_failed' };
  }
}

export async function runSmoke(baseUrl, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const paths = { ...DEFAULT_PATHS, ...(options.paths ?? {}) };
  const authCookie = options.authCookie ?? process.env.STAGING_AUTH_COOKIE;
  const clinicId = options.clinicId ?? process.env.STAGING_CLINIC_ID;
  const authHeaders = authCookie ? { cookie: authCookie } : undefined;
  const hasSyntheticAuth = Boolean(authCookie && clinicId);
  const checks = [
    check(baseUrl, 'liveness', paths.liveness, { fetchImpl, expected: isSuccess }),
    check(baseUrl, 'invalid-auth', paths.appointments, { fetchImpl, expected: isUnauthorized }),
    hasSyntheticAuth
      ? check(baseUrl, 'valid-auth', paths.session, { fetchImpl, expected: isSuccess, headers: authHeaders })
      : blocked('valid-auth'),
    hasSyntheticAuth
      ? check(baseUrl, 'session', paths.session, { fetchImpl, expected: isSuccess, headers: authHeaders })
      : blocked('session'),
    hasSyntheticAuth
      ? check(baseUrl, 'switch-clinic', paths.switchClinic, {
        fetchImpl,
        expected: isSuccess,
        method: 'POST',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      : blocked('switch-clinic'),
    check(baseUrl, 'route-protection', paths.protectedRoute, { fetchImpl, expected: isUnauthorized }),
    hasSyntheticAuth
      ? check(baseUrl, 'agenda-tenant-scope', paths.appointments, {
        fetchImpl,
        expected: isSuccess,
        headers: authHeaders,
      })
      : blocked('agenda-tenant-scope'),
    check(baseUrl, 'invalid-webhook', paths.invalidWebhook, {
      fetchImpl,
      expected: (status) => status === 400 || status === 403,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }),
    check(baseUrl, 'protected-readiness', paths.readiness, { fetchImpl, expected: isUnauthorized }),
    check(baseUrl, 'assets', paths.assets, { fetchImpl, expected: isSuccess }),
  ];

  return (await Promise.all(checks)).map(redactSmokeOutput);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const baseUrl = process.env.STAGING_BASE_URL;
  if (!baseUrl) throw new Error('STAGING_BASE_URL is required');
  const results = await runSmoke(baseUrl);
  for (const result of results) console.log(JSON.stringify(result));
  if (results.some(({ status }) => status !== 'pass')) process.exitCode = 1;
}
