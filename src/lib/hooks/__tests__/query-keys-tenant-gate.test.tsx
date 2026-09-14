/**
 * @jest-environment jsdom
 *
 * G1 — gate anti-regressão do cache multi-tenant.
 * Estratégia: validação por EXECUÇÃO das factories (robusta, não frágil) +
 * checagem leve de que os hooks migrados passam pelo helper central.
 * Se uma queryKey multi-tenant deixar de carregar o clinicId no segmento [1],
 * este teste quebra.
 */

import { readFileSync } from 'node:fs'
import { clinicScope, duplicateKeys, queryKeys } from '@/lib/hooks/use-queries'

const CLINIC = 'clinic-GATE'

function expectTenantScoped(key: readonly unknown[]) {
  expect(Array.isArray(key)).toBe(true)
  expect(key[0]).toBe('clinic')
  expect(key[1]).toBe(CLINIC)
}

describe('G1 tenant-key gate (execution-based)', () => {
  it('todas as queryKeys multi-tenant carregam o clinicId via clinicScope', () => {
    const scoped: Array<readonly unknown[]> = [
      queryKeys.dashboardStats(CLINIC),
      queryKeys.patients('page=1', CLINIC),
      queryKeys.inactivePatients('min_days=30', CLINIC),
      queryKeys.inactiveStats(CLINIC),
      queryKeys.dentists(CLINIC),
      queryKeys.procedures(CLINIC),
      queryKeys.appointments('status=scheduled', CLINIC),
      queryKeys.leads('status=new', CLINIC),
      queryKeys.leadStats(CLINIC),
      queryKeys.leadNotifications(CLINIC),
      queryKeys.crmStats(CLINIC),
      queryKeys.campaigns('page=1', CLINIC),
      queryKeys.conversations('status=open', CLINIC),
      queryKeys.conversation('conv-1', CLINIC),
      queryKeys.analytics('period=30d', CLINIC),
      queryKeys.waitlist(CLINIC),
      queryKeys.settings(CLINIC),
      queryKeys.patient('p-1', CLINIC),
      queryKeys.dentist('d-1', CLINIC),
      queryKeys.procedure('pr-1', CLINIC),
      queryKeys.appointment('a-1', CLINIC),
      queryKeys.lead('l-1', CLINIC),
      queryKeys.campaign('c-1', CLINIC),
      queryKeys.contacts('page=1', CLINIC),
      queryKeys.contact('c-1', 'patient', CLINIC),
      queryKeys.contactNotes('c-1', 'patient', CLINIC),
      queryKeys.calendarEvents('month=2026-08', CLINIC),
      queryKeys.customFieldDefinitions(CLINIC),
      queryKeys.customFieldValues('c-1', 'patient', CLINIC),
      queryKeys.contactTimeline('c-1', 'patient', 'whatsapp', CLINIC),
      queryKeys.consents('c-1', 'lead', CLINIC),
      queryKeys.whatsappMessages('c-1', CLINIC),
      queryKeys.kanbanLeads(CLINIC),
      queryKeys.pipelineStages(CLINIC),
      queryKeys.leadsByPatient('pat-1', CLINIC),
      queryKeys.budgets(CLINIC),
      queryKeys.budgetPayments('b-1', CLINIC),
      queryKeys.budget('b-1', CLINIC),
      queryKeys.collections(CLINIC),
      queryKeys.gateways(CLINIC),
      queryKeys.financeDashboard(CLINIC),
      queryKeys.tasks({ status: 'pending' }, CLINIC),
      queryKeys.activities({ sourceFilter: 'sms' }, CLINIC),
      queryKeys.duplicates(CLINIC),
      queryKeys.duplicateList('{}', CLINIC),
      duplicateKeys.all(CLINIC),
      duplicateKeys.list('{}', CLINIC),
    ]

    expect(scoped.length).toBeGreaterThan(40)
    for (const key of scoped) expectTenantScoped(key)
  })

  it('clinicScope usa o sentinel "unscoped" quando a clínica é desconhecida', () => {
    expect(clinicScope(undefined, 'patients', 'x')).toEqual(['clinic', 'unscoped', 'patients', 'x'])
    expect(clinicScope(null, 'patients', 'x')).toEqual(['clinic', 'unscoped', 'patients', 'x'])
  })

  it('hooks migrados passam pelo helper central (sem chaves literais paralelas)', () => {
    const migrated = [
      'src/hooks/useTreatmentPlans.ts',
      'src/hooks/usePayments.ts',
      'src/hooks/useFinancialSummary.ts',
      'src/hooks/use-kanban.ts',
    ]
    for (const file of migrated) {
      const src = readFileSync(file, 'utf8')
      expect(src).toMatch(/clinicScope\(|queryKeys\.kanbanLeads\(/)
      // Nenhuma chave de cache literal paralela: todo queryKey passa pelo helper.
      expect(src).not.toMatch(/queryKey:\s*\[/)
    }
  })
})
