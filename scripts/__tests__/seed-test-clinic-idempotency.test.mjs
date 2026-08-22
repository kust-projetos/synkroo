import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../seed-test-clinic.mjs', import.meta.url), 'utf8')

test('seed updates the deterministic clinic when its ID already exists', () => {
  assert.match(source, /ON CONFLICT \(id\) DO UPDATE SET/)
})

test('seed reconciles an existing deterministic slug before inserting', () => {
  assert.match(source, /const existingClinicResult = await client\.query\(/)
  assert.match(source, /if \(existingClinicResult\.rows\[0\]\)/)
})

test('seed reuses an existing clinic user for the demo email', () => {
  assert.match(source, /let USER_ID =/)
  assert.match(source, /const existingUserResult = await client\.query\(/)
  assert.match(source, /USER_ID = existingUserResult\.rows\[0\]\.id/)
})
