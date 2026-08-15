import { emailSchema, normalizeEmail } from '../common'

describe('email normalization', () => {
  it('trims and case-folds e-mail identity before validation', () => {
    expect(normalizeEmail('  USER@Example.TEST  ')).toBe('user@example.test')
    expect(emailSchema.parse('  USER@Example.TEST  ')).toBe('user@example.test')
  })

  it('rejects invalid normalized e-mail values', () => {
    expect(() => emailSchema.parse('  not-an-email  ')).toThrow()
  })
})
