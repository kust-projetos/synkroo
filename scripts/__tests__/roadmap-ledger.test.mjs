import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLedger, parseRoadmapTable, validateRoadmapRows } from '../roadmap-ledger.mjs'

const header = '| ID | Phase | Status | Requirement from roadmap | Blocking condition | Evidence source / next gate |\n|---|---|---|---|---|---|\n'
const row = (id = 'F0.01', status = 'DEFERRED', evidence = 'decision record needed', gate = 'W0 gate') =>
  `| ${id} | F0 | ${status} | Freeze | ${evidence} | ${gate} |\n`

test('parses six-column roadmap rows and ignores non-row prose', () => {
  const rows = parseRoadmapTable(`# heading\n${header}${row()}tail\n`)

  assert.deepEqual(rows, [{
    id: 'F0.01',
    phase: 'F0',
    status: 'DEFERRED',
    requirement: 'Freeze',
    blocker: 'decision record needed',
    gate: 'W0 gate',
  }])
})

test('rejects duplicate IDs', () => {
  assert.throws(
    () => validateRoadmapRows(parseRoadmapTable(header + row() + row()), 2),
    /duplicate roadmap ID F0.01/,
  )
})

test('rejects invalid statuses', () => {
  assert.throws(
    () => validateRoadmapRows(parseRoadmapTable(header + row('F0.01', 'INVALID')), 1),
    /invalid status INVALID for F0.01/,
  )
})

test('requires the expected row count', () => {
  assert.throws(
    () => validateRoadmapRows(parseRoadmapTable(header + row()), 143),
    /expected 143 roadmap rows, received 1/,
  )
})

test('rejects VERIFIED rows without nominal evidence', () => {
  assert.throws(
    () => validateRoadmapRows(parseRoadmapTable(header + row('F0.01', 'VERIFIED', 'none', 'W0 gate')), 1),
    /VERIFIED item F0.01 has no evidence/,
  )
  assert.throws(
    () => validateRoadmapRows(parseRoadmapTable(header + row('F0.01', 'VERIFIED', 'evidence exists', 'generic wave gate')), 1),
    /VERIFIED item F0.01 has no evidence/,
  )
})

test('builds a stable ledger record with a sanitized status count', () => {
  const ledger = buildLedger(validateRoadmapRows(parseRoadmapTable(header + row()), 1))

  assert.deepEqual(ledger.records, [{
    id: 'F0.01',
    phase: 'F0',
    status: 'DEFERRED',
    requirement: 'Freeze',
    blocker: 'decision record needed',
    gate: 'W0 gate',
  }])
  assert.deepEqual(ledger.statusCounts, { DEFERRED: 1 })
})
