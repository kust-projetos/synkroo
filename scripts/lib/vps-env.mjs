/**
 * scripts/lib/vps-env.mjs
 *
 * Provider-neutral resolution of the private VPS `.env` file used by operator
 * scripts. The file lives OUTSIDE this repository and is never committed here.
 *
 * Precedence (single source of truth for every operator script):
 *   1. SYNKROO_VPS_ENV — explicit path. Absolute, or relative to the current
 *      working directory. Fail closed: a non-empty value that does not point at
 *      a readable regular file ABORTS instead of silently falling back, so an
 *      operator can never hit the wrong VPS by accident.
 *   2. Legacy sibling `../vps-hostinger/.env`, resolved from the repository root
 *      derived from this module's own location (no `process.cwd()` dependence,
 *      identical result when the script is invoked from the repo root).
 *      Temporary migration aid: emits a deprecation warning.
 *
 * Secrets policy: no value read from the env file ever reaches a log line, a
 * warning or an exception message. Only paths and key names are surfaced.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VPS_ENV_PATH_VAR = 'SYNKROO_VPS_ENV';
export const ENV_SOURCE_EXPLICIT = 'explicit';
export const ENV_SOURCE_LEGACY = 'legacy';
export const ENV_SOURCE_NONE = 'none';

/** Legacy fallback: temporary, provider-specific, removed after the migration. */
const LEGACY_ENV_SEGMENTS = ['..', 'vps-hostinger', '.env'];

/**
 * Decodes a POSIX single-quoted run: `'…'`, with `'` written as `'\''` and
 * segments concatenated (`''` is a legitimate empty segment, produced when the
 * value itself starts with a quote). Returns `null` when the text is not a
 * complete quoted run, so the caller can fall back to legacy parsing.
 */
function decodePosixQuoted(rest) {
  let out = '';
  let index = 0;
  let started = false;
  while (index < rest.length) {
    if (rest.slice(index).trim() === '') break;
    // The canonical concatenation escape between two quoted segments.
    if (rest[index] === '\\' && rest[index + 1] === "'") {
      out += "'";
      index += 2;
      started = true;
      continue;
    }
    if (rest[index] !== "'") return null;
    started = true;
    index += 1;
    while (index < rest.length && rest[index] !== "'") {
      out += rest[index];
      index += 1;
    }
    if (index >= rest.length) return null;
    index += 1;
  }
  return started ? out : null;
}

/** Value parsing: POSIX single-quoted (byte-exact) first, legacy forms as fallback. */
function parseEnvValue(rawValue) {
  const rest = String(rawValue ?? '');
  if (rest.startsWith("'")) {
    const decoded = decodePosixQuoted(rest);
    if (decoded !== null) return decoded;
  }
  // Legacy: bare, single- or double-quoted, with boundary whitespace trimmed.
  return rest.trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Parses `.env` content into a key/value map.
 *
 * Splits on `/\r?\n/` so files with Windows (CRLF) line endings parse the same
 * as LF: a trailing `\r` would otherwise defeat the end-of-line `$` anchor and
 * silently drop the line (regression that surfaced as "VPS_IP is missing").
 */
export function parseVpsEnvContent(content) {
  const env = {};
  const lines = String(content ?? '').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      env[key] = parseEnvValue(match[2]);
    }
  }
  return env;
}

/**
 * Repository root derived from this module's location (`<root>/scripts/lib/…`).
 * Used instead of `process.cwd()` so path resolution no longer depends on the
 * caller's working directory.
 */
export function repoRootFromModuleUrl(moduleUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), '..', '..');
}

/** Absolute legacy fallback path for a given repository root. */
export function legacyVpsEnvPathFrom(repoRoot) {
  return path.resolve(repoRoot, ...LEGACY_ENV_SEGMENTS);
}

function statOrNull(target) {
  try {
    return fs.statSync(target);
  } catch {
    return null;
  }
}

/** Owner-only: a credentials file must never be group/world-readable. */
export const CREDENTIAL_FILE_MODE = 0o600;

/**
 * Operator-facing error carrying a SYNKROO_* code. Messages built here contain
 * only paths, key names and OS reason text — never a credential value — so
 * `safeDbErrorSummary` (scripts/lib/pg-ddl.mjs) may surface them verbatim.
 */
function envFileError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Resolves which env file to use, without reading it.
 *
 * @returns {{path: string|null, source: 'explicit'|'legacy'|'none'}}
 * @throws {Error} when SYNKROO_VPS_ENV is set to an unusable path (fail closed).
 */
export function resolveVpsEnvPath(options = {}) {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const moduleUrl = options.moduleUrl ?? import.meta.url;
  const repoRoot = options.repoRoot ?? repoRootFromModuleUrl(moduleUrl);

  const raw = String(env?.[VPS_ENV_PATH_VAR] ?? '').trim();
  if (raw) {
    const resolved = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(cwd, raw);
    const stat = statOrNull(resolved);
    if (!stat) {
      throw envFileError(
        'SYNKROO_VPS_ENV_INVALID_PATH',
        `${VPS_ENV_PATH_VAR} is set to "${resolved}" but no file exists there. ` +
          `Point it at an existing readable .env file, or unset it to use the ` +
          `deprecated legacy fallback.`,
      );
    }
    if (!stat.isFile()) {
      throw envFileError(
        'SYNKROO_VPS_ENV_INVALID_PATH',
        `${VPS_ENV_PATH_VAR} is set to "${resolved}" but that path is not a regular file. ` +
          `Point it at the private VPS .env file.`,
      );
    }
    try {
      fs.accessSync(resolved, fs.constants.R_OK);
    } catch {
      throw envFileError(
        'SYNKROO_VPS_ENV_INVALID_PATH',
        `${VPS_ENV_PATH_VAR} is set to "${resolved}" but the file is not readable. ` +
          `Fix its permissions or unset the variable.`,
      );
    }
    return { path: resolved, source: ENV_SOURCE_EXPLICIT };
  }

  const legacyPath = legacyVpsEnvPathFrom(repoRoot);
  const legacyStat = statOrNull(legacyPath);
  if (legacyStat?.isFile()) return { path: legacyPath, source: ENV_SOURCE_LEGACY };
  return { path: null, source: ENV_SOURCE_NONE };
}

/** Human-readable origin of the resolved values, for errors and help text. */
export function vpsEnvSourceHint(options = {}) {
  const source = options.source ?? ENV_SOURCE_NONE;
  const envPath = options.path ?? null;
  if (source === ENV_SOURCE_EXPLICIT) return `${VPS_ENV_PATH_VAR}=${envPath}`;
  if (source === ENV_SOURCE_LEGACY) {
    return `the deprecated legacy fallback (${envPath}); set ${VPS_ENV_PATH_VAR} to keep using this file explicitly`;
  }
  return `${VPS_ENV_PATH_VAR}=/absolute/path/to/.env (the ../vps-hostinger/.env fallback is deprecated)`;
}

/**
 * Resolves and reads the env file.
 *
 * @returns {{values: Record<string,string>, path: string|null, source: string}}
 */
export function loadVpsEnv(options = {}) {
  const resolved = resolveVpsEnvPath(options);
  if (resolved.source === ENV_SOURCE_LEGACY) {
    const warn = options.warn ?? ((message) => console.warn(message));
    warn(
      `[deprecation] ${VPS_ENV_PATH_VAR} is not set: falling back to the legacy ` +
        `path "${resolved.path}" (../vps-hostinger/.env). This fallback is temporary; ` +
        `set ${VPS_ENV_PATH_VAR}=${resolved.path} to silence it.`,
    );
  }
  if (!resolved.path) return { values: {}, path: null, source: resolved.source };
  const values = parseVpsEnvContent(fs.readFileSync(resolved.path, 'utf8'));
  return { values, path: resolved.path, source: resolved.source };
}

export const SETTING_ORIGIN_PROCESS = 'process.env';
export const SETTING_ORIGIN_FILE = 'file';

/**
 * Single precedence rule for connection values, plus the origin of the winner:
 * process.env wins over the env file; an empty/unset value on either side falls
 * through. Never cross-fills one environment's credential with another's.
 *
 * @param {string} key
 * @param {{env?: Record<string,string|undefined>, values?: Record<string,string>}} [options]
 * @returns {{value: string|undefined, origin: string|undefined}}
 */
export function readVpsSettingWithOrigin(key, options = {}) {
  const env = options.env ?? process.env;
  const values = options.values ?? {};
  const fromEnv = env?.[key];
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return { value: fromEnv, origin: SETTING_ORIGIN_PROCESS };
  }
  const fromFile = values?.[key];
  if (typeof fromFile === 'string' && fromFile.length > 0) {
    return { value: fromFile, origin: SETTING_ORIGIN_FILE };
  }
  return { value: undefined, origin: undefined };
}

/**
 * Value-only view of {@link readVpsSettingWithOrigin}.
 *
 * @param {string} key
 * @param {{env?: Record<string,string|undefined>, values?: Record<string,string>}} [options]
 * @returns {string|undefined}
 */
export function readVpsSetting(key, options = {}) {
  return readVpsSettingWithOrigin(key, options).value;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** NUL/CR/LF cannot be represented inside a single-line quoted value. */
const UNREPRESENTABLE_ENV_VALUE = /[\0\r\n]/;

export const ENV_VALUE_UNREPRESENTABLE_CODE = 'SYNKROO_ENV_VALUE_UNREPRESENTABLE';

/**
 * Encodes a value reversibly using POSIX single quotes: wrap in `'…'` and write
 * an embedded `'` as `'\''`. The result is byte-exact when re-read by
 * `parseVpsEnvContent` and is source-compatible with `set -a; . "$file"` — a
 * password containing spaces, `$`, `;` or backticks stays a single shell word.
 *
 * NUL, CR and LF are rejected: they would silently corrupt the file (and a NUL
 * cannot survive a single-line literal at all). Callers that persist a
 * generated or overridden credential run this before any database connection.
 *
 * @param {string} value
 * @param {string} [key] key name used only for the error message
 * @returns {string}
 */
export function encodeEnvValue(value, key = 'value') {
  const raw = String(value ?? '');
  if (UNREPRESENTABLE_ENV_VALUE.test(raw)) {
    throw envFileError(
      ENV_VALUE_UNREPRESENTABLE_CODE,
      `Refusing to persist ${key}: the value contains NUL, CR or LF, which the ` +
        `quoted .env format cannot represent. Nothing was written.`,
    );
  }
  return `'${raw.split("'").join("'\\''")}'`;
}

/**
 * Pure upsert of `key=<encoded>` in `.env` text; returns the new content.
 *
 * Two invariants:
 *   - EVERY duplicate occurrence is rewritten. Parsing is last-wins, so
 *     updating only the first line would leave a stale credential active.
 *   - The replacement is a callback, never a string: with a string replacement,
 *     `$&`, `$$`, ``$` `` and `$'` inside a password would be expanded as
 *     substitution patterns and silently corrupt the persisted credential.
 *
 * @param {string} content
 * @param {string} key
 * @param {string} value
 * @returns {string}
 */
export function upsertEnvValue(content, key, value) {
  const current = String(content ?? '');
  const encoded = encodeEnvValue(value, key);
  const regex = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=.*$`, 'gm');
  let matched = false;
  const replaced = current.replace(regex, () => {
    matched = true;
    return `${key}=${encoded}`;
  });
  if (matched) return replaced;
  const trimmed = current.replace(/\s+$/, '');
  return `${trimmed}${trimmed ? '\n' : ''}${key}=${encoded}\n`;
}

/**
 * Decides which keys must be persisted back to the env file.
 *
 * `overrides` maps a key to `{ value, required }`:
 *   - `required: true`  → a secret was generated and would be LOST if not
 *     written; without a destination file this throws (fail closed before any
 *     database mutation).
 *   - `required: false` → keep an existing file in sync with process.env
 *     overrides; skipped when there is no file to update.
 *
 * @param {{envPath?: string|null, fileValues?: Record<string,string>, overrides?: Record<string,{value: string, required?: boolean}>}} [options]
 * @returns {{envPath: string|null, writes: Record<string,string>}}
 */
export function planEnvFileWrites({ envPath = null, fileValues = {}, overrides = {} } = {}) {
  const writes = {};
  for (const [key, spec] of Object.entries(overrides)) {
    const { value, required = false } = spec;
    if (!envPath) {
      if (required) {
        throw envFileError(
          'SYNKROO_VPS_ENV_NOT_WRITABLE',
          `Cannot persist generated ${key}: no VPS env file was found. ` +
            `Set ${VPS_ENV_PATH_VAR} to a writable .env file outside this repository.`,
        );
      }
      continue;
    }
    if (required || (fileValues?.[key] ?? '') !== value) writes[key] = value;
  }
  return { envPath, writes };
}

/**
 * Fail-closed preflight: refuses to continue when there is nothing able to
 * persist the planned writes. Call BEFORE any database mutation.
 *
 * @param {{envPath?: string|null, writes?: Record<string,string>}} [options]
 * @returns {string|null} the env file path (null when there is nothing to write)
 */
export function assertEnvFileWritable({ envPath = null, writes = {} } = {}) {
  const keys = Object.keys(writes);
  if (keys.length === 0) return null;
  const target = keys.join(', ');

  if (!envPath) {
    throw envFileError(
      'SYNKROO_VPS_ENV_NOT_WRITABLE',
      `Cannot persist ${target}: no VPS env file was found. ` +
        `Set ${VPS_ENV_PATH_VAR} to a writable .env file outside this repository.`,
    );
  }
  const stat = statOrNull(envPath);
  if (!stat) {
    throw envFileError(
      'SYNKROO_VPS_ENV_NOT_WRITABLE',
      `Cannot persist ${target}: the VPS env file "${envPath}" does not exist. ` +
        `Point ${VPS_ENV_PATH_VAR} at an existing writable file.`,
    );
  }
  if (!stat.isFile()) {
    throw envFileError(
      'SYNKROO_VPS_ENV_NOT_WRITABLE',
      `Cannot persist ${target}: the VPS env file "${envPath}" is not a regular file.`,
    );
  }
  try {
    fs.accessSync(envPath, fs.constants.W_OK);
  } catch {
    throw envFileError(
      'SYNKROO_VPS_ENV_NOT_WRITABLE',
      `Cannot persist ${target}: the VPS env file "${envPath}" is not writable. ` +
        `Credentials would be lost; fix the permissions or set ${VPS_ENV_PATH_VAR} to a writable file.`,
    );
  }
  return envPath;
}

/**
 * Applies planned writes atomically (temp file in the same directory + rename).
 *
 * The replacement file is always created with mode 0600: a credential file must
 * not stay group/world-readable because an older revision of it was, and the
 * rename would otherwise carry those permissions over. The resulting file is
 * therefore owner-only on POSIX.
 *
 * @param {string} envPath
 * @param {Record<string,string>} [writes]
 * @returns {boolean} whether anything was written
 */
export function applyEnvFileWrites(envPath, writes = {}) {
  const entries = Object.entries(writes);
  if (entries.length === 0) return false;

  let current;
  try {
    current = fs.readFileSync(envPath, 'utf8');
  } catch {
    throw envFileError(
      'SYNKROO_VPS_ENV_WRITE_FAILED',
      `Cannot read the VPS env file "${envPath}" to persist credentials.`,
    );
  }
  let next = current;
  for (const [key, value] of entries) next = upsertEnvValue(next, key, value);

  const tempPath = path.join(
    path.dirname(envPath),
    `.${path.basename(envPath)}.synkroo-tmp-${process.pid}-${Date.now()}`,
  );
  try {
    fs.writeFileSync(tempPath, next, { encoding: 'utf8', mode: CREDENTIAL_FILE_MODE });
    fs.renameSync(tempPath, envPath);
  } catch (err) {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      // best effort: a leftover temp file must not mask the original failure
    }
    throw envFileError(
      'SYNKROO_VPS_ENV_WRITE_FAILED',
      `Failed to persist VPS env credentials at "${envPath}": ` +
        `${err instanceof Error ? err.message : 'unknown error'}`,
    );
  }
  return true;
}
