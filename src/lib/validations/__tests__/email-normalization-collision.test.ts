import { normalizeEmail } from '../common'

describe('F3.01 email normalization — same-clinic collision vs cross-clinic acceptance', () => {
  it('case/whitespace variants normalize to same identity (same-clinic collision)', () => {
    const variants = ['  USER@Example.TEST  ', 'user@example.test', ' User@EXAMPLE.test', 'USER@example.test\n']
    const normalized = variants.map(normalizeEmail)
    // All should collapse to same canonical form
    expect(new Set(normalized).size).toBe(1)
    expect(normalized[0]).toBe('user@example.test')
  })

  it('same normalized email in same clinic should be considered duplicate (simulated unique index)', () => {
    const clinicA = 'clinic-a'
    const store = new Map<string, Set<string>>()
    const key = (clinicId: string, email: string) => `${clinicId}:${normalizeEmail(email)}`

    const email1 = '  USER@Example.TEST  '
    const email2 = 'user@example.test'
    const k1 = key(clinicA, email1)
    const k2 = key(clinicA, email2)
    expect(k1).toBe(k2) // same-clinic collision detected via normalized key

    store.set(clinicA, new Set([normalizeEmail(email1)]))
    // Attempt to insert variant in same clinic => should be rejected
    const isDuplicateSameClinic = store.get(clinicA)!.has(normalizeEmail(email2))
    expect(isDuplicateSameClinic).toBe(true)
  })

  it('same normalized email in different clinics should be allowed (cross-clinic acceptance)', () => {
    const clinicA = 'clinic-a'
    const clinicB = 'clinic-b'
    const email = 'user@example.test'
    const variant = '  USER@Example.TEST  '

    const keyA = `${clinicA}:${normalizeEmail(variant)}`
    const keyB = `${clinicB}:${normalizeEmail(email)}`
    expect(keyA).not.toBe(keyB)

    const store = new Map<string, Set<string>>([
      [clinicA, new Set([normalizeEmail(variant)])],
      [clinicB, new Set()],
    ])
    // Insert same email in clinic B should not be duplicate in A
    store.get(clinicB)!.add(normalizeEmail(email))
    expect(store.get(clinicA)!.has(normalizeEmail(email))).toBe(true) // A still has it
    expect(store.get(clinicB)!.has(normalizeEmail(email))).toBe(true) // B now also has it — cross-clinic allowed
    // No cross-clinic uniqueness violation
    expect(normalizeEmail(email)).toBe('user@example.test')
  })
})
