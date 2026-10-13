# Inventário de Runtime — vNext P0

**Data:** 2026-10-05
**Fase:** P0 Baseline (plano mestre `docs/superpowers/plans/2026-10-05-synkroo-vnext-ai-native-business-os-implementation.md`)
**Método:** contagens medidas por glob/grep no checkout `bf82bb19` no momento da escrita. **Não copiar números deste doc para outro contexto sem re-medir** (SYN-DOC-001). Jest: `npx jest --listTests`; E2E: glob `e2e/**/*.spec.ts`.

Docs-irmãos: [catálogo de Actions](2026-10-05-actions-catalog.md) · [mapa de duplicação services/modules](2026-10-05-services-modules-duplication.md)

## 1. Contagens por camada

| Camada | Métrica | Valor |
|---|---|---|
| UI | `src/app/dashboard/**/page.tsx` | **36** (36 rotas; inclui `/dashboard/configuracao`, redirect para `configuracoes`) |
| API | módulos top-level em `src/app/api/*` | **36** |
| API | `src/app/api/**/route.ts` | **144** |
| API | shims strangler `src/**/_handler.ts` | **26** (24 rotas delegam via `_handler`) |
| Services | domínios em `src/services/*` | **16** (65 arquivos de produção; 27 em `api-handlers/`) |
| Repositories | `src/repositories/**/index.ts` | **15** |
| Schema | `src/lib/db/schema/*` | **11** (10 + `index.ts`) |
| Schema módulos | `src/modules/*/schema/**` | **20** (re-export/canal da mesma superfície Drizzle — não somar com a linha anterior) |
| Bounded contexts | `src/modules/*` | **8** (`atendimento`, `comercial`, `core`, `crm`, `financeiro`, `followup`, `ia`, `operacional`) |
| Actions | `defineAction(` fora de testes | **145** (144 registradas + 1 system-only) |
| Tests Jest | por glob `src/**/*.{test,spec}.{ts,tsx}` + `scripts/__tests__/*.mjs` | ~300 em `src` (por área: 71 `__tests__` + 37 services + 49 core + 58 lib + 46 app + 26 components + 5 hooks + 6 repositories + 2 workers) + 125 em `src/modules` + 29 scripts — **agregado medir com `npx jest --listTests`** |
| Tests E2E | glob `e2e/**/*.spec.ts` | **47** |
| Workers auxiliares | `src/workers/*` | **2** (`ia-agent` DO + `ia-bridge`), 6 arquivos |

### Rotas de API por módulo (144 arquivos)

| módulo | n | módulo | n | módulo | n |
|---|---|---|---|---|---|
| financeiro | 18 | appointments | 14 | leads | 9 |
| auth | 8 | contacts | 11 | knowledge | 5 |
| budgets | 8 | pipeline | 4 | whatsapp | 5 |
| cron | 8 | patients | 4 | analytics | 4 |
| campaigns | 6 | messages | 4 | dashboard | 2 |
| reports | 3 | conversations | 2 | dentists | 2 |
| treatment-plans | 3 | custom-fields | 3 | health | 2 |
| admin | 2 | activities | 1 | lgpd | 2 |
| clinics | 1 | consents | 1 | crm | 1 |
| ia | 1 | internal | 1 | procedures | 2 |
| reminders | 1 | seed | 1 | tasks | 1 |
| instagram | 1 | waitlist | 2 | widget | 2 |

### Páginas do dashboard (36 rotas)

`/`, `agendamentos/{,[id],novo}`, `analytics`, `atividades`, `campanhas/{,[id],nova}`, `configuracao` (redirect), `configuracoes{,/acessos,/acessos/perfis}`, `conversas`, `contatos`, `crm`, `crm/pipeline`, `dentistas/{,[id],novo}`, `financeiro`, `followup`, `leads/{,[id],novo}`, `lista-espera`, `pacientes/{,[id],[id]/editar,novo,inativos}`, `pipeline`, `procedimentos/{,[id],novo}`, `tarefas`.

### Workers auxiliares

- **`src/workers/ia-agent`** — `AgentOrchestrator extends DurableObject<Env>`; bindings: `AGENT` (DO), `APP` (service → `synkroo-ia-bridge`/`AppService`), `OPENCODE_ZEN_API_KEY`; porta dev 8788 (`wrangler.jsonc`).
- **`src/workers/ia-bridge`** — bindings: `HANDLE_SECRET`, `IA_SEEN` (KV, anti-replay), `HYPERDRIVE`; entrypoints `HandleIssuerService` e `AppService`. Sem `wrangler.jsonc` próprio no repo (deploy via npm script).

## 2. Divergências AGENTS.md ↔ realidade medida (P0: reconciliar fontes)

| # | AGENTS.md diz | Medido | Ação nesta tranche |
|---|---|---|---|
| 1 | "17 páginas protegidas" | **36** `page.tsx` (36 rotas) | AGENTS.md atualizado |
| 2 | "36 módulos de API (192 arquivos de rotas/handlers)" | 36 módulos ✓, mas **144** `route.ts` + 26 `_handler.ts` = **170** | AGENTS.md atualizado |
| 3 | Módulos: 7 bounded contexts | **8** — `ia` existe (`src/modules/ia`, manifest + schema IA, `iaActions = []`) | AGENTS.md atualizado |
| 4 | Runtime-alvo "Hyperdrive + Vectorize" | ADR-BASE-04 decidiu **pgvector** como vector store único; `ia-agent/index.ts` confirma ("pgvector (não Vectorize)") | AGENTS.md atualizado (remover Vectorize) |
| 5 | `JWT_SECRET` obrigatório ≥16 | **CORRETO** — `src/lib/env.ts:24` (`min(16)`) e `:121` (critical). Diverge de ADR-BASE-05 (que rejeita JWT_SECRET como aspiração). **Divergência ADR↔código registrada, não "corrigida"** | Registrado aqui e em ADR-BASE-18 §Compatibilidade |
| 6 | Testes: contagens não hardcodadas | Regra mantida; números acima são fotografia datada | — |

## 3. Docs vivos com stack desatualizada (Supabase)

`docs/archive/**` e `docs/planning/**` excluídos por serem históricos deliberados. Claude SDK / `@anthropic`: **zero hits** em docs vivos — item P0 "reconciliar referências Claude SDK" está **cumprido por ausência** (adapter multi-provider em `src/lib/llm/` é a única referência viva).

| Arquivo | Problema | Correção aplicada nesta tranche |
|---|---|---|
| `docs/CONFIGURACAO-LEMBRETES.md:21` | instrui setup em "Supabase Dashboard" | stack atual (Postgres gerenciado + Drizzle) |
| `docs/MANUAL-ADMINISTRACAO.md:155` | "Supabase realiza backup automático diário" | aponta `scripts/db-backup.mjs` + runbook de recovery |
| `docs/MVP-CHECKLIST.md:14,127` | checklist trata Supabase como feito/atual | reescrito para stack atual |
| `docs/security/credential-inventory.md:40,44,50,233` | trata chaves Supabase como credenciais ativas | entradas marcadas `REMOVIDO` (histórico preservado) |
| `docs/ops/secret-rotation-runbook.md:42,90` | rotação aponta para dashboard Supabase inexistente | rota de rotação removida das instruções ativas |

Não-corrigíveis por serem históricos corretos: `docs/DATABASE_SETUP.md:69` ("migrations legadas do Supabase") e `docs/adr/ADR-BASE-03` ("Supabase: removido conforme roadmap").

## 4. Fonte canônica de arquitetura

- **Baseline v1:** `docs/superpowers/specs/2026-07-28-synkroo-canonical-product-architecture.md` — status "baseline canônica v1; direção vNext definida por 2026-10-05".
- **vNext:** `docs/superpowers/specs/2026-10-05-synkroo-vnext-ai-native-business-os-design.md` prevalece onde contradisser.
- **ADR ativo por conceito:** ver `docs/adr/ADR-INDEX.md` (inclui ADR-BASE-18 — AI Control Plane).
