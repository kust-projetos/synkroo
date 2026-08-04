import { Pool } from 'pg'
import { closeDb } from '@/lib/db/client'
import { tryClaimIdempotencyKey } from '@/lib/idempotency'

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip
const keyPrefix = `idempotency-integration:${process.pid}:${Date.now()}`
let pool: Pool

describeIntegration('idempotency claim against PostgreSQL', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  })

  afterEach(async () => {
    await pool.query('DELETE FROM idempotency_keys WHERE key LIKE $1', [`${keyPrefix}%`])
  })

  afterAll(async () => {
    await pool.end()
    await closeDb()
  })

  it('allows exactly one concurrent claimant', async () => {
    const key = `${keyPrefix}:race`
    const results = await Promise.all([
      tryClaimIdempotencyKey(key, 'integration-race'),
      tryClaimIdempotencyKey(key, 'integration-race'),
    ])

    expect(results.sort()).toEqual([false, true])
  })

  it('reclaims an expired in-progress claim but not a live one', async () => {
    const expiredKey = `${keyPrefix}:expired`
    await pool.query(
      `INSERT INTO idempotency_keys (key, job_type, status, expires_at)
       VALUES ($1, 'integration-expired', 'in_progress', NOW() - INTERVAL '1 minute')`,
      [expiredKey],
    )

    await expect(tryClaimIdempotencyKey(expiredKey, 'integration-expired')).resolves.toBe(true)

    const liveKey = `${keyPrefix}:live`
    await pool.query(
      `INSERT INTO idempotency_keys (key, job_type, status, expires_at)
       VALUES ($1, 'integration-live', 'in_progress', NOW() + INTERVAL '1 minute')`,
      [liveKey],
    )

    await expect(tryClaimIdempotencyKey(liveKey, 'integration-live')).resolves.toBe(false)
  })
})
