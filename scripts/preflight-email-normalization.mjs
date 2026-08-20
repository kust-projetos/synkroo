import { Client } from 'pg'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function validatePreflightDatabaseUrl(url) {
  if (!url || typeof url !== 'string') throw new Error('DATABASE_URL is required')
  const parsed = new URL(url)
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL protocol must be postgres or postgresql')
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('DATABASE_URL must point to loopback for preflight')
  }
  if (parsed.pathname !== '/synkroo_test') {
    throw new Error('DATABASE_URL database must be synkroo_test for preflight')
  }
  return url
}

export function summarizeDuplicateRows(rows) {
  return rows.map((row) => ({
    clinicId: row.clinic_id,
    duplicateCount: Number(row.duplicate_count),
  }))
}

export async function runPreflight(databaseUrl = process.env.DATABASE_URL) {
  const connectionString = validatePreflightDatabaseUrl(databaseUrl)
  const client = new Client({ connectionString })
  await client.connect()
  try {
    const result = await client.query(`
      SELECT clinic_id, COUNT(*)::int AS duplicate_count
      FROM users
      GROUP BY clinic_id, lower(btrim(email))
      HAVING COUNT(*) > 1
      ORDER BY clinic_id
    `)
    return {
      database: 'synkroo_test',
      readOnly: true,
      duplicateGroups: summarizeDuplicateRows(result.rows),
    }
  } finally {
    await client.end()
  }
}

export async function run(argv = process.argv.slice(2)) {
  const mode = argv.length === 0 ? '--check' : argv[0]
  if (argv.length > 1 || !['--check', '--json'].includes(mode)) {
    throw new Error('usage: node scripts/preflight-email-normalization.mjs [--check|--json]')
  }
  const result = await runPreflight()
  if (mode === '--json') console.log(JSON.stringify(result, null, 2))
  else console.log(`duplicate_groups=${result.duplicateGroups.length} read_only=${result.readOnly}`)
  return result
}

const isEntrypoint = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isEntrypoint) {
  run().catch((error) => {
    console.error(`preflight-email-normalization: ${error.message}`)
    process.exitCode = 1
  })
}
