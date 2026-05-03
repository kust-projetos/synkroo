---
name: supabase-rls-bug-fix-2026-04-29
description: Bug de RLS em API routes - createTypedClient vs createClient
type: project
---

# Bug: API Routes sem dados por RLS - 2026-04-29

## Problema

Todas as páginas do dashboard mostravam "Nenhum paciente cadastrado" mesmo tendo dados no Supabase.

**Sintoma:** Session autenticada OK, mas `/api/patients` retornava `{"patients":[],"pagination":{"total":0}}`.

## Causa Raiz

API routes usavam `createTypedClient()` (browser client) em vez de `createClient()` (server client com cookies).

```typescript
// ERRADO - createTypedClient não tem cookies de sessão
const supabase = await createTypedClient()

// CERTO - createClient usa cookies do browser
const supabase = await createClient()
```

`createTypedClient()` usa `createBrowserClient()` que não propaga sessão via cookies - ignora RLS corretamente mas não tem acesso aos dados do usuário logado.

## Arquivos Corrigidos

### API Routes principais (já corrigidos)
- `src/app/api/patients/route.ts`
- `src/app/api/appointments/route.ts`

### Outros 34 arquivos com mesmo problema
```
agent/decisions/route.ts
agent/pending-actions/route.ts
agent/schedule-flow/route.ts
appointments/[id]/cancel/route.ts
appointments/[id]/confirm/route.ts
appointments/[id]/noshow/route.ts
appointments/[id]/reactivate/route.ts
appointments/[id]/reminder-template/route.ts
appointments/[id]/reschedule/route.ts
appointments/[id]/route.ts
budgets/[id]/route.ts
campaigns/segments/preview/route.ts
clinics/settings/route.ts
contacts/[id]/appointments/route.ts
dashboard/alerts/route.ts
dashboard/stats/route.ts
knowledge/[id]/route.ts
knowledge/categories/route.ts
knowledge/route.ts
knowledge/search/route.ts
leads/[id]/route.ts
leads/[id]/stage/route.ts
lgpd/anonymize/route.ts
lgpd/export/route.ts
patients/[id]/history/route.ts
patients/[id]/observations/route.ts
patients/[id]/preferences/route.ts
patients/[id]/route.ts
pipeline/analytics/route.ts
reports/export/route.ts
reports/patients/route.ts
treatment-plans/[id]/sessions/route.ts
waitlist/route.ts
whatsapp/evolution/route.ts
whatsapp/webhook/route.ts
```

## Correção

Substituir no início de cada arquivo:
```typescript
// Antes
import { createTypedClient } from '@/lib/supabase/typed'

// Depois
import { createClient } from '@/lib/supabase/server'
```

E substituir todas as chamadas:
```typescript
// Antes
const supabase = await createTypedClient()

// Depois
const supabase = await createClient()
```

## Credenciais E2E

| Ambiente | Email | Senha |
|----------|-------|-------|
| E2E | admin@clinicademo.com | demo123 |

## Verificação

Após correção, página `/dashboard/pacientes` carrega todos os pacientes corretamente.
