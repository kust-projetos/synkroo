import { Pool } from 'pg'
import { getDb, closeDb } from '@/lib/db/client'
import { enqueueOutboxForTests, claimOutboxJob, markOutboxRetry } from '@/lib/outbox/outbox-repository'

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip
let clinicId: string
const keyPrefix = `outbox-integration:${process.pid}:${Date.now()}`
let pool: Pool

async function cleanup() {
  await pool.query('DELETE FROM outbox_jobs WHERE business_key LIKE $1', [`${keyPrefix}%`])
}

describeIntegration('transactional outbox against PostgreSQL', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
    clinicId = (await pool.query('SELECT id FROM clinics LIMIT 1')).rows[0]?.id
    if (!clinicId) throw new Error('integration fixture requires a clinic')
  })

  afterEach(cleanup)

  afterAll(async () => {
    await pool.end()
    await closeDb()
  })

  it('enqueues a business key once under concurrent producers', async () => {
    const db = getDb()
    const job = {
      clinicId: clinicId,
      operation: 'integration.test',
      businessKey: `${keyPrefix}:unique`,
      payload: { attempt: 1 },
    }

    const rows = await Promise.all([enqueueOutboxForTests(db, job), enqueueOutboxForTests(db, job)])

    expect(rows.filter(Boolean)).toHaveLength(1)
    await expect(pool.query('SELECT COUNT(*) FROM outbox_jobs WHERE business_key = $1', [job.businessKey]))
      .resolves.toMatchObject({ rows: [{ count: '1' }] })
  })

  it('claims one pending job and retries it with bounded backoff', async () => {
    const db = getDb()
    const businessKey = `${keyPrefix}:claim`
    const enqueued = await enqueueOutboxForTests(db, {
      clinicId: clinicId,
      operation: 'integration.test',
      businessKey,
      payload: { safe: true },
    })
    expect(enqueued?.id).toBeDefined()
    const jobId = enqueued!.id

    let claimed = [] as NonNullable<Awaited<ReturnType<typeof claimOutboxJob>>>[]
    for (let attempt = 0; attempt < 5; attempt++) {
      const claims = await Promise.all([
        claimOutboxJob({ operations: ['integration.test'], jobId }),
        claimOutboxJob({ operations: ['integration.test'], jobId }),
      ])
      claimed = claims.filter(Boolean) as NonNullable<typeof claims[number]>[]
      if (claimed.length !== 0) break
      if (attempt < 4) await new Promise((r) => setTimeout(r, 120))
    }
    if (claimed.length === 0) {
      const pending = await pool.query('SELECT COUNT(*) FROM outbox_jobs WHERE business_key = $1 AND status = $2', [businessKey, 'pending'])
      throw new Error(`outbox claim never succeeded after 5 attempts (pending=${pending.rows[0]?.count} businessKey=${businessKey})`)
    }
    expect(claimed).toHaveLength(1)
    expect(claimed[0]?.status).toBe('processing')
    expect(claimed[0]?.claimGeneration).toBe(1)

    // Liquidação cercada pelo lease devolvido pelo claim.
    await markOutboxRetry(claimed[0]!.id, claimed[0]!.claimGeneration, claimed[0]!.attempts, 'TEST_FAILURE', new Date())
    const row = await pool.query(
      'SELECT status, attempts, last_error_code, next_attempt_at > NOW() AS delayed FROM outbox_jobs WHERE business_key = $1',
      [businessKey],
    )
    expect(row.rows[0]).toMatchObject({ status: 'pending', attempts: 1, last_error_code: 'TEST_FAILURE', delayed: true })
  })
})
