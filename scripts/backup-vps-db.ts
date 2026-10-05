/**
 * scripts/backup-vps-db.ts
 *
 * Logical PostgreSQL backup of ONE side of the Hostinger → Contabo migration
 * (runbook `docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md`
 * §5.2). Thin, secrets-safe wrapper around the canonical, regression-locked
 * engine `scripts/db-backup.mjs` (custom format `-Fc` + gzip + SHA-256
 * sidecar): this script resolves the side's credentials and runs the engine
 * with DATABASE_URL injected in the CHILD environment (never in argv), then
 * writes a redacted metadata sidecar next to the artifact
 * (`<base>.dump.meta.json`).
 *
 * Usage:
 *   npx tsx scripts/backup-vps-db.ts --side=source
 *   npx tsx scripts/backup-vps-db.ts --side=target --out-dir=/var/backups/synkroo --keep 14
 *
 *   --side    (REQUIRED) which VPS is dumped: `source` = the host the data
 *             lives on today, `target` = the host it is being moved to.
 *             There is no default: a missing or invalid side aborts.
 *   --db      database name INSIDE that VPS (default: synkroo).
 *   --out-dir destination directory (default: ./backups, resolved to an absolute
 *             path so the engine writes the same place regardless of the
 *             caller's working directory).
 *   --keep    retention in days, forwarded verbatim to the engine (engine
 *             default: 7).
 *
 * Env file resolution (provider-neutral, see scripts/lib/vps-env.mjs):
 *   1. SYNKROO_VPS_ENV (explicit path; invalid values abort — no fallback)
 *   2. legacy ../vps-hostinger/.env (temporary, warns)
 *
 * Connection values come from VPS_<SIDE>_{IP,PG_PORT,POSTGRES_PASSWORD},
 * each falling back to its deprecated generic VPS_* alias with a warning.
 *
 * Secrets: the DSN is assembled in-process (password URL-encoded) and reaches
 * the engine only through the child environment. No log line, no error message
 * and no metadata field ever carries the host IP, the password or the
 * connection string — logs identify the target as `host=<side>`.
 *
 * Host disclosure (deliberate, repo convention): the delegated engine prints the
 * connection host/port in its own output and passes the host to the pg client
 * tools through argv (cf. scripts/migrate-vps.ts:150, which logs the host). This
 * tooling therefore does NOT claim to hide the host from the operator terminal.
 * The rule it enforces is narrower and hard: credential VALUES (the password)
 * never reach logs, argv or files, and the `.meta.json` written here carries only
 * the side label as `hostLabel`.
 *
 * Restore counterpart: scripts/restore-vps-db.ts (runbook §5.3).
 *
 * Runbook §5.2 also requires that this dump never remains the only copy on the
 * source host: copy `<out-dir>/synkroo-*.dump.gz` together with its `.dump.sha256`
 * off-host and re-verify the hash there before any cutover.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import {
  VPS_SIDE_INVALID_CODE,
  VPS_SIDES,
  loadVpsEnv,
  readCliFlag,
  repoRootFromModuleUrl,
  requireVpsSideSetting,
  resolveVpsSideSettings,
  vpsEnvSourceHint,
} from './lib/vps-env.mjs';
import { safeDbErrorSummary } from './lib/pg-ddl.mjs';

/** Canonical engine that actually dumps; never reimplemented here. */
export const BACKUP_ENGINE = 'scripts/db-backup.mjs';
/** Identifies the wrapper in the metadata sidecar. */
export const GENERATOR = 'backup-vps-db.ts';
/** Runbook section this script implements. */
export const RUNBOOK_SECTION =
  'docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md §5.2';

/**
 * Artifact naming produced by db-backup.mjs: `synkroo-<utcstamp>.dump.gz`.
 */
export const DUMP_FILE_PATTERN = /^synkroo-.*\.dump\.gz$/;

/** Clock-granularity tolerance applied to both ends of the run window (ms). */
export const MTIME_SKEW_TOLERANCE_MS = 2000;

/** PostgreSQL identifier shape accepted for --db, free of quoting surprises. */
const DB_NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/;
const KEEP_PATTERN = /^\d+$/;

const USAGE = [
  'Usage:',
  '  npx tsx scripts/backup-vps-db.ts --side=source|target [--db=synkroo] [--out-dir=./backups] [--keep 7]',
  '',
  '  --side    REQUIRED. source = current VPS (data lives there today), target = destination VPS.',
  '  --db      database inside that VPS (default: synkroo).',
  '  --out-dir destination directory (default: ./backups).',
  '  --keep    retention in days, forwarded to scripts/db-backup.mjs (engine default: 7).',
].join('\n');

/**
 * Composes the libpq connection string consumed by db-backup.mjs through
 * DATABASE_URL.
 *
 * The password is URL-encoded, so `@`, `:`, `/`, `#`, `$`, spaces and quotes in
 * an operator-chosen credential cannot terminate the userinfo section or forge
 * a query string. The user and the database name are encoded for the same
 * reason.
 */
export function composeDsn({
  host,
  port,
  password,
  database,
  user = 'synkroo',
  sslmode = 'require',
}: {
  host: string;
  port: number | string;
  password: string;
  database: string;
  user?: string;
  sslmode?: string;
}): string {
  return (
    `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
    `@${host}:${port}/${encodeURIComponent(database)}?sslmode=${sslmode}`
  );
}

/** Sidecar path for a dump artifact: `X.dump.gz` → `X.dump.sha256`. */
export function checksumSidecarPathFor(dumpPath: string): string {
  return String(dumpPath).endsWith('.gz')
    ? `${String(dumpPath).slice(0, -'.gz'.length)}.sha256`
    : `${String(dumpPath)}.sha256`;
}

/** Metadata sidecar path for a dump artifact: `X.dump.gz` → `X.dump.meta.json`. */
export function metadataSidecarPathFor(dumpPath: string): string {
  return `${String(dumpPath).slice(0, -'.gz'.length)}.meta.json`;
}

/**
 * Newest dump artifact in `outDir`, bounded to THIS run.
 *
 * Assumes a SINGLE WRITER: concurrent backup runs into the same out-dir are
 * unsupported — the two windows would overlap and one run could adopt the other
 * run's dump.
 *
 * `notBeforeMs`/`notAfterMs` bound the search to the run (each side relaxed by
 * MTIME_SKEW_TOLERANCE_MS for clock/file granularity), so neither a stale
 * artifact nor a pre-existing dump with a FUTURE mtime can be reported as this
 * run's output. Ties on mtime fall back to the newest name, which is the
 * lexicographically last UTC stamp.
 */
export function newestDumpArtifact(
  outDir: string,
  notBeforeMs?: number,
  notAfterMs?: number,
): { name: string; path: string; mtimeMs: number } | null {
  let names: string[];
  try {
    names = readdirSync(outDir);
  } catch {
    return null;
  }
  const candidates = names
    .filter((name) => DUMP_FILE_PATTERN.test(name))
    .map((name) => {
      const full = join(outDir, name);
      let mtimeMs = 0;
      try {
        mtimeMs = statSync(full).mtimeMs;
      } catch {
        return null;
      }
      if (notBeforeMs !== undefined && mtimeMs < notBeforeMs - MTIME_SKEW_TOLERANCE_MS) return null;
      // A dump written AFTER the engine exited cannot be this run's output.
      if (notAfterMs !== undefined && mtimeMs > notAfterMs + MTIME_SKEW_TOLERANCE_MS) return null;
      return { name, path: full, mtimeMs };
    })
    .filter((entry): entry is { name: string; path: string; mtimeMs: number } => entry !== null)
    .sort((a, b) =>
      a.mtimeMs === b.mtimeMs ? a.name.localeCompare(b.name) : a.mtimeMs - b.mtimeMs,
    );
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

/**
 * Parses the SHA-256 out of a `.sha256` sidecar (sha256sum format:
 * `<hex>  <file>`). Returns `null` for anything that is not a 64-hex digest,
 * so a truncated or foreign sidecar is a failure, never a silent "verified".
 */
export function parseChecksumSidecar(text: string): string | null {
  const first = String(text ?? '').trim().split(/\s+/)[0] ?? '';
  return /^[0-9a-f]{64}$/i.test(first) ? first.toLowerCase() : null;
}

/**
 * Redacted metadata written next to the dump (runbook §5.2: dump custom format,
 * SHA-256, timestamp, redacted metadata).
 *
 * Deliberately carries NO host IP, NO password and NO DSN — only the side label,
 * which is what the runbook needs to tell source from target.
 */
export interface DumpMetadata {
  generator: string;
  side: string;
  database: string;
  hostLabel: string;
  port: number;
  dumpFile: string;
  checksumFile: string;
  sha256: string;
  sizeBytes: number;
  engine: string;
  runbook: string;
  createdAtUtc: string;
}

export function buildDumpMetadata(input: {
  side: string;
  database: string;
  port: number;
  dumpFile: string;
  sha256: string;
  sizeBytes: number;
  createdAt?: Date;
}): DumpMetadata {
  return {
    generator: GENERATOR,
    side: input.side,
    database: input.database,
    // Side label only — never the resolved IP.
    hostLabel: `<${input.side}>`,
    port: input.port,
    dumpFile: input.dumpFile,
    checksumFile: `${input.dumpFile.slice(0, -'.gz'.length)}.sha256`,
    sha256: input.sha256,
    sizeBytes: input.sizeBytes,
    engine: BACKUP_ENGINE,
    runbook: RUNBOOK_SECTION,
    createdAtUtc: (input.createdAt ?? new Date()).toISOString(),
  };
}

/**
 * Rejects a database name that is not a plain, safely quotable identifier.
 * Throws a SYNKROO_-coded error (safe to print verbatim) instead of exiting, so
 * the validator stays usable as a pure helper.
 */
export function assertDatabaseName(name: string, flag: string): string {
  if (!DB_NAME_PATTERN.test(String(name ?? ''))) {
    throw operatorError(
      'SYNKROO_INVALID_FLAG_VALUE',
      `${flag} inválido: use apenas [A-Za-z0-9_][A-Za-z0-9_-]* (máx. 63 chars).`,
    );
  }
  return name;
}

/**
 * Operator-facing failure with a SYNKROO_* code: the prefix makes
 * safeDbErrorSummary print the message verbatim (it is authored here from flag
 * names and file names only) while any driver text stays redacted.
 */
function operatorError(code: string, message: string): Error {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

/**
 * Flags whose value is mandatory. A bare token (`--keep --yes`) is NOT the same
 * as an absent flag: readCliFlag returns `undefined` for it, so without a
 * token-level guard `--out-dir` would silently dump into `./backups` and `--db`
 * into the default database of the wrong side.
 */
export const VALUE_REQUIRED_FLAGS = ['--side', '--db', '--out-dir', '--keep'] as const;

/**
 * Pure: which of `flags` appear as a LITERAL token in argv but whose value
 * `readCliFlag` cannot resolve. Pure so the footgun is unit-testable without
 * running the CLI.
 */
export function findValuelessFlags(argv: string[], flags: readonly string[]): string[] {
  const args = Array.isArray(argv) ? argv : [];
  return flags.filter(
    (flag) => args.includes(flag) && readCliFlag(args, flag.slice('--'.length)) === undefined,
  );
}

/**
 * Fail-closed CLI guard: a value-taking flag with no value aborts BEFORE any
 * credential is resolved and before the engine runs, naming the flag.
 */
function assertNoValuelessFlags(argv: string[], example: string): void {
  const bare = findValuelessFlags(argv, VALUE_REQUIRED_FLAGS);
  if (bare.length === 0) return;
  console.error(
    `❌ ${bare.join(', ')} sem valor — abortando. Uma flag sem valor é indistinguível de uma ` +
      `flag ausente e cairia no default (${example}).`,
  );
  console.error(USAGE);
  process.exit(1);
}

export function main(argv: string[] = process.argv.slice(2)): number {
  // First gate of all: a value-taking flag with no value is a footgun, not a
  // default. Runs before the side check and before any credential is read.
  assertNoValuelessFlags(argv, '--out-dir ausente = ./backups; --db ausente = synkroo');

  const side = readCliFlag(argv, 'side');
  if (side === undefined || !VPS_SIDES.includes(side)) {
    console.error(
      side === undefined
        ? `--side is required (${VPS_SIDE_INVALID_CODE}): expected ${VPS_SIDES.join(' or ')}.`
        : `--side="${side}" is not a valid side (${VPS_SIDE_INVALID_CODE}): expected ${VPS_SIDES.join(' or ')}.`,
    );
    console.error(USAGE);
    process.exit(1);
  }

  const database = assertDatabaseName(readCliFlag(argv, 'db') ?? 'synkroo', '--db');
  const outDirFlag = readCliFlag(argv, 'out-dir');
  if (outDirFlag !== undefined && String(outDirFlag).trim() === '') {
    console.error('❌ --out-dir não pode ser vazio.');
    console.error(USAGE);
    process.exit(1);
  }
  // Absolute so the engine (which resolves --out-dir against its own cwd)
  // writes exactly where this run says it will.
  const outDir = resolve(String(outDirFlag ?? './backups'));

  const keep = readCliFlag(argv, 'keep');
  if (keep !== undefined && !KEEP_PATTERN.test(String(keep))) {
    console.error('❌ --keep deve ser um inteiro >= 0 (dias).');
    console.error(USAGE);
    process.exit(1);
  }
  const keepArgs = keep === undefined ? [] : ['--keep', String(keep)];

  const { values, path: envPath, source } = loadVpsEnv();
  const hint = vpsEnvSourceHint({ path: envPath, source });
  // Only the credentials this run actually connects with are mandatory.
  const settings = resolveVpsSideSettings(side, {
    values,
    hint,
    require: ['IP', 'PG_PORT', 'POSTGRES_PASSWORD'],
    warn: (message: string) => console.warn(message),
  });
  const host = requireVpsSideSetting(settings, 'ip', hint) as string;
  const port = requireVpsSideSetting(settings, 'pgPort', hint) as number;
  const password = requireVpsSideSetting(settings, 'postgresPassword', hint) as string;

  // `host` is intentionally NOT logged: the target is identified by its side.
  console.log(`side=${side} host=<${side}>:${port} db=${database} out_dir=${outDir} source_env=${hint}`);
  if (settings.usedLegacyKeys.length > 0) {
    console.warn(
      `[deprecated] side="${side}" ainda lê as chaves genéricas ` +
        `${settings.usedLegacyKeys.join(', ')} — renomeie para as chaves ` +
        `VPS_${side.toUpperCase()}_* no .env`,
    );
  }

  const dsn = composeDsn({ host, port, password, database });
  const engine = resolve(repoRootFromModuleUrl(), ...BACKUP_ENGINE.split('/'));
  mkdirSync(outDir, { recursive: true });
  // Janela da execução: [startedAtMs, finishedAtMs]. O engine já passa -U ao
  // pg_dump (db-backup.mjs deriva o usuário do userinfo da DSN), então este
  // wrapper não precisa exportar PGUSER — só delimitar o artefato.
  const startedAtMs = Date.now();

  console.log(`📦 Executando ${BACKUP_ENGINE} (modo --url; DSN via env do processo, nunca em argv).`);
  const engineRun = spawnSync(
    process.execPath,
    [engine, '--url', '--out-dir', outDir, ...keepArgs],
    // DATABASE_URL here is the ONLY place the composed DSN is used.
    { env: { ...process.env, DATABASE_URL: dsn }, stdio: 'inherit' },
  );
  // Capturado logo após o filho sair: fecha a janela do artefato, então um dump
  // pré-existente com mtime no futuro não pode ser adotado como se fosse desta
  // execução.
  const finishedAtMs = Date.now();
  if (engineRun.error) {
    console.error(`❌ Não foi possível executar ${BACKUP_ENGINE}: ${engineRun.error.message}`);
    return 1;
  }
  const engineStatus = engineRun.status ?? 1;
  if (engineStatus !== 0) {
    console.error(`❌ ${BACKUP_ENGINE} falhou (exit ${engineStatus}); nenhum metadata foi escrito.`);
    return engineStatus;
  }

  const artifact = newestDumpArtifact(outDir, startedAtMs, finishedAtMs);
  if (!artifact) {
    console.error(
      `❌ O engine reportou sucesso mas nenhum dump desta execução foi encontrado em ${outDir} ` +
        `(janela ${new Date(startedAtMs).toISOString()} → ${new Date(finishedAtMs).toISOString()}). ` +
        'Verifique o diretório antes de aceitar o backup.',
    );
    return 1;
  }

  const sidecarPath = checksumSidecarPathFor(artifact.path);
  let sha256: string | null = null;
  try {
    sha256 = parseChecksumSidecar(readFileSync(sidecarPath, 'utf8'));
  } catch {
    sha256 = null;
  }
  if (!sha256) {
    console.error(
      `❌ Dump ${artifact.name} sem sidecar SHA-256 legível (esperado: ` +
        `${basename(sidecarPath)}). Verifique o hash manualmente antes de mover o artefato.`,
    );
    return 1;
  }

  const metadata = buildDumpMetadata({
    side,
    database,
    port,
    dumpFile: artifact.name,
    sha256,
    sizeBytes: statSync(artifact.path).size,
  });
  const metaPath = metadataSidecarPathFor(artifact.path);
  writeFileSync(metaPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
  console.log(`✅ Dump: ${artifact.name} (sha256 ${sha256.slice(0, 12)}…)`);
  console.log(`   SHA-256 sidecar: ${basename(sidecarPath)}`);
  console.log(`   Metadata redatada: ${basename(metaPath)}`);
  console.log(
    `   Próximo passo: npx tsx scripts/restore-vps-db.ts --side=${side} ` +
      `--from ${artifact.path} --create-db synkroo_rehearsal --dry-run`,
  );
  return 0;
}

/**
 * Direct-CLI detection (same rule as scripts/db-backup.mjs). Guards the entry
 * point so the pure helpers above stay importable from node:test without
 * executing a backup.
 */
function isCliInvocation(moduleUrl: string, argvPath?: string): boolean {
  if (!argvPath) return false;
  const normalize = (value: string): string => {
    const normalized = String(value).replaceAll('\\', '/');
    return normalized.startsWith('/') && /^[A-Za-z]:/.test(normalized.slice(1))
      ? normalized.slice(1)
      : normalized;
  };
  return normalize(new URL(moduleUrl).pathname) === normalize(argvPath);
}

if (isCliInvocation(import.meta.url, process.argv[1])) {
  try {
    process.exit(main());
  } catch (err) {
    // SYNKROO_* messages are authored here from flag names only; anything else
    // is reduced to an allowlisted code by safeDbErrorSummary.
    console.error('❌ Backup VPS falhou:', safeDbErrorSummary(err));
    process.exit(1);
  }
}