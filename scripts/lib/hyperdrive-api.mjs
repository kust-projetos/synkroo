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
 *   { origin: { host, port, database, user, scheme, password } }
 * A total PUT is NEVER used by this module.
 *
 * Auth (fail closed, outside the VPS .env file):
 *   CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN from process.env (preferred)
 *   or explicit --account-id / --api-token flags. Values from the private VPS
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
 * Resolves Cloudflare API authority. process.env wins over nothing else:
 * the VPS env file values are deliberately NOT consulted.
 *
 * @param {{env?: Record<string,string|undefined>, accountId?: string, apiToken?: string}} [options]
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
  const apiToken = String(options.apiToken ?? source?.CLOUDFLARE_API_TOKEN ?? '').trim();
  if (!apiToken) {
    throw cfError(
      CF_TOKEN_MISSING_CODE,
      'CLOUDFLARE_API_TOKEN is missing: set it in process.env (Hyperdrive Write) or pass --api-token. ' +
        'It is never read from the private VPS .env file.',
    );
  }
  return { accountId, apiToken };
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
 * @param {{host: string, port: string|number, database: string, user: string, password: string}} origin
 * @returns {{origin: {host: string, port: number, database: string, user: string, scheme: string, password: string}}}
 */
export function buildHyperdrivePatchBody(origin) {
  const host = String(origin?.host ?? '').trim();
  const database = String(origin?.database ?? '').trim();
  const user = String(origin?.user ?? '').trim();
  const password = origin?.password;
  const port = Number(origin?.port);
  if (!host || !database || !user || typeof password !== 'string' || password.length === 0) {
    throw cfError(
      CF_CONFIG_INVALID_CODE,
      'hyperdrive origin is incomplete: host, database, user and password are required.',
    );
  }
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
    .replace(/--password=\S+/g, '--password=[REDACTED]');
}

/** Non-sensitive origin fields only — safe to log, snapshot and reconcile. */
export function toSafeOrigin(origin) {
  return {
    host: origin?.host,
    port: Number(origin?.port),
    database: origin?.database,
    user: origin?.user,
    scheme: origin?.scheme ?? 'postgres',
  };
}

/** One-line, secret-free origin summary for plans, snapshots and reports. */
export function safeOriginText(origin) {
  const safe = toSafeOrigin(origin);
  return `host=${safe.host}:${safe.port} db=${safe.database} user=${safe.user} scheme=${safe.scheme}`;
}

/**
 * Compares desired vs observed non-sensitive origin fields. The password is
 * never comparable (the API does not return it) and never part of the diff.
 *
 * @returns {{equal: boolean, diffs: string[]}}
 */
export function compareOrigins(want, got) {
  const fields = ['host', 'port', 'database', 'user', 'scheme'];
  const left = toSafeOrigin(want);
  const right = toSafeOrigin(got);
  const diffs = fields.filter((field) => String(left[field]) !== String(right[field]));
  return { equal: diffs.length === 0, diffs };
}

/**
 * fetch with a timeout budget. The budget wins even against a fetchImpl that
 * ignores AbortSignal (Promise.race), so a hung API can never hang a run.
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

async function readJsonBody(response) {
  try {
    return await response.json();
  } catch {
    throw cfError(CF_RESPONSE_ERROR_CODE, 'Hyperdrive API returned an unreadable response body.');
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
      const failure = response && typeof response.json === 'function' ? await response.json() : null;
      suffix = `, cf_code ${firstCfErrorCode(failure)}`;
    } catch {
      // unreadable failure body: status alone is the report (never raw text)
    }
    throw cfError(CF_HTTP_ERROR_CODE, `Hyperdrive ${method} failed (${label}: HTTP ${status}${suffix})`);
  }
  const envelope = await readJsonBody(response);
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
 *
 * @param {{targets: Array<{key: string, label: string, hyperdriveId: string, database: string, user: string}>, side: string, host: string, port: number, accountId: string}} plan
 * @returns {string[]}
 */
export function planHyperdriveUpdates({ targets, side, host, port, accountId }) {
  return (targets ?? []).map(
    (target) =>
      `[dry-run] Would PATCH ${target.label} (${target.hyperdriveId}) ` +
      `account=${accountId} ${safeOriginText({ host, port, database: target.database, user: target.user })} ` +
      `[side=${side}]`,
  );
}

/**
 * Applies ONE target: snapshot (GET) → PATCH → reconcile (GET + compare).
 * The snapshot holds safe fields only; the password is never persisted.
 *
 * @param {{fetchImpl: Function, accountId: string, apiToken: string, target: HyperdriveTargetSpec, host: string, port: number|string, timeoutMs?: number}} options
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
}) {
  const want = {
    host,
    port,
    database: target.database,
    user: target.user,
    password: target.password,
    scheme: 'postgres',
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
 * @param {{fetchImpl: Function, accountId: string, apiToken: string, targets: HyperdriveTargetSpec[], host: string, port: number|string, timeoutMs?: number}} options
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
      });
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
 *
 * @param {{fetchImpl: Function, accountId: string, apiToken: string, snapshot: HyperdriveSnapshot, password: string, timeoutMs?: number}} options
 * @returns {Promise<{hyperdriveId: string, match: boolean, diffs: string[], meta: object}>}
 */
export async function rollbackHyperdriveTarget({
  fetchImpl,
  accountId,
  apiToken,
  snapshot,
  password,
  timeoutMs,
}) {
  if (!snapshot || !snapshot.hyperdriveId || !snapshot.origin) {
    throw cfError(CF_CONFIG_INVALID_CODE, 'rollback needs a snapshot with hyperdriveId and origin.');
  }
  await patchHyperdriveOrigin({
    fetchImpl,
    accountId,
    apiToken,
    hyperdriveId: snapshot.hyperdriveId,
    origin: { ...snapshot.origin, password },
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
