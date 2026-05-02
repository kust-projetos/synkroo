---
gsd_state_version: 1.0
milestone: v0.3.0
milestone_name: CRM Pipeline
current_phase: Schema mismatch fix pending
status: in_progress
last_updated: "2026-05-02T21:45:00.000Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 12
  completed_plans: 9
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Clínicas conseguem gerenciar todo o relacionamento com pacientes -- do primeiro contato à fidelização -- em um único sistema integrado com WhatsApp e calendário.
**Current focus:** CRM Pipeline — schema mismatch `position` vs `sort_order`

## Current Position

v0.3.0 milestone: CRM Pipeline — IN PROGRESS
Bug identificado: pipeline_stages usa coluna `position`, código usa `sort_order`

## Session Continuity

**Last session:** 2026-05-02T21:45:00.000Z
**Session report:** `.planning/sessions/2026-05-02-crm-pipeline-debug.md`
**Resumo:** Commits feitos, AuthProvider corrigido, CRM sidebar adicionada, mas pipeline vazio por schema mismatch

## Commits from Session

| Commit | Descrição |
|--------|-----------|
| `dda6bee` | feat(crm): contacts module, CRM dashboard, pipeline pages |
| `d40a8a2` | fix(auth): prevent infinite loading spinner |
| `d1b03cd` | feat(sidebar): add CRM e Pipeline navigation |
| `b45fcd0` | feat(pipeline): seed migration stages e demo leads |
| `f3c8d92` | fix(pipeline): position instead of sort_order |

## Pending Work

| Issue | Status | Priority |
|-------|--------|----------|
| Pipeline vazio (schema mismatch) | IDENTIFIED | CRITICAL |
| E2E tests: 3 PASS, 2 FAIL | ONGOING | HIGH |
| CRM sidebar items | COMPLETE | DONE |
| AuthProvider fix | COMPLETE | DONE |

## Root Cause: Pipeline Vazio

**Problema:** `pipeline_stages` table tem coluna `position`, não `sort_order`

**Files afetados:**
- `stages.service.ts` — usa `sort_order` em queries
- `stage-column.tsx` — interface define `sort_order: number`
- 40+ arquivos usam `sort_order` para stages

**Solução:** Adicionar coluna `sort_order` ao banco OU alterar código para usar `position`

## Next Session

1. Resolver schema mismatch — adicionar `sort_order` ao banco via Supabase CLI
2. Testar pipeline com dados reais
3. E2E tests para pipeline completo

## Database Query (Supabase CLI)
```bash
cd D:/projetos/synkroo
supabase db query --linked "ALTER TABLE pipeline_stages ADD COLUMN sort_order integer; UPDATE pipeline_stages SET sort_order = position WHERE sort_order IS NULL;"
```

## Links
- Dashboard: http://localhost:3000/dashboard/crm/pipeline
- CRM page: http://localhost:3000/dashboard/crm
- Supabase: https://supabase.com/dashboard/project/jlkifrngxxayjrfunuuz