jest.unmock('@/lib/db/client')

import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/lib/db/client'
import { clinics, treatmentPlanItems, treatmentPlans } from '@/lib/db/schema'
import { patients } from '@/modules/operacional/schema'
import { updateSessionProgress } from '@/services/treatment-plans/treatment-plan.service'

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip

describeOrSkip('Treatment session progress — PostgreSQL concurrency', () => {
  const suffix = Date.now()
  const clinicId = randomUUID()
  const patientId = randomUUID()
  const planId = randomUUID()
  const itemId = randomUUID()

  beforeAll(async () => {
    const db = getDb()
    await db.insert(clinics).values({
      id: clinicId,
      name: `Session Clinic ${suffix}`,
      slug: `session-clinic-${suffix}`,
      phone: '+5500000000000',
      email: `session-${suffix}@test.local`,
    })
    await db.insert(patients).values({
      id: patientId,
      clinicId,
      name: 'Session Patient',
      phone: `+5511${String(suffix).slice(-8)}`,
    })
    await db.insert(treatmentPlans).values({
      id: planId,
      clinicId,
      patientId,
      title: 'Concurrent Plan',
      totalSessions: 1,
      completedSessions: 0,
      status: 'active',
    })
    await db.insert(treatmentPlanItems).values({
      id: itemId,
      treatmentPlanId: planId,
      procedureName: 'Concurrent Session',
      sessionNumber: 1,
      status: 'pending',
    })
  })

  afterAll(async () => {
    const db = getDb()
    await db.delete(treatmentPlanItems).where(eq(treatmentPlanItems.id, itemId))
    await db.delete(treatmentPlans).where(eq(treatmentPlans.id, planId))
    await db.delete(patients).where(eq(patients.id, patientId))
    await db.delete(clinics).where(eq(clinics.id, clinicId))
    await closeDb()
  })

  it('completes once under concurrency and remains idempotent on retry', async () => {
    await Promise.all([
      updateSessionProgress(itemId, planId, clinicId),
      updateSessionProgress(itemId, planId, clinicId),
    ])
    await updateSessionProgress(itemId, planId, clinicId)

    const [plan] = await getDb()
      .select({ completedSessions: treatmentPlans.completedSessions, status: treatmentPlans.status })
      .from(treatmentPlans)
      .where(eq(treatmentPlans.id, planId))
    const [item] = await getDb()
      .select({ status: treatmentPlanItems.status })
      .from(treatmentPlanItems)
      .where(eq(treatmentPlanItems.id, itemId))

    expect(plan).toEqual({ completedSessions: 1, status: 'completed' })
    expect(item.status).toBe('completed')
  })
})
