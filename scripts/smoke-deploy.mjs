/**
 * Smoke pós-deploy determinístico e não destrutivo.
 *
 * Escopo (F5): liveness, pipeline de auth, prontidão do DB, middleware
 * autenticado e limitação documentada dos workers. Somente GETs públicos,
 * sem credenciais e sem mutação.
 *
 * Uso:
 *   SMOKE_BASE_URL=https://<worker-url> node scripts/smoke-deploy.mjs
 *   node scripts/smoke-deploy.mjs https://<worker-url>
 *   node scripts/smoke-deploy.mjs --base-url https://<worker-url>
 *   node scripts/smoke-deploy.mjs --help
 *
 * Complementa (não duplica) scripts/smoke-staging.mjs, que cobre o contrato
 * de staging com auth sintética (STAGING_AUTH_COOKIE / STAGING_CLINIC_ID).
 */

const SENSITIVE_KEY =
  /token|secret|password|email|phone|cpf|patient|payload|authorization|cookie|clinic/i;

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

const DEFAULT_PATHS = Object.freeze({
  liveness: "/api/health",
  session: "/api/auth/session",
  db: "/api/health/db",
  protectedApi: "/api/patients",
});

const REQUEST_TIMEOUT_MS = 10_000;

function isSuccess(status) {
  return status >= 200 && status < 300;
}

function isProtected(status) {
  // Sem sessão, o middleware redireciona rotas protegidas para /login
  // (NextResponse.redirect → 307, ver src/middleware.ts) e as gates de rota
  // respondem 401/403. Qualquer 2xx (vazou dado) ou 404 (rota sumiu) é falha.
  return (
    status === 401 ||
    status === 403 ||
    status === 301 ||
    status === 302 ||
    status === 307 ||
    status === 308
  );
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function timedFetch(fetchImpl, url, init) {
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { response, ms: Date.now() - startedAt };
  } catch (error) {
    return {
      response: null,
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.name : "request_failed",
    };
  }
}

function result(check, ok, extra = {}) {
  return { check, ok, ...extra };
}

async function checkLiveness(baseUrl, paths, fetchImpl) {
  const { response, ms, error } = await timedFetch(
    fetchImpl,
    new URL(paths.liveness, baseUrl),
    { method: "GET" },
  );
  if (!response) return result("liveness", false, { status: null, ms, error });
  const payload = await safeJson(response);
  // Main atual: { status: 'healthy' | 'unhealthy', checks, ... }. Aceitar também o formato legado { status: 'ok' } / { ok: true }.
  const bodyOk =
    payload !== null &&
    (payload.status === "healthy" ||
      payload.status === "ok" ||
      payload.ok === true);
  const ok = response.status === 200 && bodyOk;
  return result("liveness", ok, { status: response.status, ms });
}

async function checkAuthPipeline(baseUrl, paths, fetchImpl) {
  // GET /api/auth/session sem cookie: 200 { authenticated: false } prova que
  // o pipeline Auth.js responde sem precisar de credenciais reais.
  // (POST /api/auth/login foi removido — login é exclusivo do NextAuth.)
  const { response, ms, error } = await timedFetch(
    fetchImpl,
    new URL(paths.session, baseUrl),
    { method: "GET" },
  );
  if (!response)
    return result("auth-pipeline", false, { status: null, ms, error });
  const payload = await safeJson(response);
  const bodyOk =
    payload !== null && typeof payload.authenticated === "boolean";
  const ok =
    (response.status === 200 || response.status === 401) && bodyOk;
  return result("auth-pipeline", ok, { status: response.status, ms });
}

async function checkDb(baseUrl, paths, fetchImpl) {
  // GET /api/health/db (público na main): { data: { status: 'complete' | 'incomplete', ... } }.
  const { response, ms, error } = await timedFetch(
    fetchImpl,
    new URL(paths.db, baseUrl),
    { method: "GET" },
  );
  if (!response) return result("db", false, { status: null, ms, error });
  const payload = await safeJson(response);
  const ok = response.status === 200 && payload?.data?.status === "complete";
  return result("db", ok, { status: response.status, ms });
}

async function checkMiddleware(baseUrl, paths, fetchImpl) {
  // Rota protegida sem sessão deve ser bloqueada: redirect 3xx para /login
  // (comportamento real do middleware) ou 401/403 das gates — prova
  // middleware ativo. 2xx/404 = falha (dado vazou ou rota sumiu).
  // timedFetch usa redirect: "manual" para que o 307 chegue até aqui em vez
  // de ser seguido automaticamente pelo fetch.
  const { response, ms, error } = await timedFetch(
    fetchImpl,
    new URL(paths.protectedApi, baseUrl),
    { method: "GET" },
  );
  if (!response)
    return result("middleware", false, { status: null, ms, error });
  // Drenar o corpo sem registrar conteúdo (evita vazar dados / mantém socket).
  try {
    await response.arrayBuffer();
  } catch {
    // Corpo ilegível não invalida o check — o status já prova o middleware.
  }
  const ok = isProtected(response.status);
  return result("middleware", ok, { status: response.status, ms });
}

async function checkWorkers(options, fetchImpl) {
  // O app chama o ia-bridge via service bindings (RPC interno, sem HTTP
  // público). Sem endpoint público não há o que pingar de fora: o check é
  // registrado como skipped (ok) e a cobertura vem de liveness + db.
  // Override explícito para ambientes que exponham health do bridge:
  const bridgeUrl = options.iaBridgeUrl ?? process.env.SMOKE_IA_BRIDGE_URL;
  if (!bridgeUrl) {
    return result("workers", true, {
      status: null,
      ms: 0,
      skipped: true,
      reason:
        "ia-bridge via service bindings (sem HTTP publico); cobertura via liveness+db",
    });
  }
  const { response, ms, error } = await timedFetch(fetchImpl, bridgeUrl, {
    method: "GET",
  });
  if (!response)
    return result("workers", false, { status: null, ms, error });
  return result("workers", isSuccess(response.status), {
    status: response.status,
    ms,
  });
}

export function smokeFailed(results) {
  return results.some((entry) => entry.ok !== true);
}

export async function runSmokeDeploy(baseUrl, options = {}) {
  if (!baseUrl) throw new Error("baseUrl is required");
  const fetchImpl = options.fetchImpl ?? fetch;
  const paths = { ...DEFAULT_PATHS, ...(options.paths ?? {}) };
  const results = [];
  // Serial de propósito: evita corridas de cold-start no DB/edge.
  results.push(await checkLiveness(baseUrl, paths, fetchImpl));
  results.push(await checkAuthPipeline(baseUrl, paths, fetchImpl));
  results.push(await checkDb(baseUrl, paths, fetchImpl));
  results.push(await checkMiddleware(baseUrl, paths, fetchImpl));
  results.push(await checkWorkers(options, fetchImpl));
  return results.map(redactSmokeOutput);
}

export function resolveBaseUrl(argv = [], env = {}) {
  const help = argv.includes("--help") || argv.includes("-h");
  if (help) return { help: true };
  const flag = argv.find((arg) => arg.startsWith("--base-url="));
  const baseUrl =
    (flag ? flag.slice("--base-url=".length) : null) ??
    argv.find((arg) => !arg.startsWith("-")) ??
    env.SMOKE_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "SMOKE_BASE_URL is required (ou passe --base-url=<url> ou a URL posicional)",
    );
  }
  return { baseUrl };
}

export function printHelp() {
  return [
    "smoke-deploy — smoke pos-deploy deterministico e nao destrutivo",
    "",
    "Uso:",
    "  SMOKE_BASE_URL=https://<worker-url> node scripts/smoke-deploy.mjs",
    "  node scripts/smoke-deploy.mjs https://<worker-url>",
    "  node scripts/smoke-deploy.mjs --base-url https://<worker-url>",
    "",
    "Checks (somente GET, sem credenciais, sem mutacao):",
    "  liveness      GET /api/health        -> 200 { status: 'healthy' }",
    "  auth-pipeline GET /api/auth/session  -> 200/401 { authenticated: bool }",
    "  db            GET /api/health/db     -> 200 { data: { status: 'complete' } }",
    "  middleware    GET /api/patients      -> 401/403/3xx sem sessao",
    "  workers       skipped (service bindings; SMOKE_IA_BRIDGE_URL p/ override)",
    "",
    "Saida: um JSON por linha { check, ok, status, ms }. Exit 1 se algum check falhar.",
  ].join("\n");
}

if (isCliInvocation(import.meta.url, process.argv[1])) {
  const argv = process.argv.slice(2);
  const resolved = resolveBaseUrl(argv, process.env);
  if (resolved.help) {
    console.log(printHelp());
  } else {
    const results = await runSmokeDeploy(resolved.baseUrl);
    for (const entry of results) console.log(JSON.stringify(entry));
    if (smokeFailed(results)) process.exitCode = 1;
  }
}
