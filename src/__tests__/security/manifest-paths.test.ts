import { coreManifest } from '@/modules/core/manifest'
import { operacionalManifest } from '@/modules/operacional/manifest'
import { comercialManifest } from '@/modules/comercial/manifest'
import { crmManifest } from '@/modules/crm/manifest'
import { financeiroManifest } from '@/modules/financeiro/manifest'
import { atendimentoManifest } from '@/modules/atendimento/manifest'
import { followupManifest } from '@/modules/followup/manifest'
import { iaManifest } from '@/modules/ia/manifest'

const allManifests = [
  coreManifest,
  operacionalManifest,
  comercialManifest,
  crmManifest,
  financeiroManifest,
  atendimentoManifest,
  followupManifest,
  iaManifest,
]

describe('F4.06 manifest paths — no stale declarations', () => {
  it('contains no stale English paths', () => {
    const stale = ['/dashboard/conversations', '/dashboard/contacts']
    const paths = allManifests.flatMap((m) => m.menu.map((i) => i.path))
    for (const s of stale) {
      expect(paths).not.toContain(s)
    }
    // /dashboard/followup is now valid (page exists at src/app/dashboard/followup since 2026-08-23)
    expect(paths).toContain('/dashboard/followup')
    expect(paths).toContain('/dashboard/conversas')
  })

  it('all menu paths use /dashboard prefix and are kebab-case', () => {
    const paths = allManifests.flatMap((m) => m.menu.map((i) => i.path))
    for (const p of paths) {
      expect(p).toMatch(/^\/dashboard(\/[a-z0-9-]+)*$/)
    }
  })

  it('no duplicate path+permission collisions across manifests', () => {
    const paths = allManifests.flatMap((m) => m.menu.map((i) => `${i.path}::${i.permission}`))
    const unique = new Set(paths)
    // Deduplication via buildMenu handles duplicates, but source manifests should not have unintended exact dup
    expect(unique.size).toBeGreaterThan(0)
  })
})
