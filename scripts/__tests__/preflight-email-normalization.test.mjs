import assert from 'node:assert/strict'
import test from 'node:test'
import {
  summarizeDuplicateRows,
  validatePreflightDatabaseUrl,
} from '../preflight-email-normalization.mjs'

test('accepts only loopback synkroo_test URLs', () => {
  assert.equal(
    validatePreflightDatabaseUrl('postgresql://user:pass@127.0.0.1:55432/synkroo_test'),
    'postgresql://user:pass@127.0.0.1:55432/synkroo_test',
  )
  assert.throws(
    () => validatePreflightDatabaseUrl('postgresql://user:pass@db.example/synkroo_test'),
    /loopback/,
  )
  assert.throws(
    () => validatePreflightDatabaseUrl('postgresql://user:pass@127.0.0.1:55432/synkroo'),
    /synkroo_test/,
  )
})

test('summarizes duplicate groups without email values', () => {
  const result = summarizeDuplicateRows([
    { clinic_id: 'clinic-a', duplicate_count: '2', normalized_email: 'secret@example.test' },
    { clinic_id: 'clinic-b', duplicate_count: 3, normalized_email: 'other@example.test' },
  ])

  assert.deepEqual(result, [
    { clinicId: 'clinic-a', duplicateCount: 2 },
    { clinicId: 'clinic-b', duplicateCount: 3 },
  ])
  assert.doesNotMatch(JSON.stringify(result), /secret@example|other@example/)
})

test('preflight summary has no write operation', () => {
  const source = process.env.PREFLIGHT_SOURCE ?? ''
  assert.equal(source.includes('INSERT') || source.includes('UPDATE') || source.includes('DELETE'), false)
})
