jest.unmock('@/lib/db/client')

import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/lib/db/client'
import { clinics, treatmentPlanItems, treatmentPlans } from '@/lib/db/schema'
import { patients } from '@/modules/operacional/schema'
import {
  findById,
  update,
  deleteTreatmentPlan,
  updateItem,
  completeSessionProgress,
  getProgress,
} from '@/repositories/treatment-plans'

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip

describeOrSkip('Treatment plans repository — tenancy & cross-plan predicates (DB real)', () => {
  const suffix = Date.now()
  const clinicA = randomUUID()
  const clinicB = randomUUID()
  const patientA = randomUUID()
  const patientB = randomUUID()
  const planA = randomUUID()
  const planB = randomUUID()
  const itemA = randomUUID()
  const itemB = randomUUID()

  beforeAll(async () => {
    const db = getDb()

    // Insert Clinic A and Clinic B
    await db.insert(clinics).values([
      {
        id: clinicA,
        name: `Clinic A ${suffix}`,
        slug: `clinic-a-${suffix}`,
        phone: '+5500000000001',
        email: `clinica-${suffix}@test.local`,
      },
      {
        id: clinicB,
        name: `Clinic B ${suffix}`,
        slug: `clinic-b-${suffix}`,
        phone: '+5500000000002',
        email: `clinicb-${suffix}@test.local`,
      },
    ])

    // Insert Patients
    await db.insert(patients).values([
      { id: patientA, clinicId: clinicA, name: 'Patient A', phone: `+5511${String(suffix).slice(-8)}` },
      { id: patientB, clinicId: clinicB, name: 'Patient B', phone: `+5512${String(suffix).slice(-8)}` },
    ])

    // Insert Treatment Plans
    await db.insert(treatmentPlans).values([
      {
        id: planA,
        clinicId: clinicA,
        patientId: patientA,
        title: 'Plan A Original',
        totalSessions: 3,
        completedSessions: 0,
        status: 'active',
      },
      {
        id: planB,
        clinicId: clinicB,
        patientId: patientB,
        title: 'Plan B Original',
        totalSessions: 2,
        completedSessions: 0,
        status: 'active',
      },
    ])

    // Insert Items
    await db.insert(treatmentPlanItems).values([
      {
        id: itemA,
        treatmentPlanId: planA,
        procedureName: 'Procedure A1',
        sessionNumber: 1,
        status: 'pending',
      },
      {
        id: itemB,
        treatmentPlanId: planB,
        procedureName: 'Procedure B1',
        sessionNumber: 1,
        status: 'pending',
      },
    ])
  })

  afterAll(async () => {
    const db = getDb()
    await db.delete(treatmentPlanItems).where(eq(treatmentPlanItems.id, itemA))
    await db.delete(treatmentPlanItems).where(eq(treatmentPlanItems.id, itemB))
    await db.delete(treatmentPlans).where(eq(treatmentPlans.id, planA))
    await db.delete(treatmentPlans).where(eq(treatmentPlans.id, planB))
    await db.delete(patients).where(eq(patients.id, patientA))
    await db.delete(patients).where(eq(patients.id, patientB))
    await db.delete(clinics).where(eq(clinics.id, clinicA))
    await db.delete(clinics).where(eq(clinics.id, clinicB))
    await closeDb()
  })

  it('findById rejects cross-tenant lookup and returns null when clinicId does not match', async () => {
    // Calling findById with planA but clinicB scope must return null
    const crossResult = await findById(planA, clinicB)
    expect(crossResult).toBeNull()

    // Valid clinic scope returns the plan
    const validResult = await findById(planA, clinicA)
    expect(validResult).not.toBeNull()
    expect(validResult?.id).toBe(planA)
  })

  it('update rejects cross-tenant modification and leaves foreign plan unchanged', async () => {
    // Attempt to update planA from clinicB context
    const result = await update(planA, clinicB, { title: 'Malicious Update' })
    expect(result).toBeNull()

    // Verify in DB that planA was not mutated
    const [row] = await getDb()
      .select({ title: treatmentPlans.title })
      .from(treatmentPlans)
      .where(eq(treatmentPlans.id, planA))
    expect(row.title).toBe('Plan A Original')
  })

  it('deleteTreatmentPlan rejects cross-tenant deletion and preserves foreign plan and items', async () => {
    // Attempt to delete planA using clinicB context
    const deleted = await deleteTreatmentPlan(planA, clinicB)
    expect(deleted).toBe(false)

    // Verify in DB that planA and itemA still exist
    const [plan] = await getDb()
      .select({ id: treatmentPlans.id })
      .from(treatmentPlans)
      .where(eq(treatmentPlans.id, planA))
    const [item] = await getDb()
      .select({ id: treatmentPlanItems.id })
      .from(treatmentPlanItems)
      .where(eq(treatmentPlanItems.id, itemA))
    expect(plan).toBeDefined()
    expect(item).toBeDefined()
  })

  it('updateItem rejects cross-tenant and cross-plan item modification', async () => {
    // Attempt to update itemA with clinicB context
    const crossClinic = await updateItem(itemA, planA, clinicB, { notes: 'Cross Clinic Hack' })
    expect(crossClinic).toBeNull()

    // Attempt to update itemA bound to planB
    const crossPlan = await updateItem(itemA, planB, clinicA, { notes: 'Cross Plan Hack' })
    expect(crossPlan).toBeNull()

    // Verify itemA unchanged
    const [item] = await getDb()
      .select({ notes: treatmentPlanItems.notes })
      .from(treatmentPlanItems)
      .where(eq(treatmentPlanItems.id, itemA))
    expect(item.notes).toBeNull()
  })

  it('completeSessionProgress rejects cross-tenant session completion and leaves counts unchanged', async () => {
    // Attempt to complete itemA using clinicB context
    const crossClinic = await completeSessionProgress(itemA, planA, clinicB)
    expect(crossClinic).toBeNull()

    // Attempt to complete itemA with wrong planB
    const crossPlan = await completeSessionProgress(itemA, planB, clinicA)
    expect(crossPlan).toBeNull()

    // Verify planA status and itemA status in DB are unchanged
    const [plan] = await getDb()
      .select({ completedSessions: treatmentPlans.completedSessions, status: treatmentPlans.status })
      .from(treatmentPlans)
      .where(eq(treatmentPlans.id, planA))
    const [item] = await getDb()
      .select({ status: treatmentPlanItems.status })
      .from(treatmentPlanItems)
      .where(eq(treatmentPlanItems.id, itemA))

    expect(plan.completedSessions).toBe(0)
    expect(plan.status).toBe('active')
    expect(item.status).toBe('pending')
  })

  it('getProgress rejects cross-tenant progress queries', async () => {
    const crossProgress = await getProgress(planA, clinicB)
    expect(crossProgress).toBeNull()

    const validProgress = await getProgress(planA, clinicA)
    expect(validProgress).toEqual({ totalSessions: 3, completedSessions: 0 })
  })
})
