import { assertSeedPayload, REQUIRED_E2E_FIXTURES, type SeedPayload } from '../../../e2e/seed-validation'

const completeFixtures = Object.fromEntries(REQUIRED_E2E_FIXTURES.map((name) => [name, 1]))

function payload(overrides: Partial<SeedPayload> = {}): SeedPayload {
  return { success: true, fixtures: completeFixtures, ...overrides }
}

describe('E2E seed validation', () => {
  it('accepts a successful complete fixture payload', () => {
    expect(() => assertSeedPayload(200, payload(), '{}')).not.toThrow()
  })

  it('rejects a non-success response even when the payload claims success', () => {
    expect(() => assertSeedPayload(500, payload(), 'seed failed')).toThrow(/status=500/)
  })

  it('rejects incomplete fixtures', () => {
    const fixtures = { ...completeFixtures, appointments: 0 }

    expect(() => assertSeedPayload(200, payload({ fixtures }), '{}')).toThrow(/appointments/)
  })

  it('rejects any reported seed errors', () => {
    expect(() => assertSeedPayload(200, payload({
      failures: [{ count: 1, errors: ['campaign insert failed'] }],
    }), '{}')).toThrow(/campaign insert failed/)
  })
})
