import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const EXPECTED_ROADMAP_COUNT = 143
export const ALLOWED_STATUSES = new Set([
  'VERIFIED',
  'PARTIAL',
  'OPEN',
  'EXTERNAL',
  'DEFERRED',
  'UNVERIFIED',
])

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
export const ROADMAP_PATH = resolve(
  MODULE_DIR,
  '../docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md',
)
export const LEDGER_PATH = resolve(
  MODULE_DIR,
  '../docs/superpowers/audits/roadmap-143-ledger.json',
)

const ROADMAP_ROW = /^\| F\d+\.\d{2} \|/
const GENERIC_EVIDENCE = /^(?:none|evidence exists|local evidence or implementation required|implementation required|decision record needed)$/i
const GENERIC_GATE = /^(?:none|generic wave gate|W\d+ gate)$/i

export function parseRoadmapTable(markdown) {
  const rows = []

  for (const line of markdown.split(/\r?\n/)) {
    if (!ROADMAP_ROW.test(line)) continue

    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim())
    if (cells.length !== 6) {
      throw new Error(`roadmap row must have six columns: ${line}`)
    }

    const [id, phase, status, requirement, blocker, gate] = cells
    rows.push({ id, phase, status, requirement, blocker, gate })
  }

  return rows
}

function hasNominalEvidence(row) {
  if (!row.gate || GENERIC_EVIDENCE.test(row.gate)) return false
  if (GENERIC_EVIDENCE.test(row.blocker) && GENERIC_GATE.test(row.gate)) return false
  if (GENERIC_GATE.test(row.gate) && GENERIC_EVIDENCE.test(row.requirement)) return false
  return !GENERIC_GATE.test(row.gate) || !GENERIC_EVIDENCE.test(row.blocker)
}

export function validateRoadmapRows(rows, expectedCount = EXPECTED_ROADMAP_COUNT) {
  if (rows.length !== expectedCount) {
    throw new Error(`expected ${expectedCount} roadmap rows, received ${rows.length}`)
  }

  const seen = new Set()
  for (const row of rows) {
    if (seen.has(row.id)) {
      throw new Error(`duplicate roadmap ID ${row.id}`)
    }
    seen.add(row.id)

    if (!/^F\d+\.\d{2}$/.test(row.id)) {
      throw new Error(`invalid roadmap ID ${row.id}`)
    }
    if (!/^F\d+$/.test(row.phase)) {
      throw new Error(`invalid phase ${row.phase} for ${row.id}`)
    }
    if (!ALLOWED_STATUSES.has(row.status)) {
      throw new Error(`invalid status ${row.status} for ${row.id}`)
    }
    if (row.status === 'VERIFIED' && !hasNominalEvidence(row)) {
      throw new Error(`VERIFIED item ${row.id} has no evidence`)
    }
  }

  return rows
}

export function buildLedger(rows) {
  const statusCounts = Object.fromEntries(
    [...new Set(rows.map((row) => row.status))]
      .sort()
      .map((status) => [status, rows.filter((row) => row.status === status).length]),
  )

  return {
    schemaVersion: 1,
    source: 'docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md',
    expectedCount: rows.length,
    records: rows,
    statusCounts,
  }
}

async function loadLedger() {
  const markdown = await readFile(ROADMAP_PATH, 'utf8')
  const rows = validateRoadmapRows(parseRoadmapTable(markdown))
  return buildLedger(rows)
}

function printSummary(ledger) {
  console.log(`records=${ledger.records.length} unique=${new Set(ledger.records.map((row) => row.id)).size}`)
  for (const [status, count] of Object.entries(ledger.statusCounts)) {
    console.log(`${status}=${count}`)
  }
}

export async function run(argv = process.argv.slice(2)) {
  const mode = argv.length === 0 ? '--check' : argv[0]
  if (argv.length > 1 || !['--check', '--write'].includes(mode)) {
    throw new Error('usage: node scripts/roadmap-ledger.mjs [--check|--write]')
  }

  const ledger = await loadLedger()
  if (mode === '--write') {
    await writeFile(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8')
  }
  printSummary(ledger)
  return ledger
}

const isEntrypoint = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isEntrypoint) {
  run().catch((error) => {
    console.error(`roadmap-ledger: ${error.message}`)
    process.exitCode = 1
  })
}
