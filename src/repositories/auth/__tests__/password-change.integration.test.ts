
jest.unmock('@/lib/db/client')

import { eq } from 'drizzle-orm'
import { changeUserPassword, createUserWithClinic, revokeUserSession } from '../index'
import { closeDb, getDb } from '@/lib/db/client'
import { clinics, userCredentials, users } from '@/lib/db/schema'
import { roles, rolePermissions, userClinicAccess } from '@/modules/core/schema/rbac'
import { verifyPassword } from '@/lib/auth/password'

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip

describeOrSkip('Password change — DB real', () => {
  const unique = Date.now()
  const email = `password+${unique}@integration-test.local`
  const clinicName = `Password Change Test ${unique}`
  const initialPassword = 'initial-password-123'
  let clinicId: string
  let userId: string

  afterAll(async () => {
    const db = getDb()
    if (clinicId && userId) {
      await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, userId))
      await db.delete(userCredentials).where(eq(userCredentials.userId, userId))
      await db.delete(users).where(eq(users.id, userId))
      const roleRows = await db.select({ id: roles.id }).from(roles).where(eq(roles.clinicId, clinicId))
      for (const role of roleRows) {
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id))
      }
      await db.delete(roles).where(eq(roles.clinicId, clinicId))
      await db.delete(clinics).where(eq(clinics.id, clinicId))
    }
    await closeDb()
  })

  it('updates credentials and revokes the previous session version', async () => {
    const profile = await createUserWithClinic({
      email,
      password: initialPassword,
      name: 'Password Test User',
      clinicName,
    })
    userId = profile.id
    clinicId = profile.clinicId

    const [before] = await getDb()
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId))
    const result = await changeUserPassword(userId, initialPassword, 'next-password-456')

    expect(result).toEqual({ ok: true })

    const [after] = await getDb()
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId))
    const [credential] = await getDb()
      .select({ passwordHash: userCredentials.passwordHash })
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId))

    expect(after.sessionVersion).toBe(before.sessionVersion + 1)
    expect(await verifyPassword('next-password-456', credential.passwordHash)).toBe(true)
    expect(await verifyPassword(initialPassword, credential.passwordHash)).toBe(false)
  })

  it('increments session version for explicit session revocation', async () => {
    const [before] = await getDb()
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId))

    await revokeUserSession(userId)

    const [after] = await getDb()
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId))

    expect(after.sessionVersion).toBe(before.sessionVersion + 1)
  })

  it('allows at most one concurrent change using the same current password', async () => {
    const [before] = await getDb()
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId))

    const results = await Promise.all([
      changeUserPassword(userId, 'next-password-456', 'concurrent-password-a'),
      changeUserPassword(userId, 'next-password-456', 'concurrent-password-b'),
    ])

    expect(results.filter((result) => result.ok)).toHaveLength(1)

    const [after] = await getDb()
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId))
    expect(after.sessionVersion).toBe(before.sessionVersion + 1)
  })
})
