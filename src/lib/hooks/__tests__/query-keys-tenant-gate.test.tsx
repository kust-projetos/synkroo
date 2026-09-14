/**
 * @jest-environment jsdom
 *
 * G1 — gate anti-regressão do cache multi-tenant.
 * Estratégia: validação por EXECUÇÃO das factories (robusta, não frágil) +
 * varredura dos usos de cache em components/lib-ui/hooks: todo `queryKey`,
 * `getQueryData`, `setQueryData` ou `invalidateQueries` precisa passar por
 * `queryKeys.` / `clinicScope(` ou por `predicate` — caso contrário o tenant
 * vaza entre clínicas. Se uma queryKey multi-tenant deixar de carregar o
 * clinicId no segmento [1], este teste quebra.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
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
      queryKeys.contactAppointments('c-1', CLINIC),
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

  it('nenhum uso de cache fora da factory em components / lib-ui / hooks', () => {
    const roots = ['src/components', 'src/lib/ui', 'src/lib/hooks', 'src/hooks']
    // Flag: qualquer acesso a cache do TanStack...
    const flagRe = /queryKey\s*:|getQueryData|setQueryData|setQueriesData|invalidateQueries/
    // ...passa se for via factory central, helper ou predicate com escopo.
    // `duplicateKeys.` é a factory central de duplicatas (usa clinicScope).
    const passRe = /queryKeys\.|duplicateKeys\.|clinicScope\s*\(|predicate/
    // Allowlist explícita e enxuta: variável derivada da factory central.
    const allowlist: Record<string, RegExp> = {
      // kanbanKey = queryKeys.kanbanLeads(clinicId) — fonte única central.
      'src/hooks/use-kanban.ts': /kanbanKey/,
    }

    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) {
          if (entry === '__tests__') continue
          walk(full, out)
        } else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry)) {
          out.push(full.replace(/\\/g, '/'))
        }
      }
      return out
    }

    const violations: string[] = []
    for (const root of roots) {
      for (const file of walk(root)) {
        const lines = readFileSync(file, 'utf8').split('\n')
        lines.forEach((raw, i) => {
          const line = raw.replace(/\/\/.*$/, '')
          if (!flagRe.test(line)) return
          // Janela de bloco: predicate/factory podem estar nas linhas seguintes
          // (ex.: invalidateQueries({\n  predicate: ... })).
          const block = lines
            .slice(i, i + 5)
            .join('\n')
            .replace(/\/\/.*$/gm, '')
          if (passRe.test(block)) return
          const allowed = allowlist[file]
          if (allowed && allowed.test(block)) return
          violations.push(`${file}:${i + 1}: ${raw.trim()}`)
        })
      }
    }
    expect(violations).toEqual([])
  })

  it('whatsapp não confunde contactId com telefone e sempre resolve o tenant', () => {
    const src = readFileSync('src/lib/hooks/use-whatsapp-messages.ts', 'utf8')
    // Regressão: o telefone era passado como contactId na invalidação.
    expect(src).not.toMatch(/whatsappMessages\(contactPhone\)/)
    expect(src).toMatch(/useResolvedClinicId|useCurrentClinicId/)
  })
})
