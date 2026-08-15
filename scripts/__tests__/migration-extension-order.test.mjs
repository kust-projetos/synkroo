import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readMigration = (name) => readFile(new URL(`../../src/lib/db/migrations/${name}`, import.meta.url), 'utf8')

test('database extensions precede dependent schema objects', async () => {
  const base = await readMigration('0000_jazzy_strong_guy.sql')
  const overlap = await readMigration('0001_dapper_overlap.sql')

  assert.ok(base.indexOf('CREATE EXTENSION IF NOT EXISTS vector') < base.indexOf('vector(1536)'))
  assert.ok(overlap.indexOf('CREATE EXTENSION IF NOT EXISTS btree_gist') < overlap.indexOf('EXCLUDE USING gist'))
})
