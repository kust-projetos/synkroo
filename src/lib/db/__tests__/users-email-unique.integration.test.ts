/** @jest-environment node */

import { inArray, sql } from 'drizzle-orm'
import { closeDb, getDb } from '@/lib/db/client'
import { users } from '@/lib/db/schema/core'

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip

const CLINIC_A = '00000000-0000-0000-0000-00000000aa01'
const CLINIC_B = '00000000-0000-0000-0000-00000000bb01'
const USER_A = '00000000-0000-0000-0000-00000000cc01'
const USER_B = '00000000-0000-0000-0000-00000000cc02'
const USER_C = '00000000-0000-0000-0000-00000000cc03'
const EMAIL = 'email-unique@integration.test'
const EMAIL_VARIANT = '  EMAIL-UNIQUE@INTEGRATION.TEST  '
async function cleanup() {
  const db = getDb()
  await db.delete(users).where(inArray(users.id, [USER_A, USER_B, USER_C]))
  await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`)
}

describeOrSkip('users clinic email uniqueness (DB real)', () => {
  beforeAll(async () => {
    const db = getDb()
    await cleanup()
    await db.execute(sql`
      INSERT INTO clinics (id, name, slug, phone, email)
      VALUES
        (${CLINIC_A}, 'Email Unique Clinic A', 'email-unique-a', '11999991001', 'a@email-unique.test'),
        (${CLINIC_B}, 'Email Unique Clinic B', 'email-unique-b', '11999991002', 'b@email-unique.test')
    `)
  })

  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  it('rejects the same email twice within one clinic', async () => {
    const db = getDb()
    await db.insert(users).values({
      id: USER_A,
      clinicId: CLINIC_A,
      email: EMAIL_VARIANT,
      name: 'Email Unique A',
      role: 'owner',
    })

    await expect(db.insert(users).values({
      id: USER_B,
      clinicId: CLINIC_A,
      email: EMAIL,
      name: 'Email Unique B',
      role: 'owner',
    })).rejects.toThrow(/unique|duplicate|users_clinic_email_uniq/i)
  })

  it('allows the same email in different clinics', async () => {
    const db = getDb()
    await expect(db.insert(users).values({
      id: USER_C,
      clinicId: CLINIC_B,
      email: EMAIL,
      name: 'Email Unique B',
      role: 'owner',
    })).resolves.toBeDefined()
  })
})
