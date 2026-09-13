const SENSITIVE_KEY =
  /token|secret|password|email|phone|cpf|patient|payload|authorization/i;
function normalizePath(path) {
  const normalized = path.replaceAll("\\", "/");
  return normalized.startsWith("/") && /^[A-Za-z]:/.test(normalized.slice(1))
    ? normalized.slice(1)
    : normalized;
}

export function isCliInvocation(moduleUrl, argvPath) {
  if (!argvPath) return false;
  return normalizePath(new URL(moduleUrl).pathname) === normalizePath(argvPath);
}

const DEFAULT_PATHS = {
  liveness: "/api/health",
  session: "/api/auth/session",
  switchClinic: "/api/auth/switch-clinic",
  protectedRoute: "/dashboard",
  appointments: "/api/appointments",
  invalidWebhook: "/api/messages/inbound",
  readiness: "/api/internal/readiness",
  assets: "/widget.js",
};

export function redactSmokeOutput(value) {
  if (Array.isArray(value)) return value.map(redactSmokeOutput);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactSmokeOutput(item),
    ]),
  );
}

function blocked(name) {
  return {
    name,
    status: "blocked",
    reason: "synthetic staging auth is required",
  };
}

function isSuccess(status) {
  return status >= 200 && status < 300;
}

function isUnauthorized(status) {
  return status === 401 || status === 403 || (status >= 300 && status < 400);
}

async function check(
  baseUrl,
  name,
  path,
  { fetchImpl, expected, validate, ...init } = {},
) {
  try {
    const response = await fetchImpl(new URL(path, baseUrl), {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const statusOk = expected(response.status);
    const bodyOk = validate ? await validate(response) : true;
    return {
      name,
      status: statusOk && bodyOk ? "pass" : "fail",
      httpStatus: response.status,
    };
  } catch (error) {
    return {
      name,
      status: "fail",
      error: error instanceof Error ? error.name : "request_failed",
    };
  }
}
async function validateAgendaTenant(response, clinicId) {
  if (!response.ok) return false;
  const payload = await response.json();
  // A API real envelopa em data; aceitar envelope canônico ou corpo direto.
  const data = payload?.data ?? payload;
  if (!data || !Array.isArray(data.appointments) || !data.pagination)
    return false;
  return data.appointments.every(
    (appointment) => appointment.clinicId === clinicId,
  );
}

export async function runSmoke(baseUrl, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const paths = { ...DEFAULT_PATHS, ...(options.paths ?? {}) };
  const authCookie = options.authCookie ?? process.env.STAGING_AUTH_COOKIE;
  const clinicId = options.clinicId ?? process.env.STAGING_CLINIC_ID;
  const authHeaders = authCookie ? { cookie: authCookie, origin: baseUrl } : undefined;
  const hasSyntheticAuth = Boolean(authCookie && clinicId);
  const checks = [
    () =>
      check(baseUrl, "liveness", paths.liveness, {
        fetchImpl,
        expected: isSuccess,
      }),
    () =>
      check(baseUrl, "invalid-auth", paths.appointments, {
        fetchImpl,
        expected: isUnauthorized,
      }),
    hasSyntheticAuth
      ? () =>
          check(baseUrl, "valid-auth", paths.session, {
            fetchImpl,
            expected: isSuccess,
            headers: authHeaders,
          })
      : () => blocked("valid-auth"),
    hasSyntheticAuth
      ? () =>
          check(baseUrl, "session", paths.session, {
            fetchImpl,
            expected: isSuccess,
            headers: authHeaders,
          })
      : () => blocked("session"),
    hasSyntheticAuth
      ? () =>
          check(baseUrl, "switch-clinic", paths.switchClinic, {
            fetchImpl,
            expected: isSuccess,
            method: "POST",
            headers: { ...authHeaders, "content-type": "application/json" },
            body: JSON.stringify({ clinicId }),
          })
      : () => blocked("switch-clinic"),
    () =>
      check(baseUrl, "route-protection", paths.protectedRoute, {
        fetchImpl,
        expected: isUnauthorized,
      }),
    hasSyntheticAuth
      ? () =>
          check(
            baseUrl,
            "agenda-tenant-scope",
            `${paths.appointments}?limit=50`,
            {
              fetchImpl,
              expected: isSuccess,
              headers: authHeaders,
              validate: (response) => validateAgendaTenant(response, clinicId),
            },
          )
      : () => blocked("agenda-tenant-scope"),
    () =>
      check(baseUrl, "invalid-webhook", paths.invalidWebhook, {
        fetchImpl,
        expected: (status) => status === 400 || status === 403,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    () =>
      check(baseUrl, "protected-readiness", paths.readiness, {
        fetchImpl,
        expected: isUnauthorized,
      }),
    () =>
      check(baseUrl, "assets", paths.assets, {
        fetchImpl,
        expected: isSuccess,
      }),
  ];

  const results = [];
  for (const runCheck of checks) results.push(await runCheck());
  return results.map(redactSmokeOutput);
}

if (isCliInvocation(import.meta.url, process.argv[1])) {
  const baseUrl = process.env.STAGING_BASE_URL;
  if (!baseUrl) throw new Error("STAGING_BASE_URL is required");
  const results = await runSmoke(baseUrl);
  for (const result of results) console.log(JSON.stringify(result));
  if (results.some(({ status }) => status !== "pass")) process.exitCode = 1;
}
