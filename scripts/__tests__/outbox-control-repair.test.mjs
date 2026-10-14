import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  evaluateLedgerGate,
  expectedMigrations,
  parseShapeRow,
  runRepair,
  splitMigrationStatements,
} from '../outbox-control-repair.mjs'

const PRESENT_OBJECTS = {
  control_table: true,
  gate_function: true,
  gate_trigger: true,
  claim_release_column: true,
}
const MISSING_OBJECTS = {
  control_table: false,
  gate_function: false,
  gate_trigger: false,
  claim_release_column: false,
}

/**
 * Cliente pg falso: ledger fixo, objetos que só passam a existir depois das
 * statements, e registro explícito de BEGIN/COMMIT/ROLLBACK + lock consultivo.
 */
function fakeClient({ applied = 39, controlRow = true, failOnStatement } = {}) {
  const state = { calls: [], objects: false, controlRow, committed: false, rolledBack: false, locked: false }
  return {
    state,
    async connect() {},
    async query(query) {
      const text = String(query)
      state.calls.push(text)
      if (text === 'BEGIN') return { rows: [] }
      if (text === 'COMMIT') {
        state.committed = true
        return { rows: [] }
      }
      if (text === 'ROLLBACK') {
        state.rolledBack = true
        return { rows: [] }
      }
      if (text.includes('pg_advisory_xact_lock')) {
        state.locked = true
        return { rows: [] }
      }
      if (text.includes('__drizzle_migrations')) return { rows: [{ count: applied }] }
      if (text.includes('relname')) {
        return { rows: [state.objects ? PRESENT_OBJECTS : MISSING_OBJECTS] }
      }
      if (text.includes('control_row')) return { rows: [{ control_row: state.controlRow }] }
      if (failOnStatement && text.includes(failOnStatement)) throw new Error('forced statement failure')
      state.objects = true
      state.controlRow = true
      return { rows: [] }
    },
    async end() {},
  }
}

/** O CLI do repair em produção sempre define DATABASE_URL antes de chamar. */
function withDatabaseUrl(fn) {
  return async () => {
    const saved = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgres://user:pass@127.0.0.1:1/synkroo_test'
    try {
      await fn()
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = saved
    }
  }
}

test('splitMigrationStatements preserva o corpo $$ da função do gate', async () => {
  const sql = await readFile(new URL('../../src/lib/db/migrations/0036_outbox_claim_generation.sql', import.meta.url), 'utf8')
  const statements = splitMigrationStatements(sql)
  assert.ok(statements.length >= 6)
  assert.match(statements[0], /ADD COLUMN IF NOT EXISTS "claim_generation"/)
  const fn = statements.find((s) => s.includes('CREATE OR REPLACE FUNCTION'))
  assert.match(fn, /CREATE OR REPLACE FUNCTION "outbox_enforce_control_gate"/)
  // O corpo plpgsql não foi partido pelo separador.
  assert.match(fn, /RAISE EXCEPTION 'OUTBOX_PAUSED'/)
  assert.match(fn, /RAISE EXCEPTION 'OUTBOX_CLAIM_GENERATION_INVALID'/)
  assert.match(fn, /RAISE EXCEPTION 'OUTBOX_LEGACY_SETTLEMENT_DENIED'/)
  // Identidade transacional: o trigger lê o GUC gravado pelo repository.
  assert.match(fn, /current_setting\('outbox\.claim_marker', true\)/)
  assert.ok(statements.every((s) => !s.includes('--> statement-breakpoint')))
})

test('o DDL do gate não usa DROP TRIGGER (sem janela de gate ausente)', async () => {
  const sql = await readFile(new URL('../../src/lib/db/migrations/0036_outbox_claim_generation.sql', import.meta.url), 'utf8')
  const statements = splitMigrationStatements(sql)
    // Comentários (inclusive o rollback documentado) não são DDL executável.
    .map((s) => s.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n'))
  // CREATE OR REPLACE TRIGGER é idempotente e não derruba o gate para recriar.
  assert.ok(statements.some((s) => /CREATE OR REPLACE TRIGGER "outbox_jobs_control_gate"/.test(s)))
  assert.ok(!statements.some((s) => /DROP\s+TRIGGER/i.test(s)))
})

test('expectedMigrations espelha o journal canônico (39 entradas)', async () => {
  const journal = JSON.parse(await readFile(new URL('../../src/lib/db/migrations/meta/_journal.json', import.meta.url), 'utf8'))
  assert.equal(expectedMigrations(journal), 39)
})

test('evaluateLedgerGate é EXATO: 38 passa, 33 incompleto, 39 à frente', () => {
  assert.deepEqual(evaluateLedgerGate({ applied: 38, expected: 38 }), { ok: true, code: 'LEDGER_OK' })

  const behind = evaluateLedgerGate({ applied: 33, expected: 38 })
  assert.equal(behind.ok, false)
  assert.equal(behind.code, 'LEDGER_INCOMPLETE')
  assert.match(behind.guidance, /db:migrate/)

  const ahead = evaluateLedgerGate({ applied: 40, expected: 39 })
  assert.equal(ahead.ok, false)
  assert.equal(ahead.code, 'LEDGER_AHEAD')
  assert.match(ahead.guidance, /EXPECTED_MIGRATIONS/)

  assert.equal(evaluateLedgerGate({ applied: Number.NaN, expected: 39 }).code, 'LEDGER_INCOMPLETE')
})

test('parseShapeRow exige shape, linha singleton e trigger habilitado', () => {
  assert.equal(parseShapeRow({ ...PRESENT_OBJECTS, control_row: true }).present, true)
  assert.equal(parseShapeRow({ ...PRESENT_OBJECTS, control_row: false }).present, false)
  assert.equal(parseShapeRow({ ...PRESENT_OBJECTS, gate_trigger: false, control_row: true }).present, false)
  assert.equal(parseShapeRow(undefined).present, false)
})

test('runRepair: dry-run é o default e não muta', withDatabaseUrl(async () => {
  const client = fakeClient({ applied: 39 })
  const result = await runRepair({ apply: false, statements: ['SELECT 1'], createClient: () => client })
  assert.equal(result.code, 'MISSING_DRY_RUN')
  assert.equal(client.state.objects, false) // nenhuma statement de DDL rodou
  assert.equal(client.state.committed, false)
  assert.equal(client.state.rolledBack, true)
  assert.equal(client.state.locked, true) // transação + lock consultivo
}))

test('runRepair --apply instala o DDL, reverifica e comita', withDatabaseUrl(async () => {
  const client = fakeClient({ applied: 39 })
  const result = await runRepair({ apply: true, statements: ['SELECT 1', 'SELECT 2'], createClient: () => client })
  assert.equal(result.code, 'REPAIRED')
  assert.equal(result.changed, true)
  assert.equal(client.state.objects, true)
  assert.equal(client.state.committed, true)
  assert.equal(client.state.rolledBack, false)
  assert.equal(client.state.calls.filter((c) => c === 'SELECT 1' || c === 'SELECT 2').length, 2)
  // A linha singleton foi verificada dentro da mesma transação.
  assert.ok(client.state.calls.some((c) => String(c).includes('control_row')))
}))

test('runRepair recusa ledger incompleto (migrate pendente não é alvo de repair)', withDatabaseUrl(async () => {
  const client = fakeClient({ applied: 33 })
  const result = await runRepair({ apply: true, statements: ['SELECT 1'], createClient: () => client })
  assert.equal(result.code, 'LEDGER_INCOMPLETE')
  assert.equal(client.state.objects, false)
  assert.equal(client.state.committed, false)
  assert.equal(client.state.rolledBack, true)
}))

test('runRepair recusa ledger À FRENTE do journal (40 vs 39)', withDatabaseUrl(async () => {
  const client = fakeClient({ applied: 40 })
  const result = await runRepair({ apply: true, statements: ['SELECT 1'], createClient: () => client })
  assert.equal(result.code, 'LEDGER_AHEAD')
  assert.equal(client.state.objects, false)
  assert.equal(client.state.committed, false)
}))

test('runRepair reverte (ROLLBACK) quando uma statement falha — nada parcial', withDatabaseUrl(async () => {
  const client = fakeClient({ applied: 39 })
  const result = await runRepair({
    apply: true,
    statements: ['SELECT 1', 'BOOM STATEMENT'],
    createClient: () => ({ ...client, query: (q) => (String(q).includes('BOOM') ? Promise.reject(new Error('forced')) : client.query(q)) }),
  })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'ERROR')
  assert.equal(client.state.committed, false)
  assert.equal(client.state.rolledBack, true)
}))

test('runRepair sem DATABASE_URL falha fechado', async () => {
  const saved = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  try {
    const result = await runRepair({ apply: true, statements: [], createClient: () => fakeClient() })
    assert.equal(result.code, 'NO_CONNECTION')
  } finally {
    if (saved !== undefined) process.env.DATABASE_URL = saved
  }
})

test('runRepair: shape já presente não reaplica nada', withDatabaseUrl(async () => {
  const client = fakeClient({ applied: 39 })
  client.query = async (query) => {
    const text = String(query)
    if (text.includes('__drizzle_migrations')) return { rows: [{ count: 39 }] }
    if (text.includes('relname')) return { rows: [PRESENT_OBJECTS] }
    if (text.includes('control_row')) return { rows: [{ control_row: true }] }
    return { rows: [] }
  }
  const result = await runRepair({ apply: true, statements: ['SELECT 1'], createClient: () => client })
  assert.equal(result.code, 'PRESENT')
  assert.equal(result.changed, false)
  assert.equal(client.state.committed, false) // nada a comitar
}))

test('runRepair: objetos presentes SEM a linha singleton continuam precisando de repair', withDatabaseUrl(async () => {
  const client = fakeClient({ applied: 39, controlRow: false })
  const result = await runRepair({ apply: true, statements: ['SELECT 1'], createClient: () => client })
  assert.equal(result.code, 'REPAIRED')
}))

