/**
 * scripts/restore-vps-db.ts
 *
 * Restore rehearsal of ONE side of the Hostinger → Contabo migration (runbook
 * `docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md` §5.3):
 * restores a dump produced by `scripts/backup-vps-db.ts` into an ISOLATED
 * database on the chosen VPS, then verifies the result.
 *
 * Usage:
 *   npx tsx scripts/restore-vps-db.ts --side=target --from ./backups/synkroo-20261005-120000.dump.gz --create-db synkroo_rehearsal --dry-run
 *   npx tsx scripts/restore-vps-db.ts --side=target --from <dump> --create-db synkroo_rehearsal --yes
 *
 *   --side     (REQUIRED) which VPS receives the restore: `source` = the host
 *              the data lives on today, `target` = the host it is being moved
 *              to. There is no default: a missing or invalid side aborts.
 *   --from     (REQUIRED) path to the `.dump.gz` (or `.dump`) produced by
 *              scripts/backup-vps-db.ts / scripts/db-backup.mjs.
 *   --create-db <name>  rehearsal database to CREATE on the target side before
 *              restoring (isolated by construction: the run refuses to proceed
 *              if a database with that name already exists). Enables the DDL
 *              preflight (CREATE DATABASE + `vector` / `btree_gist`).
 *   --db <name> database that already exists and receives the restore
 *              (default: synkroo). Mutually exclusive with --create-db.
 *   --yes      apply the restore. Without it the run is a DRY-RUN: it prints the
 *              plan and exits 0 without connecting to anything.
 *   --dry-run  forces dry-run even when --yes is present (safe precedence,
 *              mirrors scripts/db-restore.mjs).
 *   --allow-missing-checksum  proceed when the `.sha256` sidecar is ABSENT.
 *              A checksum MISMATCH is never overridable, and a present-but-
 *              unreadable sidecar is never overridable either.
 *
 * Fail-closed gates, in order:
 *   1. checksum of the dump vs its sidecar (before any DDL);
 *   2. rehearsal database must NOT exist yet (--create-db);
 *   3. the engine exit code is propagated as-is;
 *   4. post-restore smoke: counts on the key tables plus the Drizzle migration
 *      ledger. A missing table or a failed query aborts with a non-zero exit
 *      and the table name in the message (never row values).
 *
 * Secrets: the DSN is composed in-process (password URL-encoded) and reaches
 * both the engine and the `pg` client without ever reaching argv, a log line or
 * an error message. Driver errors are summarised by safeDbErrorSummary.
 *
 * Host disclosure (deliberate, repo convention): the delegated engine prints the
 * connection host/port in its own output and passes the host to the pg client
 * tools through argv (cf. scripts/migrate-vps.ts:150, which logs the host). This
 * tooling therefore does NOT claim to hide the host from the operator terminal.
 * The rule it enforces is narrower and hard: credential VALUES (the password)
 * never reach logs, argv or files, and the `.meta.json` written by the backup
 * counterpart carries only the side label.
 *
 * Backup counterpart: scripts/backup-vps-db.ts (runbook §5.2).
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { Client } from 'pg';

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
import { createDatabaseOwnedByDdl, quotePgIdentifier, safeDbErrorSummary } from './lib/pg-ddl.mjs';

/** Canonical engine that actually restores; never reimplemented here. */
export const RESTORE_ENGINE = 'scripts/db-restore.mjs';
/** Runbook section this script implements. */
export const RUNBOOK_SECTION =
  'docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md §5.3';
/** Admin database used only to CREATE DATABASE (never to restore). */
export const MAINTENANCE_DATABASE = 'postgres';
/**
 * Connection role: owner of the rehearsal database, the `user` of every `pg`
 * Client here, the userinfo of the composed DSN and — because
 * scripts/db-restore.mjs strips the userinfo out of the DSN before calling
 * pg_restore/psql without `-U` — the value exported as `PGUSER` to the child.
 * Matches scripts/migrate-vps.ts.
 */
export const DB_ROLE = 'synkroo';
/** Extensions the rehearsal database needs BEFORE pg_restore (mirrors migrate-vps.ts). */
export const REQUIRED_EXTENSIONS = ['vector', 'btree_gist'] as const;
/**
 * Tables counted after the restore.
 *
 * Names are the real schema tables: the install/finance rows are
 * `budget_installments`, and CRM "contatos" are the `patients` + `leads` pair
 * (there is no `contacts`/`installments` table — the engine's CORE_TABLES set
 * plus the finance and commercial tables the rehearsal must prove).
 */
export const SMOKE_TABLES = [
  'clinics',
  'users',
  'patients',
  'appointments',
  'budgets',
  'budget_items',
  'payments',
  'budget_installments',
  'leads',
] as const;
/** Drizzle ledger (schema `drizzle`, created by the node-postgres migrator). */
export const LEDGER_TABLE = 'drizzle.__drizzle_migrations';

const DB_NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/;
const DUMP_EXTENSION_PATTERN = /\.dump(\.gz)?$/;

const USAGE = [
  'Usage:',
  '  npx tsx scripts/restore-vps-db.ts --side=source|target --from <arquivo.dump.gz> [--create-db <nome> | --db <nome>] [--yes] [--dry-run] [--allow-missing-checksum]',
  '',
  '  --side     REQUIRED. source = current VPS, target = destination VPS.',
  '  --from     REQUIRED. Dump gerado por scripts/backup-vps-db.ts.',
  '  --create-db cria uma base isolada de ensaio (recusa se já existir).',
  '  --db       base existente que receberá o restore (padrão: synkroo).',
  '  --yes      aplica o restore. Sem --yes: dry-run (imprime o plano, sai 0).',
  '  --dry-run  força dry-run mesmo com --yes.',
  '  --allow-missing-checksum  prossegue sem o sidecar .sha256 (mismatch nunca é ignorado).',
].join('\n');

/**
 * Operator-facing failure with a SYNKROO_* code.
 *
 * The prefix matters: safeDbErrorSummary prints SYNKROO_* messages verbatim
 * (they are authored here from file names, table names and flag values only),
 * while redacting any driver text that could embed a statement.
 */
function restoreError(code: string, message: string): Error {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

/**
 * Flags whose value is mandatory. A bare token (`--create-db --yes`) is NOT the
 * same as an absent flag: readCliFlag returns `undefined` for it, so without a
 * token-level guard `--create-db` would be treated as absent and the run would
 * target the PRODUCTION database.
 */
export const VALUE_REQUIRED_FLAGS = ['--side', '--from', '--create-db', '--db'] as const;

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
 * Fail-closed CLI guard: a value-taking flag with no value aborts BEFORE the
 * checksum gate and before any credential is resolved, naming the flag. The
 * dangerous case is `--create-db`/`--db` silently degrading to the production
 * database of the chosen side.
 */
function assertNoValuelessFlags(argv: string[], example: string): void {
  const bare = findValuelessFlags(argv, VALUE_REQUIRED_FLAGS);
  if (bare.length === 0) return;
  console.error(
    `❌ ${bare.join(', ')} sem valor — abortando. Uma flag sem valor é indistinguível de uma ` +
      `flag ausente e cairia no default (${example}), ou seja, na base de produção do side.`,
  );
  console.error(USAGE);
  process.exit(1);
}

/**
 * Composes the libpq connection string.
 *
 * Identical contract to scripts/backup-vps-db.ts (duplicated on purpose: each
 * operator script stays self-contained, exactly like db-backup.mjs and
 * db-restore.mjs duplicate their shared helpers — the regression suite locks
 * both implementations to the same output). The password is URL-encoded, so
 * `@`, `:`, `/`, `#`, `$`, spaces and quotes cannot terminate the userinfo
 * section or forge a query string.
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

/**
 * Parses the SHA-256 out of a `.sha256` sidecar (sha256sum format:
 * `<hex>  <file>`). Returns `null` for anything that is not a 64-hex digest,
 * so a truncated or foreign sidecar fails instead of "verifying" nothing.
 */
export function parseChecksumSidecar(text: string): string | null {
  const first = String(text ?? '').trim().split(/\s+/)[0] ?? '';
  return /^[0-9a-f]{64}$/i.test(first) ? first.toLowerCase() : null;
}

/** SHA-256 of a file, streamed-free (dumps are small enough to read once). */
export function sha256OfFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export interface ChecksumResult {
  dumpPath: string;
  sidecarPath: string | null;
  sha256: string;
  sidecarVerified: boolean;
}

/**
 * Checksum gate. Runs before any DDL or network access.
 *
 * Fail-closed by construction:
 *   - dump missing / unreadable → SYNKROO_RESTORE_DUMP_MISSING;
 *   - sidecar absent and `allowMissingSidecar` not set →
 *     SYNKROO_RESTORE_CHECKSUM_MISSING (the only overridable failure);
 *   - sidecar present but unreadable/garbage → SYNKROO_RESTORE_CHECKSUM_UNREADABLE
 *     (never overridable — a corrupt sidecar is worse than none);
 *   - digest mismatch → SYNKROO_RESTORE_CHECKSUM_MISMATCH (never overridable).
 *
 * Error messages name FILE NAMES only.
 */
export function verifyChecksum({
  dumpPath,
  allowMissingSidecar = false,
}: {
  dumpPath: string;
  allowMissingSidecar?: boolean;
}): ChecksumResult {
  const fullPath = resolve(String(dumpPath));
  if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
    throw restoreError(
      'SYNKROO_RESTORE_DUMP_MISSING',
      `dump não encontrado ou não é um arquivo regular: ${basename(fullPath)}`,
    );
  }
  const sha256 = sha256OfFile(fullPath);
  const sidecarPath = checksumSidecarPathFor(fullPath);
  if (!existsSync(sidecarPath)) {
    if (allowMissingSidecar) {
      return { dumpPath: fullPath, sidecarPath: null, sha256, sidecarVerified: false };
    }
    throw restoreError(
      'SYNKROO_RESTORE_CHECKSUM_MISSING',
      `sidecar SHA-256 ausente (esperado: ${basename(sidecarPath)} ao lado de ` +
        `${basename(fullPath)}). Rode com --allow-missing-checksum para assumir o risco.`,
    );
  }
  let expected: string | null = null;
  try {
    expected = parseChecksumSidecar(readFileSync(sidecarPath, 'utf8'));
  } catch {
    expected = null;
  }
  if (!expected) {
    throw restoreError(
      'SYNKROO_RESTORE_CHECKSUM_UNREADABLE',
      `sidecar SHA-256 ilegível ou malformado: ${basename(sidecarPath)} ` +
        '(esperado: sha256sum no formato "<64 hex>  <arquivo>")',
    );
  }
  if (expected !== sha256) {
    // Fail-closed e sem eco de conteúdo: a mensagem nomeia APENAS os arquivos.
    throw restoreError(
      'SYNKROO_RESTORE_CHECKSUM_MISMATCH',
      `SHA-256 divergente: o conteúdo de ${basename(fullPath)} não corresponde ao ` +
        `sidecar ${basename(sidecarPath)}. Restore ABORTADO — divergência de ` +
        'checksum nunca é sobreponível.',
    );
  }
  return { dumpPath: fullPath, sidecarPath, sha256, sidecarVerified: true };
}

/**
 * The dry-run plan. Pure: it renders what WOULD happen, so the printed text can
 * never drift from the arguments actually validated.
 */
export function buildRestorePlan(input: {
  side: string;
  port: number;
  database: string;
  dumpPath: string;
  isRehearsal: boolean;
  checksum: ChecksumResult;
}): string[] {
  const { side, port, database, dumpPath, isRehearsal, checksum } = input;
  return [
    '🔍 DRY-RUN — nada será alterado (nenhuma conexão aberta). Para executar: acrescente --yes.',
    `   side      : ${side} (host=<${side}>:${port})`,
    `   database  : ${database} (${isRehearsal ? 'rehearsal — será criada' : 'já existente'})`,
    `   dump      : ${dumpPath}`,
    `   checksum  : ${
      checksum.sidecarVerified
        ? `verificado (sha256 ${checksum.sha256.slice(0, 12)}…)`
        : `NÃO verificado (sem sidecar; --allow-missing-checksum), sha256 ${checksum.sha256.slice(0, 12)}…`
    }`,
    '   passos que seriam executados:',
    ...(isRehearsal
      ? [
          `     1. conectar em "${MAINTENANCE_DATABASE}" e recusar se "${database}" já existir`,
          `     2. ${createDatabaseOwnedByDdl({ database, owner: DB_ROLE })} (recusa base existente)`,
          `     3. CREATE EXTENSION IF NOT EXISTS ${REQUIRED_EXTENSIONS.join('; CREATE EXTENSION IF NOT EXISTS ')};`,
        ]
      : ['     1. (sem DDL: a base de destino já existe)']),
    `     ${isRehearsal ? 4 : 2}. node ${RESTORE_ENGINE} <dump> --url --yes  (credencial injetada apenas no env do processo filho)`,
    `     ${isRehearsal ? 5 : 3}. smoke pós-restore: counts de ${SMOKE_TABLES.join(', ')} + ledger ${LEDGER_TABLE}`,
  ];
}

async function preflightRehearsalDatabase(input: {
  host: string;
  port: number;
  password: string;
  database: string;
}): Promise<void> {
  const { host, port, password, database } = input;
  const maintenance = new Client({
    host,
    port,
    user: DB_ROLE,
    password,
    database: MAINTENANCE_DATABASE,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await maintenance.connect();
    const existing = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      database,
    ]);
    if (existing.rowCount !== 0) {
      // Fail closed: an existing database of that name could be the very
      // production database, and a rehearsal must never overwrite it.
      throw restoreError(
        'SYNKROO_RESTORE_REHEARSAL_DB_EXISTS',
        `a base "${database}" já existe neste VPS. O ensaio exige uma base isolada: ` +
          'use outro --create-db ou remova a base anterior explicitamente.',
      );
    }
    await maintenance.query(createDatabaseOwnedByDdl({ database, owner: DB_ROLE }));
  } finally {
    await maintenance.end();
  }

  const rehearsal = new Client({
    host,
    port,
    user: DB_ROLE,
    password,
    database,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await rehearsal.connect();
    // Extensions BEFORE pg_restore: the dump creates columns typed as vector.
    for (const extension of REQUIRED_EXTENSIONS) {
      await rehearsal.query(`CREATE EXTENSION IF NOT EXISTS ${quotePgIdentifier(extension)};`);
    }
  } finally {
    await rehearsal.end();
  }
}

async function runPostRestoreSmoke(input: {
  host: string;
  port: number;
  password: string;
  database: string;
}): Promise<void> {
  const { host, port, password, database } = input;
  const client = new Client({
    host,
    port,
    user: DB_ROLE,
    password,
    database,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  const counts: Record<string, number> = {};
  try {
    await client.connect();
    for (const table of SMOKE_TABLES) {
      try {
        const result = await client.query(
          `SELECT count(*)::int AS count FROM ${quotePgIdentifier(table)};`,
        );
        counts[table] = Number(result.rows[0]?.count ?? 0);
      } catch {
        throw restoreError(
          'SYNKROO_RESTORE_SMOKE_TABLE_FAILED',
          `smoke pós-restore falhou na tabela "${table}" (migrations pendentes ou restore incompleto).`,
        );
      }
    }
    try {
      const ledger = await client.query(`SELECT count(*)::int AS count FROM ${LEDGER_TABLE};`);
      counts[LEDGER_TABLE] = Number(ledger.rows[0]?.count ?? 0);
    } catch {
      throw restoreError(
        'SYNKROO_RESTORE_SMOKE_LEDGER_FAILED',
        `smoke pós-restore falhou no ledger de migrations "${LEDGER_TABLE}" ` +
          '(restore incompleto ou migrador não executado).',
      );
    }
  } finally {
    await client.end();
  }
  console.log('✅ Smoke pós-restore:');
  for (const table of [...SMOKE_TABLES, LEDGER_TABLE]) {
    console.log(`   - ${table}: ${counts[table]}`);
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  // First gate of all: a value-taking flag with no value is a footgun, not a
  // default. Runs before the side check, before the checksum and before any
  // credential is read.
  assertNoValuelessFlags(argv, '--db ausente = a base "synkroo" (produção)');

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

  // Every flag is validated BEFORE the env file is read, so a usage error can
  // never be masked by an unrelated credential problem.
  const from = readCliFlag(argv, 'from');
  if (from === undefined || String(from).trim() === '') {
    console.error('❌ --from é obrigatório: aponte o dump gerado por scripts/backup-vps-db.ts.');
    console.error(USAGE);
    process.exit(1);
  }
  if (String(from).includes('://')) {
    console.error(
      '❌ --from recebeu algo com formato de URL — connection strings nunca são aceitas via argv.',
    );
    console.error(USAGE);
    process.exit(1);
  }
  const dumpPath = resolve(String(from));
  if (!DUMP_EXTENSION_PATTERN.test(dumpPath)) {
    console.error('❌ Extensão inesperada — esperado .dump ou .dump.gz.');
    console.error(USAGE);
    process.exit(1);
  }

  const createDb = readCliFlag(argv, 'create-db');
  const dbFlag = readCliFlag(argv, 'db');
  if (createDb !== undefined && dbFlag !== undefined) {
    console.error('❌ --create-db e --db são mutuamente exclusivos (um cria a base, o outro a reusa).');
    console.error(USAGE);
    process.exit(1);
  }
  if (createDb !== undefined && !DB_NAME_PATTERN.test(String(createDb))) {
    console.error('❌ --create-db inválido: use apenas [A-Za-z0-9_][A-Za-z0-9_-]* (máx. 63 chars).');
    process.exit(1);
  }
  if (dbFlag !== undefined && !DB_NAME_PATTERN.test(String(dbFlag))) {
    console.error('❌ --db inválido: use apenas [A-Za-z0-9_][A-Za-z0-9_-]* (máx. 63 chars).');
    process.exit(1);
  }
  const isRehearsal = createDb !== undefined;
  const database = String(createDb ?? dbFlag ?? 'synkroo');

  const apply = argv.includes('--yes');
  const dryRun = argv.includes('--dry-run') || !apply;
  const allowMissingSidecar = argv.includes('--allow-missing-checksum');

  // Gate 1 — checksum, before any DDL or connection.
  const checksum = verifyChecksum({ dumpPath, allowMissingSidecar });

  const { values, path: envPath, source } = loadVpsEnv();
  const hint = vpsEnvSourceHint({ path: envPath, source });
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
  console.log(`side=${side} host=<${side}>:${port} db=${database} source_env=${hint}`);
  if (settings.usedLegacyKeys.length > 0) {
    console.warn(
      `[deprecated] side="${side}" ainda lê as chaves genéricas ` +
        `${settings.usedLegacyKeys.join(', ')} — renomeie para as chaves ` +
        `VPS_${side.toUpperCase()}_* no .env`,
    );
  }
  console.log(`   dump: ${dumpPath}`);
  console.log(
    `   checksum: ${
      checksum.sidecarVerified
        ? `verificado (sha256 ${checksum.sha256.slice(0, 12)}…)`
        : `NÃO verificado — sidecar ausente e --allow-missing-checksym presente (sha256 ${checksum.sha256.slice(0, 12)}…)`
    }`,
  );

  if (dryRun) {
    for (const line of buildRestorePlan({ side, port, database, dumpPath, isRehearsal, checksum })) {
      console.log(line);
    }
    console.log(
      isRehearsal
        ? `   Rehearsal pronta para rodar: npx tsx scripts/restore-vps-db.ts --side=${side} --from ${dumpPath} --create-db ${database} --yes`
        : `   Restore pronto para rodar: npx tsx scripts/restore-vps-db.ts --side=${side} --from ${dumpPath} --db ${database} --yes`,
    );
    return 0;
  }

  // Gate 2 — the rehearsal database must be new (never an existing one).
  if (isRehearsal) {
    console.log(`🛠  Criando a base de ensaio "${database}" e as extensões obrigatórias...`);
    await preflightRehearsalDatabase({ host, port, password, database });
    console.log(`   Extensões verificadas: ${REQUIRED_EXTENSIONS.join(', ')}.`);
  }

  const dsn = composeDsn({ host, port, password, database, user: DB_ROLE });
  const engine = resolve(repoRootFromModuleUrl(), ...RESTORE_ENGINE.split('/'));
  console.log(`⚠️  RESTORE REAL confirmado (--yes) — side=${side}, database=${database}.`);
  const engineRun = spawnSync(
    process.execPath,
    [engine, dumpPath, '--url', '--yes'],
    // DATABASE_URL here is the ONLY place the composed DSN is used.
    // PGUSER is required, not cosmetic: db-restore.mjs strips the userinfo out
    // of the DSN (buildDsnNoPass) and calls pg_restore/psql WITHOUT -U, so the
    // libpq fallback would be the OS user of this shell (often `root`, which
    // owns no database here). PGPASSWORD stays the engine's job — it parses the
    // DSN itself and never sees this env.
    {
      env: { ...process.env, DATABASE_URL: dsn, PGUSER: DB_ROLE },
      stdio: 'inherit',
    },
  );
  if (engineRun.error) {
    throw restoreError(
      'SYNKROO_RESTORE_ENGINE_SPAWN_FAILED',
      `não foi possível executar ${RESTORE_ENGINE} (${engineRun.error.message})`,
    );
  }
  const engineStatus = engineRun.status ?? 1;
  if (engineStatus !== 0) {
    console.error(`❌ ${RESTORE_ENGINE} falhou (exit ${engineStatus}).`);
    return engineStatus;
  }

  // Gate 4 — smoke: counts on the key tables plus the migration ledger.
  await runPostRestoreSmoke({ host, port, password, database });
  console.log(`✅ Restore concluído e verificado (${RUNBOOK_SECTION}).`);
  return 0;
}

/**
 * Direct-CLI detection (same rule as scripts/db-restore.mjs). Guards the entry
 * point so the pure helpers above stay importable from node:test without
 * touching a database.
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
  main().then(
    (code) => {
      process.exit(code);
    },
    (err: unknown) => {
      // SYNKROO_* messages are authored here from file/table names only;
      // everything else is reduced to an allowlisted code by safeDbErrorSummary.
      console.error('❌ Restore VPS falhou:', safeDbErrorSummary(err));
      process.exit(1);
    },
  );
}