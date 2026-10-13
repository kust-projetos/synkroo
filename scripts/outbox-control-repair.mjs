#!/usr/bin/env node
/**
 * scripts/outbox-control-repair.mjs — repair EXPLÍCITO do gate de manutenção
 * do outbox (migration 0036 expandida).
 *
 * Por que existe: a 0036 foi AMPLIADA (tabela singleton `outbox_control` +
 * trigger `outbox_enforce_control_gate` + coluna `claim_release`) sem criar
 * uma 0037 — o ledger canônico era 36/36 na época. A 0037 (P4 Slice 1A,
 * ingestão OBSERVE) elevou o canônico para 37/37. Ambiente que JÁ aplicou a
 * 0036 original tem o ledger em 36 e NÃO recebe os objetos novos: o drizzle
 * pula a entrada aplicada. NÃO há reparo silencioso — readiness/health falham
 * fechados (`maintenanceControl: missing`) e o operador roda este script de
 * propósito.
 *
 * Uso:
 *   DATABASE_URL=postgres://... node scripts/outbox-control-repair.mjs            # dry-run (relata, não muta)
 *   DATABASE_URL=postgres://... node scripts/outbox-control-repair.mjs --apply   # aplica o DDL idempotente
 *
 * Regras:
 *   - dry-run é o default; mutação exige `--apply` explícito;
 *   - exige ledger EXATO (== journal): incompleto (abaixo do journal) ⇒
 *     `npm run db:migrate` primeiro; à frente do journal ⇒ `LEDGER_AHEAD`,
 *     código e ambiente divergentes — repair nunca instala objetos de outra
 *     versão;
 *   - ATOMICO: uma única transação, serializada por lock consultivo
 *     (`pg_advisory_xact_lock`); qualquer falha reverte o lote inteiro, sem
 *     janela de DROP+CREATE (o DDL da 0036 é `CREATE OR REPLACE`);
 *   - nunca imprime connection string, segredos ou mensagem de driver;
 *   - o DDL aplicado É o conteúdo da migration 0036 (fonte única, idempotente);
 *   - ao final, reverifica o shape e sai 0 só com `present`.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const MIGRATION_FILE = resolve(PROJECT_ROOT, 'src/lib/db/migrations/0036_outbox_claim_generation.sql');
const JOURNAL_FILE = resolve(PROJECT_ROOT, 'src/lib/db/migrations/meta/_journal.json');

/**
 * Objetos do gate — parse-safe de propósito: nada referencia `outbox_control`
 * diretamente, então um shape faltando nunca vira erro de query.
 */
const SHAPE_OBJECTS_SQL = `
  SELECT
    EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'outbox_control'
        AND c.relkind = 'r'
        AND n.nspname = current_schema()
    ) AS control_table,
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'outbox_enforce_control_gate'
        AND n.nspname = current_schema()
    ) AS gate_function,
    EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = 'outbox_jobs'::regclass
         AND NOT t.tgisinternal
         AND t.tgenabled = 'O'
         AND t.tgtype = 19
         AND t.tgqual IS NULL
         AND t.tgfoid = (
          SELECT p.oid FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.proname = 'outbox_enforce_control_gate'
            AND n.nspname = current_schema()
        )
    ) AS gate_trigger,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'outbox_jobs'
        AND column_name = 'claim_release'
    ) AS claim_release_column
`

/** Linha singleton — só consultada quando a tabela existe. */
const SHAPE_CONTROL_ROW_SQL = `SELECT EXISTS (SELECT 1 FROM "outbox_control" WHERE "id" = 1) AS control_row`

/** Lock consultivo de transação: serializa invocações concorrentes do repair. */
const REPAIR_ADVISORY_LOCK_KEY = 9021036;

/** A transação do repair é declarada explicitamente pelo script. */
const BEGIN_SQL = 'BEGIN';
const ROLLBACK_SQL = 'ROLLBACK';
const COMMIT_SQL = 'COMMIT';;

/**
 * Divide o SQL da migration nos statements que o migrador do drizzle executaria
 * (separador canônico `--> statement-breakpoint`). Chunks que são APENAS
 * comentários são descartados; comentários que precedem DDL ficam no chunk
 * (o driver executa o bloco inteiro, como o migrator faz). Corpos `$$` das
 * funções ficam intactos — o separador não aparece dentro deles.
 */
export function splitMigrationStatements(sql) {
  return String(sql)
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement
      .split('\n')
      .some((line) => !line.trim().startsWith('--') && line.trim().length > 0));
}

/** Total de entradas do ledger canônico (journal do drizzle). */
export function expectedMigrations(journal) {
  return Array.isArray(journal?.entries) ? journal.entries.length : 0;
}

/**
 * Porta do ledger: repair só faz sentido com o ledger EXATO — nem pendente
 * (`db:migrate` primeiro) nem à frente do journal do código (ambiente com
 * migration que este checkout não conhece: repair instalaria objetos de uma
 * versão diferente da que o binário espera).
 */
export function evaluateLedgerGate({ applied, expected }) {
  if (!Number.isFinite(applied) || applied < expected) {
    return {
      ok: false,
      code: 'LEDGER_INCOMPLETE',
      guidance: 'run npm run db:migrate first — pending migrations are not a repair target',
    };
  }
  if (applied > expected) {
    return {
      ok: false,
      code: 'LEDGER_AHEAD',
      guidance: 'database is ahead of the migration journal — update EXPECTED_MIGRATIONS/_journal before repairing',
    };
  }
  return { ok: true, code: 'LEDGER_OK' };
}

/** Interpreta a linha de shape (true somente com shape, linha singleton e trigger habilitado). */
export function parseShapeRow(row) {
  const present = Boolean(row?.control_table)
    && Boolean(row?.control_row)
    && Boolean(row?.gate_function)
    && Boolean(row?.gate_trigger)
    && Boolean(row?.claim_release_column);
  return {
    present,
    controlTable: Boolean(row?.control_table),
    controlRow: Boolean(row?.control_row),
    gateFunction: Boolean(row?.gate_function),
    gateTrigger: Boolean(row?.gate_trigger),
    claimReleaseColumn: Boolean(row?.claim_release_column),
  };
}

async function readLedgerApplied(client) {
  const result = await client.query('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations');
  const raw = result.rows[0]?.count ?? 0;
  return typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10) || 0;
}

async function readShape(client) {
  const objects = await client.query(SHAPE_OBJECTS_SQL);
  const row = objects.rows[0] ?? {};
  // Sem a tabela não há linha singleton a consultar — shape já está faltando.
  if (!row.control_table) return parseShapeRow(row);
  const singleton = await client.query(SHAPE_CONTROL_ROW_SQL);
  return parseShapeRow({ ...row, control_row: singleton.rows[0]?.control_row });
}

/**
 * Núcleo testável do repair. `createClient` é injetável (teste sem banco);
 * em produção é sempre `pg.Client` com a connection string do ambiente.
 *
 * ATOMICIDADE: tudo acontece dentro de UMA transação (`BEGIN` explícito), depois
 * de um lock consultivo de transação (`pg_advisory_xact_lock`) que serializa
 * invocações concorrentes. O DDL da 0036 é `CREATE OR REPLACE` (idempotente, sem
 * janela de DROP+CREATE): se qualquer statement falhar, o `ROLLBACK` desfaz o
 * lote inteiro e o ambiente nunca fica com o gate parcialmente instalado — shape
 * reverificado antes e depois, no mesmo commit.
 */
export async function runRepair({
  apply,
  statements,
  createClient = (connectionString) => new pg.Client({ connectionString }),
}) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { ok: false, code: 'NO_CONNECTION' };
  }

  const journal = JSON.parse(await readFile(JOURNAL_FILE, 'utf8'));
  const expected = expectedMigrations(journal);
  const client = createClient(connectionString);
  try {
    await client.connect();
    // Transação única: lock consultivo serializa concorrência; qualquer falha
    // no meio reverte o lote inteiro (nunca gate parcialmente instalado).
    await client.query(BEGIN_SQL);
    await client.query('SELECT pg_advisory_xact_lock($1)', [REPAIR_ADVISORY_LOCK_KEY]);

    const applied = await readLedgerApplied(client);
    const gate = evaluateLedgerGate({ applied, expected });
    if (!gate.ok) {
      await client.query(ROLLBACK_SQL);
      return { ok: false, code: gate.code, applied, expected, guidance: gate.guidance };
    }

    const before = await readShape(client);
    if (before.present) {
      await client.query(ROLLBACK_SQL);
      return { ok: true, code: 'PRESENT', applied, expected, changed: false };
    }
    if (!apply) {
      await client.query(ROLLBACK_SQL);
      return { ok: false, code: 'MISSING_DRY_RUN', applied, expected, guidance: 're-run with --apply' };
    }

    for (const statement of statements) {
      await client.query(statement);
    }
    const after = await readShape(client);
    if (!after.present) {
      await client.query(ROLLBACK_SQL);
      return { ok: false, code: 'STILL_MISSING', applied, expected };
    }
    await client.query(COMMIT_SQL);
    return { ok: true, code: 'REPAIRED', applied, expected, changed: true };
  } catch (error) {
    // Sem mensagem do driver: apenas o nome do erro, sem connection string.
    // A transação é explicitamente revertida — se o erro veio de ROLLBACK, ela
    // já foi desfeita e não há estado parcial a limpar.
    try {
      await client.query(ROLLBACK_SQL);
    } catch {
      // Transação já abortada/inativa: nada a reverter.
    }
    const name = error instanceof Error ? error.name : 'UnknownError';
    return { ok: false, code: 'ERROR', errorName: name };
  } finally {
    await client.end?.();
  }
}

async function main(argv = process.argv.slice(2)) {
  const apply = argv.includes('--apply');
  const migrationSql = await readFile(MIGRATION_FILE, 'utf8');
  const statements = splitMigrationStatements(migrationSql);
  const result = await runRepair({ apply, statements });

  if (result.code === 'NO_CONNECTION') {
    console.error('DATABASE_URL is required (never pass the URL on the command line)');
    return 1;
  }
  if (result.code === 'LEDGER_INCOMPLETE' || result.code === 'LEDGER_AHEAD') {
    console.error(`${result.code} applied=${result.applied} expected=${result.expected}`);
    console.error(result.guidance);
    return 1;
  }
  if (result.code === 'MISSING_DRY_RUN') {
    console.log(`OUTBOX_CONTROL_SHAPE=missing applied=${result.applied} expected=${result.expected}`);
    console.log('dry-run: nothing was changed. Re-run with --apply to install the gate objects.');
    return 1;
  }
  if (result.code === 'PRESENT') {
    console.log(`OUTBOX_CONTROL_SHAPE=present applied=${result.applied} expected=${result.expected}`);
    return 0;
  }
  if (result.code === 'REPAIRED') {
    console.log(`OUTBOX_CONTROL_REPAIR=applied statements=${statements.length} applied=${result.applied} expected=${result.expected}`);
    console.log('OUTBOX_CONTROL_SHAPE=present');
    return 0;
  }
  console.error(`OUTBOX_CONTROL_REPAIR=failed code=${result.code}${result.errorName ? ` error=${result.errorName}` : ''}`);
  return 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().then((code) => process.exit(code));
}
