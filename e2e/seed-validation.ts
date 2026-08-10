export interface SeedPayload {
  success?: boolean
  failures?: Array<{ count?: number; errors?: string[] }>
  fixtures?: Record<string, number>
}

export const REQUIRED_E2E_FIXTURES = [
  'clinic',
  'admin',
  'dentists',
  'procedures',
  'patients',
  'pipeline_stages',
  'leads',
  'campaigns',
  'appointments',
] as const

export function assertSeedPayload(status: number, payload: SeedPayload, rawBody: string): void {
  const fixtures = payload.fixtures ?? {}
  const missingFixtures = REQUIRED_E2E_FIXTURES.filter((name) => typeof fixtures[name] !== 'number' || fixtures[name] < 1)
  const failures = payload.failures ?? []
  const failureCount = failures.reduce((total, failure) => total + (failure.count ?? 0), 0)
  const reportedErrors = failures.flatMap((failure) => failure.errors ?? [])

  if (status < 200 || status >= 300 || payload.success !== true || missingFixtures.length > 0 || failureCount > 0 || reportedErrors.length > 0) {
    throw new Error(`E2E fixture seed failed: status=${status}; success=${String(payload.success)}; missing=${missingFixtures.join(',') || 'none'}; errors=${reportedErrors.join(' | ') || 'none'}; body=${rawBody.slice(0, 500).replace(/\s+/g, ' ')}`)
  }
}
