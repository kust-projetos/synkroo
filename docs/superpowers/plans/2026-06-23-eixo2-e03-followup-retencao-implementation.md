# Eixo 2 — Módulo Follow-up e Retenção (E-03) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar o sistema de follow-up/retenção maduro para o template canônico do Core (`app → action → service → repository → Drizzle`), cobrindo o bounded context Follow-up (pós-consulta, lembretes de retorno, inativos, campanhas, orçamentos, tratamentos incompletos) com cron jobs, Action Layer, gates reais.

**Architecture:** Toda operação passa pela Action Layer (`runAction`); rotas REST/cron viram adapters finos sobre Actions; `withModuleRoute` em rotas privadas; crons usam `assertModuleForJob` para gate; lógica de follow-up existente é portada para services do módulo.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.6, Drizzle ORM, PostgreSQL, Jest unit/integration, ESLint boundaries.

**Spec:** `docs/superpowers/specs/2026-06-23-eixo2-followup-retencao-modulo-design.md` (spec oficial do módulo E-03). Contexto adicional: `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md` (Onda 1 — E-03 depois de E-02 e E-01); `docs/planning/epics.md` (E-03); `docs/planning/stories/e-03-stories.md` (13 SP, 6 stories).

**Parent roadmap:** `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md`

**Agent Orchestration:** Single-Agent Looped — tarefas sequenciais e acopladas; cada tarefa fecha teste→implementação→verificação antes da próxima.

---

## Scope Table

| Fase | Escopo | Tasks | Aprova | Tipo |
|---|---|---|---|---|
| **F1** | Schema (tabelas de follow-up/campanhas extraídas ou bridge) | F1a–F1b | Plan + Review | Refactor |
| **F2** | Module scaffold (manifest, permissions, barrel, bootstrap) | F2a–F2c | Plan + Review | Refactor |
| **F3** | Actions de follow-up pós-consulta + retorno | F3a–F3c | Review | Refactor |
| **F4** | Actions de inatividade + reativação | F4a–F4c | Review | Refactor |
| **F5** | Actions de campanhas + segmentação | F5a–F5c | Review | Refactor |
| **F6** | Actions de orçamento follow-up + tratamentos incompletos | F6a–F6b | Review | Refactor |
| **F7** | Cron job + gates + route migration | F7a–F7e | Plan + Review | Refactor |
| **F8** | Integration tests + RBAC backfill | F8a–F8c | Review | Test |

---

## Non‑goals (explícito — não implementar nesta Onda)

- **Agente IA W5:** orquestrador que dispara follow-ups com base em contexto de conversa. E-03 só cria actions que o agente W5 pode chamar.
- **Dashboard de métricas de retenção (E-03-S04/S06):** métricas de conversão de campanhas e alertas são UI que depende de dashboard E-08. Deferir.
- **NPS/feedback scoring:** as tabelas e queries de feedback existem mas o cálculo de NPS é P2/P3.
- **Relatório de inatividade avançado:** a rota `GET /api/patients/inactive` já existe e funciona. Refatorar para action, não expandir.
- **Nova lógica de campanhas:** portar o serviço existente `campaign.service.ts` como está; não redesenhar.
- **Opt-out fora do escopo:** o sistema já respeita `optOutMarketing`. Não criar nova lógica.

---

## Scope Boundaries (relações com outros módulos)

| Módulo | Relação com E-03 |
|---|---|
| E-02 Operacional | E-03 consome `appointments.status === 'completed'` para follow-up pós-consulta. Usa `procedures.durationMonths` para lembrete de retorno. |
| E-01 Atendimento | E-03 dispara mensagens via `atendimento.enviarMensagem` (action). Não duplica lógica de envio. |
| E-05 Comercial | E-03 follow-up de orçamentos (`budgets`) reside no módulo Financeiro/Comercial, mas E-03 gerencia a lógica temporal de follow-up como action separada. |
| W5 Agente | W5 pode chamar actions de E-03 (`executarFollowup`, `listarPacientesInativos`, `executarCampanha`) como tools. |

---

## F1 — Schema Seam

Existem poucas tabelas específicas de follow-up. A maior parte opera sobre `patients`, `appointments`, `procedures`, `budgets` (tabelas de outros módulos).

### F1a — Identificar tabelas

Verificar se existem tabelas de follow-up dedicadas:

- `followup_logs` ou `followup_queue` — rastreamento de envios
- `campaign_logs` — registro de disparo de campanhas
- `inactivity_tracking` — track de inatividade

Se existirem, extrair para `src/modules/followup/schema/`. Se não existirem, pular F1 (schema bridge apenas).

### F1b — Barrel de schema

Criar `src/modules/followup/schema/index.ts` com re-exports das tabelas de outros módulos que E-03 precisa (consultas apenas).

**Se não houver tabelas novas, F1 é vazio — pular para F2.**

---

## F2 — Module Scaffold

### F2a — `src/modules/followup/manifest.ts`

```typescript
export const followupManifest = {
  id: 'followup' as const,
  name: 'Follow-up',
  alwaysOn: false,
  menu: [
    {
      moduleId: 'followup',
      permission: 'followup:view',
      label: 'Follow-up',
      path: '/dashboard/followup',
      icon: 'BellAlertIcon',
    },
    {
      moduleId: 'followup',
      permission: 'followup:manage_followups',
      label: 'Follow-up',
      path: '/dashboard/followup',
      icon: 'BellAlertIcon',
    },
  ],
  jobs: ['followup.processar'],
};
```

### F2b — `src/modules/followup/permissions.ts`

```typescript
export const followupAccessPermissions: PermissionEntry[] = [
  { key: 'followup:view', module: 'followup', label: 'Visualizar follow-up' },
  { key: 'followup:manage_followups', module: 'followup', label: 'Gerenciar follow-ups' },
  { key: 'followup:manage_campaigns', module: 'followup', label: 'Gerenciar campanhas' },
  { key: 'followup:manage_segments', module: 'followup', label: 'Gerenciar segmentos' },
];
```

### F2c — Registro no bootstrap

- `atendimentoActions` array vazio (ou com ações quando F3+ popula)
- `followupAccessPermissions` registrado em `bootstrapActions()`
- `followupManifest` em `menu-actions.ts`
- Teste guard em `bootstrap.test.ts`

**Commit checkpoint:** F2 completo.

---

## F3 — Actions de Follow-up Pós-Consulta + Lembrete Retorno

### F3a — Service bridge

Criar `src/modules/followup/services/followup-service.ts` que wrappa os serviços legados:

- `processAllFollowUps()` → executa follow-up pós-consulta
- `processReturnReminders()` → lembrete de retorno por procedimento
- `registerFollowup(clinicId, appointmentId, type)` → registra follow-up manual

### F3b — Actions

| Action | Método | Input | Retorno | Permissão |
|---|---|---|---|---|
| `followup.executarFollowup` | POST | `{ clinicId? }` | `{ processed, results }` | `followup:manage_followups` |
| `followup.registrarFollowup` | POST | `{ appointmentId, type, scheduledAt }` | `{ id }` | `followup:manage_followups` |
| `followup.listarPendentes` | GET | `{ clinicId?, page?, limit? }` | `{ items, pagination }` | `followup:view` |

**Nota:** `executarFollowup` é chamado pelo cron job ou manualmente. Delega para `processAllFollowUps()` do serviço legado.

### F3c — Barrel

Registrar em `src/modules/followup/actions/index.ts`.

**Commit checkpoint:** F3 completo.

---

## F4 — Actions de Inatividade + Reativação

### F4a — Service bridge

Criar `src/modules/followup/services/inactive-service.ts` que wrappa `inactive-patient.service.ts`:

- `runInactivityDetection()` → marca inativos
- `findInactivePatients(clinicId, minDays)` → consulta inativos
- `reactivatePatient(patientId)` → reativa manualmente

### F4b — Actions

| Action | Método | Input | Retorno | Permissão |
|---|---|---|---|---|
| `followup.detectarInativos` | POST | `{}` | `{ processed }` | `followup:manage_followups` |
| `followup.listarInativos` | GET | `{ minDays?, page?, limit? }` | `{ patients, pagination }` | `followup:view` |
| `followup.reativarPaciente` | POST | `{ patientId }` | `{ success }` | `followup:manage_followups` |

**Nota:** `detectarInativos` é chamado pelo cron ou manualmente. `listarInativos` substitui a rota `GET /api/patients/inactive` (que hoje usa `@/repositories/patients`).

### F4c — Remove `getDb()` da rota inactive

A rota `src/app/api/patients/inactive/route.ts` atual usa `@/repositories/patients`. Migrar para `withModuleRoute('followup')` + `runFollowupAction` → `followup.listarInativos`.

**Commit checkpoint:** F4 completo.

---

## F5 — Actions de Campanhas + Segmentação

### F5a — Service bridge

Criar `src/modules/followup/services/campaign-service.ts` que wrappa `campaign.service.ts` e `segmentation.service.ts`:

- `processScheduledCampaigns()` → dispara campanhas agendadas
- `findCampaigns(clinicId)` → lista campanhas da clínica
- `getSegments(clinicId)` → segmentos disponíveis

### F5b — Actions

| Action | Método | Input | Retorno | Permissão |
|---|---|---|---|---|
| `followup.executarCampanhas` | POST | `{}` | `{ processed }` | `followup:manage_campaigns` |
| `followup.listarSegmentos` | GET | `{}` | `{ segments }` | `followup:manage_segments` |

### F5c — Cron integration

A action `executarCampanhas` já processa campanhas. O cron job chama a action, não o serviço legado diretamente.

**Commit checkpoint:** F5 completo.

---

## F6 — Actions de Orçamento Follow-up + Tratamentos Incompletos

### F6a — Service bridge

Criar `src/modules/followup/services/budget-followup-service.ts` que wrappa `budget-followup.service.ts`:

- `findUnconvertedBudgets(clinicId)` → orçamentos pendentes
- `processBudgetFollowups(clinicId)` → processa sequência de follow-up

### F6b — Actions

| Action | Método | Input | Retorno | Permissão |
|---|---|---|---|---|
| `followup.listarOrcamentosPendentes` | GET | `{}` | `{ budgets, total }` | `followup:view` |
| `followup.executarFollowupOrcamentos` | POST | `{}` | `{ processed }` | `followup:manage_followups` |
| `followup.listarTratamentosIncompletos` | GET | `{ clinicId? }` | `{ treatments }` | `followup:view` |

**Nota:** `listarTratamentosIncompletos` substitui a action `operacional.listarTratamentosIncompletos` que foi criada em E-02 como bridge. Após E-03, a ação de tratamentos incompletos reside no módulo Follow-up, não no Operacional. A rota `/api/appointments/incomplete-treatments` deve ser migrada para o módulo Follow-up.

**Commit checkpoint:** F6 completo.

---

## F7 — Cron + Gates + Route Migration

### F7a — UI adapter

Criar `src/modules/followup/ui/route-adapter.ts` (padrão `runFollowupAction`) idêntico aos adapters de E-01/E-02.

### F7b — Migrar rotas

| Rota atual | Ação |
|---|---|
| `POST /api/cron/followups` → `@/services/followup/*` + `CRON_SECRET` | `withModuleRoute` + `assertModuleForJob` → actions `executarFollowup`, `detectarInativos`, `executarCampanhas` |
| `GET /api/budgets/followup` → `@/services/followup/budget-followup.service` | `withModuleRoute` + `runFollowupAction` → `followup.listarOrcamentosPendentes` |
| `POST /api/budgets/followup` → `@/services/followup/budget-followup.service` | `withModuleRoute` + `runFollowupAction` → `followup.executarFollowupOrcamentos` |
| `GET /api/patients/inactive` → `@/repositories/patients` | `withModuleRoute('followup')` + `runFollowupAction` → `followup.listarInativos` |
| `GET /api/appointments/incomplete-treatments` → action E-02 | Manter rota atual; action migra para `followup.listarTratamentosIncompletos` |

### F7c — Cron job gate

Atualizar `POST /api/cron/followups` para:

```typescript
import { assertModuleForJob } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

export async function POST(request: NextRequest) {
  const moduleCheck = await assertModuleForJob('followup', moduleManifest);
  if (moduleCheck.status === 200 && moduleCheck.skipped) {
    return NextResponse.json({ skipped: true, reason: 'Módulo followup desabilitado' }, { status: 200 });
  }

  // CRON_SECRET validation
  // Then: call actions instead of legacy services
  const results: Record<string, unknown> = {};
  if (tasks.includes('all') || tasks.includes('followups')) {
    results.followUps = await runAction(followup.executarFollowup, {}, systemCtx);
  }
  // ... etc
}
```

### F7d — Remover legados das rotas

Após migração, nenhuma rota de follow-up deve importar diretamente:
- `@/services/followup/*`
- `@/repositories/patients`
- `getDb()`

### F7e — Presets RBAC

Adicionar `'followup'` aos modules de Administrador e Comercial em `src/core/rbac/presets.ts`.

**Commit checkpoint:** F7 completo.

---

## F8 — Integration Tests + RBAC Backfill

### F8a — Integration test scaffold

```
src/modules/followup/__tests__/
├── followup/integration.test.ts    → F3 (executar, listar)
├── inactive/integration.test.ts    → F4 (listar, reativar)
└── cron/integration.test.ts        → F7 (cron gate + actions)
```

### F8b — Permission guard tests

Adicionar ao `bootstrap.test.ts`:

```typescript
expect(keys).toContain('followup:view');
expect(keys).toContain('followup:manage_followups');
expect(keys).toContain('followup:manage_campaigns');
expect(keys).toContain('followup:manage_segments');
```

### F8c — RBAC backfill

Após deploy:

```bash
node scripts/backfill-rbac-permissions.mjs
```

**Commit checkpoint:** F8 completo.

---

## File Structure (alvo final)

```
src/modules/followup/
├── schema/                  ← bridge apenas (poucas ou nenhuma tabela nova)
├── actions/
│   ├── executar-followup.ts
│   ├── registrar-followup.ts
│   ├── listar-pendentes.ts
│   ├── detectar-inativos.ts
│   ├── listar-inativos.ts
│   ├── reativar-paciente.ts
│   ├── executar-campanhas.ts
│   ├── listar-segmentos.ts
│   ├── listar-orcamentos-pendentes.ts
│   ├── executar-followup-orcamentos.ts
│   ├── listar-tratamentos-incompletos.ts
│   └── index.ts
├── services/
│   ├── followup-service.ts
│   ├── inactive-service.ts
│   ├── campaign-service.ts
│   ├── budget-followup-service.ts
├── ui/
│   └── route-adapter.ts
├── manifest.ts
├── permissions.ts
├── index.ts
└── __tests__/
    ├── followup/integration.test.ts
    ├── inactive/integration.test.ts
    └── cron/integration.test.ts
```

---

## Routes to Migrate (Final State)

| Rota | Estado | Action |
|---|---|---|
| `POST /api/cron/followups` | Gate + actions | `followup.executarFollowup`, `followup.detectarInativos`, `followup.executarCampanhas` |
| `GET /api/budgets/followup` | `withModuleRoute` + adapter | `followup.listarOrcamentosPendentes` |
| `POST /api/budgets/followup` | `withModuleRoute` + adapter | `followup.executarFollowupOrcamentos` |
| `GET /api/patients/inactive` | `withModuleRoute('followup')` + adapter | `followup.listarInativos` |
| `GET /api/appointments/incomplete-treatments` | Mantida; action migrada | `followup.listarTratamentosIncompletos` |

---

## Acceptance Criteria (Definition of Done)

- [ ] F1: Schema bridge (se necessário)
- [ ] F2: Manifesto registrado; bootstrap test cobre `followup:*`
- [ ] F3–F6: 11 actions criadas e registradas
- [ ] F7: 5 rotas migradas sem `getDb()` nem `@/services/followup`
- [ ] Cron job usa `assertModuleForJob` + actions
- [ ] `npm run typecheck` → 0 errors
- [ ] `npm test` → 0 failures
- [ ] `RUN_INTEGRATION_TESTS=1 npm run test:integration` → todas as integrações passam
- [ ] Nenhum `getDb()`/`@/services/followup`/`@/repositories/patients` nas rotas migradas

---

## Pitfalls

- **Cron job público precisa de sistema ctx:** O cron job não tem sessão de usuário. Usar `{ source: 'system', clinicId, can: () => true, hasModule: () => true }` para chamar actions.
- **`assertModuleForJob` retorna 200 se módulo desabilitado:** Não retornar erro — retornar `{ skipped: true }`. Seguir padrão de E-02 (gates).
- **`listarTratamentosIncompletos` existe em E-02:** Criar em E-03 e redirecionar a action do E-02 para o E-03. Não duplicar.
- **Budget follow-up usa `@/services/followup/budget-followup.service`:** Não refatorar o serviço, apenas embarcar na action. A refatoração profunda do módulo Financeiro é Onda 2+.
- **CRON_SECRET vs `assertModuleForJob`:** Ambos são necessários. CRON_SECRET protege o endpoint HTTP; `assertModuleForJob` verifica se o módulo está contratado.

---

## Verification Commands (Cheat Sheet)

| Comando | Verifica |
|---|---|
| `npm run typecheck` | 0 TS errors |
| `npm test` | 0 failures |
| `RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/followup` | Integration tests pass |
| `rg -n "getDb\(" src/app/api/cron/followups src/app/api/budgets/followup src/app/api/patients/inactive` | 0 matches |
| `rg -n "@/services/followup\|@/repositories/patients" src/app/api/cron/followups src/app/api/budgets/followup src/app/api/patients/inactive` | 0 matches |

---

## Ordering Rationale

1. **F1 (Schema):** Bridge mínimo.
2. **F2 (Scaffold):** Módulo precisa existir.
3. **F3 (Follow-up pós-consulta):** Core do módulo — segue a ordem natural E-02 (consulta concluída) → E-03 (follow-up).
4. **F4 (Inativos):** Próximo em importância — detecta quem não voltou.
5. **F5 (Campanhas):** Dispara ações em lote sobre os inativos.
6. **F6 (Orçamentos + Tratamentos):** Follow-up financeiro e clínico.
7. **F7 (Cron + Gates):** Une tudo — migra as rotas.
8. **F8 (Tests):** Fecha a qualidade.

---

## Referências

| Documento | Papel |
|---|---|
| `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md` | Ordem da Onda 1 |
| `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` | Roadmap-mestre |
| `docs/planning/epics.md` | Vocabulário canônico E-03 |
| `docs/planning/stories/e-03-stories.md` | 13 SP, 6 stories detalhadas |
| `docs/superpowers/plans/2026-06-22-eixo2-operacional-modulo-implementation.md` | Template de plano (E-02) |
| `docs/superpowers/plans/2026-06-23-eixo2-e01-atendimento-multicanal-implementation.md` | Template de plano (E-01) |
| `src/modules/operacional/` | Template canônico do módulo |
