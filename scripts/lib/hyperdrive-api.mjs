/**
 * scripts/lib/hyperdrive-api.mjs
 *
 * Official Cloudflare Hyperdrive client for operator scripts.
 *
 * Replaces the legacy `wrangler hyperdrive update --password=…` CLI path
 * (see scripts/lib/wrangler-cli.mjs): the database password used to travel as
 * a `--password=<value>` argv element, visible in process listings. Here the
 * password travels ONLY inside the JSON body of an individual HTTPS PATCH —
 * never in argv, never in the URL, never in a log line.
 *
 * Endpoint (partial update — preserves name/caching/mtls/limits):
 *   PATCH https://api.cloudflare.com/client/v4/accounts/{account_id}/hyperdrive/configs/{hyperdrive_id}
 *   { origin: { host, port, database, user, scheme, password[, access_client_id, access_client_secret] } }
 * A total PUT is NEVER used by this module.
 *
 * Access + port are MUTUALLY EXCLUSIVE (proven against the real staging API:
 * PATCH with access_client_id/secret AND an explicit port returns 400 with
 * cf_code 2007 "access credentials cannot be used when a port is set", while
 * the same PATCH without port returns 200). Therefore with Access the PATCH
 * body OMITS the port key entirely; without Access the port is required
 * exactly as before (legacy shape unchanged).
 *
 * Access-protected tunnel origin (D4): with --access the origin host is the
 * tunnel hostname (--origin-host, e.g. stg-pg.synkroo.com.br — never the raw
 * side IP) and the Access service-token pair travels inside the same HTTPS
 * PATCH body (access_client_id + access_client_secret), read SOLELY from
 * CLOUDFLARE_ACCESS_CLIENT_ID / CLOUDFLARE_ACCESS_CLIENT_SECRET in
 * process.env — never argv, never the VPS .env file. With Access the PATCH
 * body OMITS port (the real API rejects port + Access together with 400
 * cf_code 2007); reconcile then skips the port and compares the access FLAG
 * only (presence of access_client_id): the secret is write-only
 * and a rotation keeping the same client id is not observable here.
 *
 * Auth (fail closed, outside the VPS .env file):
 *   CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN from process.env.
 *   --account-id may also be passed explicitly (it is only an identifier,
 *   not a secret). The API token is accepted ONLY via CLOUDFLARE_API_TOKEN
 *   in process.env — never via argv — so it can never appear in process
 *   listings or shell history. Values from the private VPS
 *   env file are NEVER consulted here, so a VPS credential file can never
 *   carry Cloudflare API authority by accident.
 *
 * Secrets policy: error messages carry only the config id, HTTP status,
 * numeric Cloudflare error codes and timeout budget — never request/response
 * bodies, headers, tokens or passwords. Snapshots keep only non-sensitive
 * origin fields (host/port/database/user/scheme/ids); the password is never
 * persisted, only re-supplied from the resolved side settings when a
 * rollback re-PATCH is issued.
 *
 * `fetchImpl` is injectable (precedent: scripts/lib/cron-schedule.mjs) so
 * tests never touch the real API: pass a mock, never call production here.
 */

export const HYPERDRIVE_API_BASE = 'https://api.cloudflare.com/client/v4';
export const DEFAULT_TIMEOUT_MS = 15000;
export const MIN_TIMEOUT_MS = 1000;
export const MAX_TIMEOUT_MS = 120000;

/** Valid --target values: default is staging-only (prod is never a side effect). */
export const HYPERDRIVE_TARGET_KEYS = ['staging', 'prod', 'both'];

export const CF_ACCOUNT_MISSING_CODE = 'SYNKROO_CF_ACCOUNT_MISSING';
export const CF_TOKEN_MISSING_CODE = 'SYNKROO_CF_TOKEN_MISSING';
export const CF_ACCESS_MISSING_CODE = 'SYNKROO_CF_ACCESS_MISSING';
export const CF_CONFIG_INVALID_CODE = 'SYNKROO_CF_CONFIG_INVALID';
export const CF_HTTP_ERROR_CODE = 'SYNKROO_CF_HTTP_ERROR';
export const CF_TIMEOUT_CODE = 'SYNKROO_CF_TIMEOUT';
export const CF_NETWORK_ERROR_CODE = 'SYNKROO_CF_NETWORK_ERROR';
export const CF_RESPONSE_ERROR_CODE = 'SYNKROO_CF_RESPONSE_ERROR';

/**
 * @typedef {object} HyperdriveTargetSpec
 * @property {string} key
 * @property {string} label
 * @property {string} hyperdriveId
 * @property {string} database
 * @property {string} user
 * @property {string} [password]
 */
/**
 * @typedef {object} HyperdriveSnapshot
 * @property {string} hyperdriveId
 * @property {object} origin safe fields only — never a password
 */
/**
 * @typedef {object} HyperdriveTargetOk
 * @property {string} key
 * @property {string} label
 * @property {string} hyperdriveId
 * @property {'ok'} status
 * @property {HyperdriveSnapshot} snapshot
 * @property {boolean} match
 * @property {string[]} diffs
 * @property {object} meta
 */
/**
 * @typedef {object} HyperdriveTargetFailure
 * @property {string} key
 * @property {string} label
 * @property {string} hyperdriveId
 * @property {'failed'} status
 * @property {string} error redacted message, safe to surface
 * @property {string} code
 * @property {string[]} [diffs] present when the failure is a post-PATCH
 *   reconciliation mismatch (fields that differ — safe field names only)
 * @property {HyperdriveSnapshot} [snapshot] pre-update snapshot, present on
 *   reconciliation mismatches so the caller can roll back
 */
/** @typedef {HyperdriveTargetOk | HyperdriveTargetFailure} HyperdriveTargetResult */

/**
 * Operator-facing error carrying a SYNKROO_* code. Messages built here cite
 * only ids, statuses, budgets and key names — never a credential value, a
 * request/response body or a header — so callers may surface them verbatim.
 */
function cfError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Resolves Cloudflare API authority. The account id comes from process.env
 * or an explicit option (it is only an identifier); the API token comes
 * SOLELY from process.env — never from argv, never from the VPS env file.
 *
 * @param {{env?: Record<string,string|undefined>, accountId?: string}} [options]
 * @returns {{accountId: string, apiToken: string}}
 */
export function resolveCloudflareAuth(options = {}) {
  const source = options.env ?? process.env;
  const accountId = String(options.accountId ?? source?.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
  if (!accountId) {
    throw cfError(
      CF_ACCOUNT_MISSING_CODE,
      'CLOUDFLARE_ACCOUNT_ID is missing: set it in process.env or pass --account-id. ' +
        'It is never read from the private VPS .env file.',
    );
  }
  const apiToken = String(source?.CLOUDFLARE_API_TOKEN ?? '').trim();
  if (!apiToken) {
    throw cfError(
      CF_TOKEN_MISSING_CODE,
      'CLOUDFLARE_API_TOKEN is missing: set it in process.env (Hyperdrive Write scope). ' +
        'It is never read from the private VPS .env file and never accepted via argv.',
    );
  }
  return { accountId, apiToken };
}

/**
 * Resolves Cloudflare Access service-token authority for an Access-protected
 * tunnel origin (D4). The client id/secret come SOLELY from process.env —
 * never from argv, never from the private VPS .env file — so they can never
 * appear in process listings, shell history or a VPS credential file.
 *
 * Fail-closed: when --access is requested but either variable is missing or
 * empty, throws SYNKROO_CF_ACCESS_MISSING naming the variables (never values).
 *
 * @param {{env?: Record<string,string|undefined>}} [options] env defaults to
 *   process.env; callers MUST pass process.env (or a test double) — never the
 *   resolved VPS env-file values.
 * @returns {{clientId: string, clientSecret: string}}
 */
export function resolveAccessCredentials(options = {}) {
  const source = options.env ?? process.env;
  const clientId = String(source?.CLOUDFLARE_ACCESS_CLIENT_ID ?? '').trim();
  const clientSecret = String(source?.CLOUDFLARE_ACCESS_CLIENT_SECRET ?? '').trim();
  if (!clientId || !clientSecret) {
    const missing = [
      !clientId ? 'CLOUDFLARE_ACCESS_CLIENT_ID' : null,
      !clientSecret ? 'CLOUDFLARE_ACCESS_CLIENT_SECRET' : null,
    ].filter(Boolean);
    throw cfError(
      CF_ACCESS_MISSING_CODE,
      `${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} missing: set ` +
        'CLOUDFLARE_ACCESS_CLIENT_ID and CLOUDFLARE_ACCESS_CLIENT_SECRET in process.env ' +
        'when using --access. They are never read from the private VPS .env file ' +
        'and never accepted via argv.',
    );
  }
  return { clientId, clientSecret };
}

/**
 * Resolves the effective Hyperdrive origin host for --access runs.
 *
 * Without --access the origin is always the side IP (byte-identical legacy
 * behaviour). With --access the side IP is NOT usable (Cloudflare Access sits
 * in front of the tunnel hostname), so --origin-host (e.g.
 * stg-pg.synkroo.com.br) is REQUIRED — fail-closed when absent. With --access
 * the PATCH body OMITS port (API cf_code 2007) and any supplied port is
 * ignored; without --access the port comes from the side settings (no new
 * port flag exists).
 *
 * @param {{access?: boolean, originHost?: string, sideHost?: string}} [options]
 * @returns {{host: string, access: boolean}}
 */
export function resolveHyperdriveOrigin(options = {}) {
  const access = options.access === true;
  const originHost = String(options.originHost ?? '').trim();
  const sideHost = String(options.sideHost ?? '').trim();
  if (access) {
    if (!originHost) {
      throw cfError(
        CF_CONFIG_INVALID_CODE,
        '--origin-host is required together with --access: an Access-protected ' +
          'tunnel origin makes no sense against the raw side IP. Pass the tunnel ' +
          'hostname via --origin-host (e.g. --origin-host=stg-pg.synkroo.com.br).',
      );
    }
    return { host: originHost, access: true };
  }
  if (originHost) {
    throw cfError(
      CF_CONFIG_INVALID_CODE,
      '--origin-host requires --access: without --access the origin is always the side IP.',
    );
  }
  return { host: sideHost, access: false };
}

/**
 * Validates --target. Default is staging-only so a staging run can never
 * touch production as a side effect.
 *
 * @param {string|undefined} raw
 * @returns {'staging'|'prod'|'both'}
 */
export function resolveHyperdriveTargetKeys(raw) {
  const requested = String(raw ?? 'staging').trim().toLowerCase();
  if (requested === 'staging') return 'staging';
  if (requested === 'prod' || requested === 'production') return 'prod';
  if (requested === 'both') return 'both';
  throw cfError(
    CF_CONFIG_INVALID_CODE,
    `--target="${requested}" is not valid: expected staging, prod or both (default staging).`,
  );
}

/**
 * Validates the API timeout budget in milliseconds.
 *
 * @param {string|number|undefined} raw
 * @param {number} [fallback]
 * @returns {number}
 */
export function normalizeTimeoutMs(raw, fallback = DEFAULT_TIMEOUT_MS) {
  if (raw === undefined) return fallback;
  const ms = Number(String(raw).trim());
  if (!Number.isInteger(ms) || ms < MIN_TIMEOUT_MS || ms > MAX_TIMEOUT_MS) {
    throw cfError(
      CF_CONFIG_INVALID_CODE,
      `timeout is invalid: expected an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}ms.`,
    );
  }
  return ms;
}

/**
 * Builds the PARTIAL PATCH body: { origin } only. The password travels here,
 * inside HTTPS JSON — never argv, never URL.
 *
 * Access + port are MUTUALLY EXCLUSIVE (real staging API: port + access →
 * 400 cf_code 2007; access without port → 200). When BOTH access_client_id
 * and access_client_secret are supplied (non-empty), the body OMITS the port
 * key entirely (any caller-supplied port is ignored, never sent). When both
 * are absent the body is identical to the legacy shape (port required).
 * Supplying only one of the pair fails closed — a half-configured Access
 * origin would otherwise point Hyperdrive at an unreachable tunnel.
 *
 * @param {{host: string, port?: string|number, database: string, user: string, password: string, access_client_id?: string, access_client_secret?: string}} origin
 * @returns {{origin: {host: string, port?: number, database: string, user: string, scheme: string, password: string, access_client_id?: string, access_client_secret?: string}}}
 */
export function buildHyperdrivePatchBody(origin) {
  const host = String(origin?.host ?? '').trim();
  const database = String(origin?.database ?? '').trim();
  const user = String(origin?.user ?? '').trim();
  const password = origin?.password;
  if (!host || !database || !user || typeof password !== 'string' || password.length === 0) {
    throw cfError(
      CF_CONFIG_INVALID_CODE,
      'hyperdrive origin is incomplete: host, database, user and password are required.',
    );
  }
  const accessClientId = String(origin?.access_client_id ?? '').trim();
  const accessClientSecret = typeof origin?.access_client_secret === 'string' ? origin.access_client_secret : '';
  const hasId = accessClientId.length > 0;
  const hasSecret = accessClientSecret.length > 0;
  if (hasId !== hasSecret) {
    throw cfError(
      CF_CONFIG_INVALID_CODE,
      'hyperdrive Access origin is incomplete: access_client_id and access_client_secret are required together.',
    );
  }
  if (hasId && hasSecret) {
    // Access run: port key OMITTED — the API rejects port + access together
    // (400 cf_code 2007). A caller-supplied port (e.g. side PG_PORT) is
    // ignored, never sent.
    return {
      origin: {
        host,
        database,
        user,
        scheme: 'postgres',
        password,
        access_client_id: accessClientId,
        access_client_secret: accessClientSecret,
      },
    };
  }
  const port = Number(origin?.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw cfError(CF_CONFIG_INVALID_CODE, 'hyperdrive origin port is invalid: expected 1-65535.');
  }
  return { origin: { host, port, database, user, scheme: 'postgres', password } };
}

/** Config URL: ids only in the path — credentials never appear here. */
export function hyperdriveConfigUrl(accountId, hyperdriveId) {
  if (!accountId || !hyperdriveId) {
    throw cfError(CF_CONFIG_INVALID_CODE, 'hyperdrive config URL needs account and config ids.');
  }
  return (
    `${HYPERDRIVE_API_BASE}/accounts/${encodeURIComponent(accountId)}` +
    `/hyperdrive/configs/${encodeURIComponent(hyperdriveId)}`
  );
}

/**
 * Redacts known secret values (longest-first) plus generic password shapes
 * from log/error text. Defensive second layer: well-formed callers never put
 * a secret in a logged string in the first place.
 */
export function redactApiSecrets(text, secrets = []) {
  let redacted = String(text ?? '');
  for (const secret of [...secrets].filter(Boolean).sort((a, b) => b.length - a.length)) {
    redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted
    .replace(/"password"\s*:\s*"[^"\n]*"/g, '"password":"[REDACTED]"')
    .replace(/"access_client_secret"\s*:\s*"[^"\n]*"/g, '"access_client_secret":"[REDACTED]"')
    .replace(/--password=\S+/g, '--password=[REDACTED]');
}

/**
 * Non-sensitive origin fields only — safe to log, snapshot and reconcile.
 * `access` is a boolean flag (true when an Access client id is configured);
 * secret VALUES are never carried here. With Access the API omits/defaults
 * the port, so `port` is undefined when no valid port is present (instead of
 * NaN) and safeOriginText renders the host without `:port`.
 */
export function toSafeOrigin(origin) {
  const accessClientId = String(origin?.access_client_id ?? '').trim();
  const access =
    origin?.access === true || origin?.access === false ? origin.access : accessClientId.length > 0;
  const portNum = Number(origin?.port);
  return {
    host: origin?.host,
    port: Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535 ? portNum : undefined,
    database: origin?.database,
    user: origin?.user,
    scheme: origin?.scheme ?? 'postgres',
    access,
  };
}

/** One-line, secret-free origin summary for plans, snapshots and reports. */
export function safeOriginText(origin) {
  const safe = toSafeOrigin(origin);
  const portPart = Number.isInteger(safe.port) ? `:${safe.port}` : '';
  return (
    `host=${safe.host}${portPart} db=${safe.database} user=${safe.user} ` +
    `scheme=${safe.scheme} access=${safe.access === true}`
  );
}

/**
 * Compares desired vs observed non-sensitive origin fields. The password and
 * the Access client secret are never comparable (the API does not return
 * them) and never part of the diff. With Access on either side the port is
 * NOT compared (the API omits/defaults it when Access credentials are set —
 * PATCH with port + access is rejected with cf_code 2007). LIMIT: for Access
 * only the configured FLAG is compared (access_client_id presence / access
 * boolean) — a rotated secret with the same client id still reconciles as
 * equal, so a secret rotation is not observable here and must be verified by
 * connectivity.
 *
 * @returns {{equal: boolean, diffs: string[]}}
 */
export function compareOrigins(want, got) {
  const left = toSafeOrigin(want);
  const right = toSafeOrigin(got);
  const accessRun = left.access === true || right.access === true;
  const fields = accessRun
    ? ['host', 'database', 'user', 'scheme', 'access']
    : ['host', 'port', 'database', 'user', 'scheme', 'access'];
  const diffs = fields.filter((field) => String(left[field]) !== String(right[field]));
  return { equal: diffs.length === 0, diffs };
}

/**
 * fetch with a timeout budget. The budget wins even against a fetchImpl that
 * ignores AbortSignal (Promise.race), so a hung API can never hang a run.
 * NOTE: this covers the fetch dispatch only — response bodies are consumed
 * through responseJsonWithTimeout below, so a stalled body cannot outlive
 * its own budget either.
 */
async function fetchWithTimeout(fetchImpl, url, init, timeoutMs, label) {
  const ms = normalizeTimeoutMs(timeoutMs);
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // best effort: the race below already decides the outcome
      }
      reject(cfError(CF_TIMEOUT_CODE, `Hyperdrive request timed out (${label} after ${ms}ms)`));
    }, ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => fetchImpl(url, { ...init, signal: controller.signal })),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** First numeric Cloudflare error code, or 'unknown' — message text is dropped. */
function firstCfErrorCode(body) {
  try {
    const errors = body?.errors;
    if (Array.isArray(errors)) {
      for (const entry of errors) {
        if (entry !== null && typeof entry === 'object' && Number.isInteger(entry.code)) {
          return String(entry.code);
        }
      }
    }
  } catch {
    // fall through to 'unknown'
  }
  return 'unknown';
}

/**
 * Consumes response.json() under its own timeout budget: a body that never
 * arrives (slowloris-style stall) fails with CF_TIMEOUT_CODE instead of
 * hanging the run past the fetch budget.
 */
async function responseJsonWithTimeout(response, timeoutMs, label) {
  const ms = normalizeTimeoutMs(timeoutMs);
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(cfError(CF_TIMEOUT_CODE, `Hyperdrive request timed out (${label} after ${ms}ms)`));
    }, ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
  try {
    return await Promise.race([response.json(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Low-level Hyperdrive request. Throws coded, redacted errors for HTTP,
 * timeout, network and envelope failures. Never logs, never echoes bodies.
 */
async function requestHyperdrive({
  fetchImpl,
  method,
  accountId,
  apiToken,
  hyperdriveId,
  body,
  timeoutMs,
}) {
  if (typeof fetchImpl !== 'function') {
    throw cfError(CF_CONFIG_INVALID_CODE, 'hyperdrive request needs a fetch implementation.');
  }
  const url = hyperdriveConfigUrl(accountId, hyperdriveId);
  const label = `config ${hyperdriveId}`;
  const init = {
    method,
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  let response;
  try {
    response = await fetchWithTimeout(fetchImpl, url, init, timeoutMs, label);
  } catch (err) {
    if (err instanceof Error && err.code === CF_TIMEOUT_CODE) throw err;
    throw cfError(CF_NETWORK_ERROR_CODE, `Hyperdrive request failed (${label}: unreachable)`);
  }
  if (!response || !response.ok) {
    const status = response?.status ?? 'unknown';
    let suffix = '';
    try {
      const failure = response && typeof response.json === 'function'
        ? await responseJsonWithTimeout(response, timeoutMs, `failure body config ${hyperdriveId}`)
        : null;
      suffix = `, cf_code ${firstCfErrorCode(failure)}`;
    } catch (err) {
      if (err instanceof Error && err.code === CF_TIMEOUT_CODE) throw err;
      // unreadable failure body: status alone is the report (never raw text)
    }
    throw cfError(CF_HTTP_ERROR_CODE, `Hyperdrive ${method} failed (${label}: HTTP ${status}${suffix})`);
  }
  let envelope;
  try {
    envelope = await responseJsonWithTimeout(response, timeoutMs, `${label} body`);
  } catch (err) {
    if (err instanceof Error && err.code === CF_TIMEOUT_CODE) throw err;
    throw cfError(CF_RESPONSE_ERROR_CODE, 'Hyperdrive API returned an unreadable response body.');
  }
  if (envelope && envelope.success === false) {
    throw cfError(
      CF_RESPONSE_ERROR_CODE,
      `Hyperdrive ${method} rejected (${label}: cf_code ${firstCfErrorCode(envelope)})`,
    );
  }
  return envelope?.result ?? envelope;
}

/** Picks non-sensitive observed metadata (pool/restart effects) when present. */
function extractObservedMeta(result) {
  const meta = {};
  if (result !== null && typeof result === 'object') {
    if (typeof result.name === 'string') meta.name = result.name;
    for (const key of ['restarted_on', 'modified_on', 'created_on']) {
      if (typeof result[key] === 'string') meta[key] = result[key];
    }
    if (result.caching !== undefined) meta.caching = result.caching;
  }
  return meta;
}

/**
 * GETs one Hyperdrive config and returns only safe fields.
 *
 * @returns {Promise<{id: string, name?: string, origin: object, meta: object}>}
 */
export async function getHyperdriveConfig({ fetchImpl, accountId, apiToken, hyperdriveId, timeoutMs }) {
  const result = await requestHyperdrive({
    fetchImpl,
    method: 'GET',
    accountId,
    apiToken,
    hyperdriveId,
    timeoutMs,
  });
  if (result === null || typeof result !== 'object' || result.origin === null || typeof result.origin !== 'object') {
    throw cfError(CF_RESPONSE_ERROR_CODE, `Hyperdrive GET returned no result (config ${hyperdriveId})`);
  }
  return {
    id: typeof result.id === 'string' ? result.id : hyperdriveId,
    ...(typeof result.name === 'string' ? { name: result.name } : {}),
    origin: toSafeOrigin(result.origin),
    meta: extractObservedMeta(result),
  };
}

/**
 * PATCHes one Hyperdrive origin (partial — name/caching/mtls/limits kept).
 *
 * @returns {Promise<{id: string, origin: object, meta: object}>} safe fields only
 */
export async function patchHyperdriveOrigin({
  fetchImpl,
  accountId,
  apiToken,
  hyperdriveId,
  origin,
  timeoutMs,
}) {
  const patchBody = buildHyperdrivePatchBody(origin);
  const result = await requestHyperdrive({
    fetchImpl,
    method: 'PATCH',
    accountId,
    apiToken,
    hyperdriveId,
    body: patchBody,
    timeoutMs,
  });
  const observed = result !== null && typeof result === 'object' ? result : {};
  return {
    id: typeof observed.id === 'string' ? observed.id : hyperdriveId,
    origin: toSafeOrigin({ ...patchBody.origin, ...(observed.origin ?? {}) }),
    meta: extractObservedMeta(observed),
  };
}

/**
 * Dry-run plan lines. Takes NO password/token/fetch by construction, so a
 * plan can neither mutate nor leak — redaction is structural, not textual.
 * Access secrets are never plan inputs: only the access FLAG is shown
 * (access=true/false), never ids or secret values.
 *
 * @param {{targets: Array<{key: string, label: string, hyperdriveId: string, database: string, user: string, accessClientId?: string, access?: boolean}>, side: string, host: string, port: number, accountId: string, access?: boolean}} plan
 * @returns {string[]}
 */
export function planHyperdriveUpdates({ targets, side, host, port, accountId, access }) {
  const planAccess =
    access === true || access === false
      ? access
      : (targets ?? []).some(
          (target) =>
            target?.access === true || String(target?.accessClientId ?? target?.access_client_id ?? '').trim().length > 0,
        );
  return (targets ?? []).map((target) => {
    // Access runs omit the port (API rejects port + access together with
    // cf_code 2007); legacy runs keep the explicit port.
    const planOrigin = planAccess
      ? { host, database: target.database, user: target.user, access: planAccess }
      : { host, port, database: target.database, user: target.user, access: planAccess };
    return (
      `[dry-run] Would PATCH ${target.label} (${target.hyperdriveId}) ` +
      `account=${accountId} ${safeOriginText(planOrigin)} ` +
      `[side=${side}]`
    );
  });
}

/** Reads optional Access credentials off a target spec (camelCase canonical). */
function targetAccess(target) {
  const clientId = String(target?.accessClientId ?? target?.access_client_id ?? '').trim();
  const clientSecret =
    typeof (target?.accessClientSecret ?? target?.access_client_secret) === 'string'
      ? target.accessClientSecret ?? target.access_client_secret
      : '';
  if (!clientId && !clientSecret) return {};
  return { access_client_id: clientId, access_client_secret: clientSecret };
}

/**
 * Applies ONE target: snapshot (GET) → PATCH → reconcile (GET + compare).
 * The snapshot holds safe fields only; the password is never persisted.
 *
 * Access: pass clientId/clientSecret via the target spec
 * (accessClientId/accessClientSecret) or via options.access
 * ({clientId, clientSecret}); both are fail-closed as a pair by
 * buildHyperdrivePatchBody. The reconcile compares the access FLAG only —
 * the secret value is never observable (see compareOrigins limit).
 *
 * @param {{fetchImpl: Function, accountId: string, apiToken: string, target: HyperdriveTargetSpec, host: string, port: number|string, timeoutMs?: number, access?: {clientId?: string, clientSecret?: string}}} options
 * @returns {Promise<HyperdriveTargetOk>}
 */
export async function applyHyperdriveTarget({
  fetchImpl,
  accountId,
  apiToken,
  target,
  host,
  port,
  timeoutMs,
  access,
}) {
  const fromTarget = targetAccess(target);
  const accessClientId = String(access?.clientId ?? fromTarget.access_client_id ?? '').trim();
  const accessClientSecret =
    typeof (access?.clientSecret ?? fromTarget.access_client_secret) === 'string'
      ? (access?.clientSecret ?? fromTarget.access_client_secret)
      : '';
  const want = {
    host,
    port,
    database: target.database,
    user: target.user,
    password: target.password,
    scheme: 'postgres',
    ...(accessClientId || accessClientSecret
      ? { access_client_id: accessClientId, access_client_secret: accessClientSecret }
      : {}),
  };
  const snapshot = await getHyperdriveConfig({
    fetchImpl,
    accountId,
    apiToken,
    hyperdriveId: target.hyperdriveId,
    timeoutMs,
  });
  await patchHyperdriveOrigin({
    fetchImpl,
    accountId,
    apiToken,
    hyperdriveId: target.hyperdriveId,
    origin: want,
    timeoutMs,
  });
  const observed = await getHyperdriveConfig({
    fetchImpl,
    accountId,
    apiToken,
    hyperdriveId: target.hyperdriveId,
    timeoutMs,
  });
  const { equal, diffs } = compareOrigins(want, observed.origin);
  return {
    key: target.key,
    label: target.label,
    hyperdriveId: target.hyperdriveId,
    snapshot: { hyperdriveId: snapshot.id, origin: snapshot.origin },
    match: equal,
    diffs,
    meta: observed.meta,
  };
}

/**
 * Sequential multi-target apply. A failure in one target NEVER skips the
 * snapshot of the next decision: every result is collected and the caller
 * gets an explicit allOk/partial verdict instead of an ambiguous throw.
 * Re-running the same command is safe (idempotent PATCH of the same origin).
 *
 * A post-PATCH reconciliation mismatch (match=false) is a FAILURE, not a
 * success: the PATCH was applied but the API state does not equal the
 * desired origin, so the result is recorded with status 'failed' (code
 * SYNKROO_CF_RESPONSE_ERROR) carrying the safe diffs and the pre-update
 * snapshot for rollback — and allOk is false so the CLI exits non-zero.
 *
 * @param {{fetchImpl: Function, accountId: string, apiToken: string, targets: HyperdriveTargetSpec[], host: string, port: number|string, timeoutMs?: number, access?: {clientId?: string, clientSecret?: string}}} options
 * @returns {Promise<{results: HyperdriveTargetResult[], allOk: boolean, partial: boolean}>}
 */
export async function applyHyperdriveTargets({
  fetchImpl,
  accountId,
  apiToken,
  targets,
  host,
  port,
  timeoutMs,
  access,
}) {
  const results = [];
  for (const target of targets ?? []) {
    try {
      const applied = await applyHyperdriveTarget({
        fetchImpl,
        accountId,
        apiToken,
        target,
        host,
        port,
        timeoutMs,
        ...(access === undefined ? {} : { access }),
      });
      if (!applied.match) {
        results.push({
          key: applied.key,
          label: applied.label,
          hyperdriveId: applied.hyperdriveId,
          status: 'failed',
          error:
            `Reconciliation failed for ${applied.label} (${applied.hyperdriveId}): ` +
            `API state differs in [${applied.diffs.join(', ')}] after PATCH. ` +
            'Re-run this command (idempotent) or roll back with the previous --side for this target.',
          code: CF_RESPONSE_ERROR_CODE,
          diffs: applied.diffs,
          snapshot: applied.snapshot,
        });
        continue;
      }
      results.push({ ...applied, status: 'ok' });
    } catch (err) {
      results.push({
        key: target?.key ?? 'unknown',
        label: target?.label ?? 'unknown',
        hyperdriveId: target?.hyperdriveId ?? 'unknown',
        status: 'failed',
        error: err instanceof Error ? err.message : 'unknown error',
        code: err instanceof Error && typeof err.code === 'string' ? err.code : 'UNKNOWN',
      });
    }
  }
  const allOk = results.length > 0 && results.every((result) => result.status === 'ok');
  const partial = results.some((result) => result.status === 'ok') && results.some((result) => result.status === 'failed');
  return { results, allOk, partial };
}

/**
 * Rollback: re-PATCHes a previously snapshotted safe origin together with the
 * supplied (previously valid) password, then reconciles. The snapshot never
 * contains a password — the caller re-supplies it from side settings.
 * Access rollback needs the previously valid service-token pair as well
 * (snapshot carries only the access FLAG, never values): pass
 * access {clientId, clientSecret} when the snapshot has access=true.
 *
 * Fail-closed mode check BEFORE any PATCH (no fetch is issued on mismatch):
 * an access=true snapshot REQUIRES the complete pair (missing/half pair
 * throws naming the variables, never values — otherwise the rollback would
 * silently convert an Access origin into a legacy IP:port origin); a legacy
 * (access falsy) snapshot REJECTS any Access pair (otherwise the rollback
 * would silently convert a legacy origin into an Access origin).
 *
 * @param {{fetchImpl: Function, accountId: string, apiToken: string, snapshot: HyperdriveSnapshot, password: string, timeoutMs?: number, access?: {clientId?: string, clientSecret?: string}}} options
 * @returns {Promise<{hyperdriveId: string, match: boolean, diffs: string[], meta: object}>}
 */
export async function rollbackHyperdriveTarget({
  fetchImpl,
  accountId,
  apiToken,
  snapshot,
  password,
  timeoutMs,
  access,
}) {
  if (!snapshot || !snapshot.hyperdriveId || !snapshot.origin) {
    throw cfError(CF_CONFIG_INVALID_CODE, 'rollback needs a snapshot with hyperdriveId and origin.');
  }
  const snapshotAccess = snapshot.origin.access === true;
  const accessClientId = String(access?.clientId ?? '').trim();
  const accessClientSecret = typeof access?.clientSecret === 'string' ? access.clientSecret : '';
  const hasId = accessClientId.length > 0;
  const hasSecret = accessClientSecret.length > 0;
  if (snapshotAccess) {
    if (!hasId || !hasSecret) {
      const missing = [
        !hasId ? 'CLOUDFLARE_ACCESS_CLIENT_ID' : null,
        !hasSecret ? 'CLOUDFLARE_ACCESS_CLIENT_SECRET' : null,
      ].filter(Boolean);
      throw cfError(
        CF_ACCESS_MISSING_CODE,
        `rollback needs the previously valid Access pair for an access=true snapshot: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} missing — ` +
          'pass access {clientId, clientSecret}, read from CLOUDFLARE_ACCESS_CLIENT_ID and ' +
          'CLOUDFLARE_ACCESS_CLIENT_SECRET in process.env (never argv, never the VPS .env file).',
      );
    }
  } else if (hasId || hasSecret) {
    throw cfError(
      CF_CONFIG_INVALID_CODE,
      'rollback rejects the Access pair for a legacy (access falsy) snapshot: pass no access ' +
        'credentials to restore a non-Access origin.',
    );
  }
  await patchHyperdriveOrigin({
    fetchImpl,
    accountId,
    apiToken,
    hyperdriveId: snapshot.hyperdriveId,
    origin: {
      ...snapshot.origin,
      password,
      ...(accessClientId || accessClientSecret
        ? { access_client_id: accessClientId, access_client_secret: accessClientSecret }
        : {}),
    },
    timeoutMs,
  });
  const observed = await getHyperdriveConfig({
    fetchImpl,
    accountId,
    apiToken,
    hyperdriveId: snapshot.hyperdriveId,
    timeoutMs,
  });
  const { equal, diffs } = compareOrigins({ ...snapshot.origin }, observed.origin);
  return { hyperdriveId: snapshot.hyperdriveId, match: equal, diffs, meta: observed.meta };
}
