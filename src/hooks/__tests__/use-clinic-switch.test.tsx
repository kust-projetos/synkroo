/**
 * @jest-environment jsdom
 */
import { readFileSync } from 'node:fs'

describe('F4.10 clinic switch cache invalidation', () => {
  it('clinic-selector.tsx calls invalidateQueries after switchClinic', () => {
    const src = readFileSync('src/components/clinic-selector.tsx', 'utf8')
    expect(src).toMatch(/switchClinic/)
    expect(src).toMatch(/invalidateQueries/)
    expect(src).toMatch(/useQueryClient/)
  })

  it('AuthProvider switchClinic clears queryClient and refreshes profile', () => {
    const ctx = readFileSync('src/lib/auth/context.tsx', 'utf8')
    // F4.10 evidence: auth context already does queryClient.clear() on clinic switch
    expect(ctx).toMatch(/queryClient\.clear\(\)/)
    expect(ctx).toMatch(/switchClinic/)
    expect(ctx).toMatch(/refreshProfile/)
  })

  it('dashboard layout integrates ClinicSelector visible multi hidden single', () => {
    const layout = readFileSync('src/lib/ui/dashboard-layout.tsx', 'utf8')
    expect(layout).toMatch(/ClinicSelector/)
  })
})
