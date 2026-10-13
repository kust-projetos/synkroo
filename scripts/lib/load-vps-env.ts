/**
 * scripts/lib/load-vps-env.ts
 *
 * Canonical provider-neutral loader for VPS private config (P1B-INFRA).
 *
 * Precedence:
 *   1. `SYNKROO_VPS_ENV` (explicit path to a `.env` file) — canonical.
 *   2. Legacy fallback `../vps-hostinger/.env` (deprecated; warns, never logs values).
 *   3. `env-only` (no file): read mode may proceed with `process.env` alone;
 *      write mode must fail clearly instead of writing to an unknown location.
 *
 * Security rules enforced here:
 * - Paths are resolved with `path.resolve`/`path.isAbsolute` (Windows and
 *   Linux, spaces supported). Never concatenate paths into shell strings.
 * - `redactSecrets()` scrubs `--password=` argv fragments and known secret
 *   values from any log/error text. Origins are reported as
 *   `explicit | legacy | env-only` — never with values.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Canonical env var pointing at the VPS `.env` file (absolute or relative). */
export const VPS_ENV_VAR = 'SYNKROO_VPS_ENV';

/** Legacy provider-coupled fallback, relative to the project root. */
export const LEGACY_VPS_ENV_SEGMENTS = ['..', 'vps-hostinger', '.env'] as const;

/** Where the effective config came from (no values attached, safe to log). */
export type VpsEnvOrigin = 'explicit' | 'legacy' | 'env-only';

export interface LoadVpsEnvOptions {
  /** Base directory for relative paths. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Keys that must resolve (via file or process.env); missing ones throw. */
  requiredKeys?: string[];
  /**
   * When true (default false), a missing file is a hard error instead of an
   * `env-only` fallback. Use for scripts that WRITE config.
   */
  requireFile?: boolean;
  /** Warning sink (defaults to `console.warn`); injectable for tests. */
  warn?: (message: string) => void;
  /** Environment override (defaults to `process.env`); injectable for tests. */
  env?: NodeJS.ProcessEnv;
}

export interface LoadedVpsEnv {
  /** Key/value pairs parsed from the resolved file (empty when `env-only`). */
  values: Record<string, string>;
  /** Resolved absolute file path, or `null` when `env-only`. */
  configPath: string | null;
  /** Which source won the precedence (safe to log). */
  origin: VpsEnvOrigin;
}

/**
 * Parses `.env` content into a key/value map.
 *
 * Splits on `/\r?\n/` so Windows (CRLF) files parse identically to LF.
 * Trims lines, skips blanks and `#` comments, splits on the FIRST `=`
 * (values may contain `=`), and strips one pair of matching outer quotes
 * (single or double) from values.
 */
export function parseVpsEnvContent(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || /[\s#]/.test(key)) continue;
    let val = line.slice(eq + 1).trim();
    if (
      val.length >= 2 &&
      ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'")))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

/**
 * Resolves which config file (if any) applies. Pure path logic, no I/O
 * beyond the legacy existence check. `explicit` always wins when set.
 */
export function resolveVpsEnvPath(options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): { configPath: string | null; origin: VpsEnvOrigin } {
  const cwd = options.cwd ?? process.cwd();
  const e = options.env ?? process.env;
  const explicit = (e[VPS_ENV_VAR] ?? '').trim();
  if (explicit) {
    const resolved = path.isAbsolute(explicit)
      ? path.normalize(explicit)
      : path.resolve(cwd, explicit);
    return { configPath: resolved, origin: 'explicit' };
  }
  const legacy = path.resolve(cwd, ...LEGACY_VPS_ENV_SEGMENTS);
  if (fs.existsSync(legacy)) {
    return { configPath: legacy, origin: 'legacy' };
  }
  return { configPath: null, origin: 'env-only' };
}

/** Human-readable origin label with the resolved path (never values). */
export function describeOrigin(loaded: Pick<LoadedVpsEnv, 'configPath' | 'origin'>): string {
  if (loaded.origin === 'env-only') return 'env-only (process.env, no file)';
  const tag = loaded.origin === 'legacy' ? 'legacy fallback, deprecated' : 'explicit';
  return `${loaded.origin} (${tag}): ${loaded.configPath}`;
}

/**
 * Redacts secret material from log/error text: any `--password=<...>` argv
 * fragment (exec failures embed the command line) plus exact known secret
 * values. Use on EVERY error/log surface that may carry child output.
 */
export function redactSecrets(text: string, secrets: string[] = []): string {
  let redacted = text.replace(/--password=\S+/g, '--password=[REDACTED]');
  for (const secret of secrets) {
    if (secret) redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted;
}

/**
 * Effective value for `key`: live `process.env` wins over the file, so
 * exported overrides keep working without editing the private file.
 */
export function getVpsValue(
  loaded: LoadedVpsEnv,
  key: string,
  env?: NodeJS.ProcessEnv,
): string | undefined {
  const e = env ?? process.env;
  const fromEnv = e[key];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  return loaded.values[key];
}

/** Same as `getVpsValue` but throws a SYNKROO_VPS_ENV-first error when empty. */
export function requireVpsValue(
  loaded: LoadedVpsEnv,
  key: string,
  env?: NodeJS.ProcessEnv,
): string {
  const value = getVpsValue(loaded, key, env);
  if (!value) {
    throw new Error(
      `${key} is missing: set ${VPS_ENV_VAR} to a .env file containing it, ` +
        `or export ${key} in process.env (legacy fallback ../vps-hostinger/.env is deprecated).`,
    );
  }
  return value;
}

/**
 * Loads the VPS config file (when one resolves) and validates required keys
 * against effective values (file + process.env).
 *
 * - Explicit `SYNKROO_VPS_ENV` pointing at a missing file: always throws
 *   (misconfiguration), with the resolved path and a fix instruction.
 * - No file at all: read mode returns `{ values: {}, configPath: null,
 *   origin: 'env-only' }`; write mode (`requireFile: true`) throws.
 * - Legacy fallback: loads and emits a one-line deprecation warning WITHOUT
 *   values.
 */
export function loadVpsEnv(options: LoadVpsEnvOptions = {}): LoadedVpsEnv {
  const e = options.env ?? process.env;
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const { configPath, origin } = resolveVpsEnvPath({ cwd: options.cwd, env: e });

  if (origin === 'legacy' && configPath) {
    warn(
      `[deprecation] Using legacy fallback ${configPath}. ` +
        `Set ${VPS_ENV_VAR} to the private .env path instead.`,
    );
  }

  if (configPath === null) {
    if (options.requireFile) {
      throw new Error(
        `No VPS config file resolved: set ${VPS_ENV_VAR} to the private .env path ` +
          `(legacy fallback ../vps-hostinger/.env not found; env-only mode cannot write config).`,
      );
    }
    assertRequiredKeys({}, options.requiredKeys ?? [], e);
    return { values: {}, configPath: null, origin: 'env-only' };
  }

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `VPS config file not found: ${configPath}. ` +
        `Set ${VPS_ENV_VAR} to an existing .env file (absolute or relative to the project root).`,
    );
  }

  const values = parseVpsEnvContent(fs.readFileSync(configPath, 'utf8'));
  assertRequiredKeys(values, options.requiredKeys ?? [], e);
  return { values, configPath, origin };
}

function assertRequiredKeys(
  values: Record<string, string>,
  requiredKeys: string[],
  env: NodeJS.ProcessEnv,
): void {
  for (const key of requiredKeys) {
    const fromEnv = env[key];
    const effective =
      fromEnv !== undefined && fromEnv !== '' ? fromEnv : values[key];
    if (!effective) {
      throw new Error(
        `${key} is missing: set ${VPS_ENV_VAR} to a .env file containing it, ` +
          `or export ${key} in process.env (legacy fallback ../vps-hostinger/.env is deprecated).`,
      );
    }
  }
}

/** True when `--dry-run` is present in the given argv (defaults to process.argv). */
export function isDryRun(argv: string[] = process.argv): boolean {
  return argv.includes('--dry-run');
}

const VPS_ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Idempotent atomic writer for the VPS config file.
 *
 * - Refuses to write when no file resolved (`null`): callers must run
 *   `loadVpsEnv({ requireFile: true })` first, so writes always target the
 *   loader-resolved path (explicit or acknowledged legacy fallback).
 * - Skips the rewrite (no backup, no mtime change) when the value is equal.
 * - Otherwise writes a `.bak` backup, then publishes via temp-file + rename
 *   (atomic on the same filesystem).
 * - Never logs values; returns `'updated' | 'unchanged'` for plan logging.
 */
export function writeVpsEnvKey(
  configPath: string | null,
  key: string,
  value: string,
): 'updated' | 'unchanged' {
  if (!configPath) {
    throw new Error(
      `Refusing to write VPS config: no config file resolved. ` +
        `Set ${VPS_ENV_VAR} to the private .env path first.`,
    );
  }
  if (!VPS_ENV_KEY_PATTERN.test(key)) {
    throw new Error(`Refusing to write VPS config: invalid key ${JSON.stringify(key)}.`);
  }
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Refusing to write VPS config: file not found: ${configPath}. ` +
        `Set ${VPS_ENV_VAR} to an existing .env file.`,
    );
  }
  const current = parseVpsEnvContent(fs.readFileSync(configPath, 'utf8'));
  if (current[key] === value) {
    // P1 (CWE-732): endurece mesmo sem mudança — um destino 0644
    // preexistente continuaria expondo segredos a outros usuários locais.
    try {
      fs.chmodSync(configPath, 0o600);
    } catch {
      // Windows: chmod é parcial/no-op — proteção real via ACL do diretório.
    }
    return 'unchanged';
  }

  // P1 (CWE-732): o arquivo guarda segredos — destino e backup devem ficar
  // 0600. copyFileSync herda o mode de origem e o tmp nasceria 0644 sob
  // umask 022, então fixa-se 0600 em todos os artefatos. No Windows chmod é
  // no-op (ACL/readonly apenas) — documentado como limitação aceita; a
  // proteção real lá é a ACL do diretório privado do usuário.
  fs.copyFileSync(configPath, `${configPath}.bak`);
  fs.chmodSync(`${configPath}.bak`, 0o600);

  const raw = fs.readFileSync(configPath, 'utf8');
  const regex = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  const next = regex.test(raw)
    ? raw.replace(regex, `${key}=${value}`)
    : `${raw.trimEnd()}\n${key}=${value}\n`;
  const tmpPath = `${configPath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, next, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(tmpPath, 0o600);
  fs.renameSync(tmpPath, configPath);
  fs.chmodSync(configPath, 0o600);
  return 'updated';
}
