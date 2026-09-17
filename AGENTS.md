# AGENTS.md — Synkroo

## Projeto
SaaS odontológico: agendamento, CRM/leads, campanhas, analytics, WhatsApp bot, agente IA conversacional, LGPD.

## Stack
| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript 5.6 |
| DB | PostgreSQL via Drizzle ORM + `pg` (Supabase removido — ver roadmap-mestre) |
| Auth | NextAuth/Auth.js (JWT, edge middleware) |
| Runtime alvo | Cloudflare Workers (OpenNext) + Hyperdrive + Vectorize — em migração |
| Workers auxiliares | `src/workers/ia-agent` (Cloudflare Agents SDK / Agent DO) + `src/workers/ia-bridge` |
| State | Zustand 5 (local) + TanStack Query 5 (server) |
| UI | Tailwind CSS + Radix UI + CVA + Recharts 3 |
| LLM | MiniMax / OpenAI / OpenRouter (factory em `src/lib/llm/`) |
| WhatsApp | Evolution API v2.3.7 + Playwright fallback |
| Testes | Jest (unit/não-integração — medir com `npx jest --listTests | Measure-Object -Line`) + Playwright (E2E em `e2e/` — medir com glob `e2e/**/*.spec.ts`) + Stryker (mutation). Não hardcodar contagens (SYN-DOC-001) |
| CI | GitHub Actions (lint → typecheck → test → test:security → build → build:cf) |

## Comandos
| Comando | Função |
|---|---|
| `npm run dev` | Dev server Next.js (porta 3000) |
| `npm run build` | Production build Next.js (valida TS e ESLint) |
| `npm run lint` | ESLint (`--max-warnings=0`) |
| `npm run typecheck` | Type checking TypeScript (`tsc --noEmit`) |
| `npm test` | Jest unit/integration tests |
| `npm run verify` | Verificação canônica completa (`scripts/verify.mjs`) |
| `npm run test:integration` | Jest integration tests com seed (`scripts/seed-test-clinic.mjs`) |
| `npm run test:integration:run` | Runner seguro de integração isolada em loopback (`scripts/integration-run.mjs`) |
| `npm run test:security` | Security test suite com coverage |
| `npm run test:security:integration` | Security integration tests |
| `npm run test:security:repositories` | Mutation testing de repositórios (Stryker) |
| `npm run test:security:services` | Mutation testing de services (Stryker) |
| `npm run test:release` | Testes de release e scripts de infraestrutura |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:e2e:production` | Playwright E2E contra staging/produção |
| `npm run test:e2e:ui` | Playwright UI interativo |
| `npm run test:e2e:auth` | Playwright auth & unauthenticated suite |
| `npm run test:e2e:api` | Playwright API routes suite |
| `npm run roadmap:check` | Validação estrita do ledger de 143 itens (`scripts/roadmap-ledger.mjs --check`) |
| `npm run roadmap:write` | Atualização do ledger de roadmap |
| `npm run db:up` / `db:down` | Inicializar / parar container PostgreSQL local |
| `npm run db:generate` | Gerar migrações Drizzle (`drizzle-kit generate`) |
| `npm run db:migrate` | Aplicar migrações Drizzle (`drizzle-kit migrate`) |
| `npm run db:reset` | Reset do banco local com docker volume clean e `--wait` |
| `npm run db:seed` | Seed de dados básicos de desenvolvimento |
| `npm run db:seed:scale` | Seed com volume em escala (`--preset large`) |
| `npm run db:health` | Health check da conexão PostgreSQL |
| `npm run build:cf` | Build para Cloudflare Workers via OpenNext |
| `npm run preview:cf` / `deploy:cf` | Preview / Deploy Cloudflare OpenNext |
| `npm run dev:ia-bridge` / `deploy:ia-bridge` | Worker ia-bridge (wrangler dev/deploy) |
| `npm run dev:ia-agent` / `deploy:ia-agent` | Worker ia-agent (wrangler dev/deploy porta 8788) |
| `npm run typecheck:ia-bridge` / `ia-agent` | Typecheck dos workers auxiliares |
| `npm run whatsapp:start` | WhatsApp CLI (QR code) |
| `npm run health` | Health check da API local |

## Estrutura
```
src/
├── app/
│   ├── api/          # 36 módulos de API (192 arquivos de rotas/handlers)
│   ├── dashboard/    # 17 páginas protegidas
│   ├── login/        # Auth pages
│   └── signup/
├── components/       # UI por 12 domínios (calendar, campaigns, charts, contacts, financeiro, lgpd, notifications, pi-finance, pipeline, reports, ui, whatsapp)
├── hooks/            # 5 hooks custom (useKanban, useToast, useFinancialSummary, usePayments, useTreatmentPlans)
├── lib/
│   ├── db/           # Drizzle ORM: 11 schemas, client, types, migrations
│   ├── llm/          # Factory multi-provider
│   ├── validations/  # 11 Zod schemas por domínio
│   ├── auth/         # Auth context (NextAuth)
│   └── env.ts        # Validação de env vars (fail-fast em prod)
├── modules/          # Arquitetura modular por bounded contexts
│   ├── atendimento/  # Mensageria, WhatsApp, Instagram, canais
│   ├── comercial/    # Pipeline, leads, conversão, tasks
│   ├── core/         # RBAC, tenant context, access, roles
│   ├── crm/          # Contatos, notas, merge, dedup
│   ├── financeiro/   # Orçamentos, cobranças, gateways, regras
│   ├── followup/     # Inativos, campanhas de retenção
│   └── operacional/  # Consultas, dentistas, procedimentos, waitlist
├── repositories/     # Data access layer (Drizzle ORM)
├── services/         # 16 domínios de lógica de negócio (analytics, api-handlers, appointments, budgets, contacts, custom-fields, followup, installments, leads, patients, payments, pipeline, reminders, reports, treatment-plans, waitlist)
├── workers/          # Cloudflare Workers auxiliares
│   ├── ia-agent/     # Durable Objects, Agents SDK, vector search
│   └── ia-bridge/    # Bridge de mensageria e webhooks edge
└── middleware.ts     # Auth SSR (NextAuth/Auth.js)
```

## Convenções
- **Componentes:** PascalCase (`AppointmentDialog.tsx`)
- **Hooks:** camelCase com `use` (`useKanban.ts`)
- **Utilidades:** kebab-case (`rate-limit.ts`)
- **Imports:** alias `@/` → `src/`
- **Validação:** Zod schemas em `src/lib/validations/`
- **DB types:** `src/lib/db/types.ts` (inferidos do schema Drizzle; fonte: `src/lib/db/schema/*`)

## API Modules (36 módulos)
| Módulo | Caminho | Descrição |
|---|---|---|
| Agent | `/api/agent/*` | Classificação, mensagens, pending actions, schedule flow |
| Appointments | `/api/appointments/*` | CRUD, disponibilidade, confirmação, incomplete treatments |
| Auth | `/api/auth/*` | Login, logout, signup, session, switch clinic |
| Budgets | `/api/budgets/*` | Orçamentos, aceitação, follow-up, envio |
| Campaigns | `/api/campaigns/*` | Campanhas, segmentação, preview |
| Clinics | `/api/clinics/*` | Configurações da clínica e metadados |
| Contacts | `/api/contacts/*` | CRM contatos e linha do tempo |
| Conversations | `/api/conversations/*` | Chat conversas e mensagens |
| Cron | `/api/cron/*` | Jobs: cleanup, followups, reminders, smart-triggers (CRON_SECRET + timingSafeEqual) |
| CRM | `/api/crm/*` | Estatísticas de CRM e duplicidades |
| Dashboard | `/api/dashboard/*` | Métricas, alertas e estatísticas |
| Dentists | `/api/dentists/*` | Gestão de dentistas e agendas |
| Financial | `/api/financial/*` | Resumo financeiro e fluxo de caixa |
| Gateway | `/api/gateway/*` | Configuração de gateways de pagamento |
| Health | `/api/health/*` | Health checks de aplicação e banco |
| Installments | `/api/installments/*` | Parcelamentos e conciliação |
| Knowledge | `/api/knowledge/*` | Base de conhecimento e RAG |
| Leads | `/api/leads/*` | CRM leads, captura, qualificação, conversão |
| LGPD | `/api/lgpd/*` | Exportação de dados e anonimização |
| Messages | `/api/messages/*` | Inbound (WEBHOOK_SECRET), send (rate-limited), history |
| Notifications | `/api/notifications/*` | Central de notificações e alertas |
| Patients | `/api/patients/*` | Gestão pacientes, dedup, histórico, tags |
| Payments | `/api/payments/*` | Processamento e webhook de pagamentos |
| Pipeline | `/api/pipeline/*` | Funil de vendas e etapas |
| Procedures | `/api/procedures/*` | Catálogo de procedimentos odontológicos |
| Reminders | `/api/reminders/*` | Lembretes e confirmações automáticas |
| Reports | `/api/reports/*` | Relatórios gerenciais e exportações |
| Roles | `/api/roles/*` | Gestão de perfis e permissões RBAC |
| Routing | `/api/routing/*` | Regras de roteamento de cobrança |
| Seed | `/api/seed/*` | Endpoint de seed de ambiente local |
| Tasks | `/api/tasks/*` | Tarefas e follow-ups |
| Treatment Plans | `/api/treatment-plans/*` | Planos de tratamento e sessões |
| Users | `/api/users/*` | Usuários da clínica e acessos |
| Waitlist | `/api/waitlist/*` | Lista de espera inteligente |
| WhatsApp | `/api/whatsapp/*` | Webhook, send, evolution, templates, QR |
| Analytics | `/api/analytics/*` | Métricas, no-show prediction, ROI |

## Env vars obrigatórias
- `DATABASE_URL` (PostgreSQL connection string)
- `AUTH_SECRET` (≥32 chars, NextAuth)
- `JWT_SECRET` (≥16 chars)

## Env vars opcionais por feature
- `MINIMAX_API_KEY` / `OPENAI_API_KEY` → LLM
- `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` → WhatsApp
- `WEBHOOK_SECRET` → validação de webhook inbound
- `CRON_SECRET` → auth de cron jobs
- `SEED_SECRET` → seed endpoint

## Segurança
- Middleware protege rotas com NextAuth/Auth.js (JWT, edge-ready)
- `/api/seed` público só em dev
- `/api/cron/*` usa `crypto.timingSafeEqual` para CRON_SECRET
- `/api/messages/inbound` usa `crypto.timingSafeEqual` para WEBHOOK_SECRET e deriva tenant via `channel_installations`
- Rate limiting ativo em: auth/login, agent/classify, leads, messages/send, instagram/webhook
- `exec_sql` RPC desativado (rota retorna 403)

## Testes
- Unit/Integration: Jest (`src/**/__tests__/`) — default, sem `integration.test.ts`; medir com `npx jest --listTests | Measure-Object -Line` (não hardcodar contagens)
- E2E: Playwright (`e2e/`) — medir com glob `e2e/**/*.spec.ts`
- Coverage threshold (efetivamente medido em `jest.config.js` global: branches 55 / functions 65 / lines 70 / statements 70; sem exclusões adicionais para mascarar quedas; `src/**/*.tsx`, `src/app/**`, `src/lib/db/**` excluídos por contrato)
- Hardening: Stryker mutation testing em repositórios e services

## Direção da Stack & Roadmap
- Stack real: Drizzle ORM + `pg` + NextAuth + Cloudflare Workers (OpenNext) + Workers Auxiliares (`ia-agent`, `ia-bridge`).
- Fonte de verdade: `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md`.
- Roadmap 143: Ledger rigoroso de 143 itens (`records=143 unique=143 VERIFIED=126 DEFERRED=3 EXTERNAL=14`, pós-2026-08-26) — estado canônico em `docs/goals/roadmap-143-resume.md`, autoridade via `npm run roadmap:check`.
- Supabase removido; migrations convertidas para Drizzle em `src/lib/db/schema/`.

## Débitos registrados (pós-hardening V1)

- **Contrato de API (D2 — fechado 2026-09-14):** envelope canônico completo (`src/services/api-handlers/**` + waitlist/appointments/patients/cron/knowledge/widget); helper `apiRateLimited` em `src/lib/api/response.ts` (429 com `Retry-After` só em header); exceções deliberadas (liveness, probe cleanup, seed, budgets strangler, webhooks instagram/inbound) e remoção do shim `is_active` no `ADR-BASE-10`. Residuais consolidados na entrada "Residuais API menores".
- **Boundaries (F3 + R4 — fechados 2026-09-14):** `eslint-plugin-boundaries` v6 é a autoridade efetiva do gate `services → modules` (resolver `eslint-import-resolver-typescript`, allowlist de seams `index.ts`/`public.ts`/`schema/**`, isenção de testes; config em `eslint.config.mjs`, fonte única). Antigo `no-restricted-imports` de services e config morta removidos. Probes estático+dynamic em `scripts/__tests__/eslint-config.test.mjs`. `boundaries/dependencies` do compat ainda cobre `modules → modules` — unificar no bloco nativo é opcional. Follow-up de hardening: união discriminada no retorno de `checkRateLimit`.
- **Frontend (G1 — fechado 2026-09-14):** 8 refinos de invalidação (contactId no composer, calendário por faixa com validação estrita de data e fallback conservador, key de payments unificada em `queryKeys.budgetPayments`, treatment-plans com keys exatas, consent no hook, derivados `financeDashboard`/`contacts`/`financial-summary`). Follow-ups menores: RescheduleDialog não invalida `appointments` (gap pré-existente); `useUpdateSession` precisa de `patient_id` no retorno da API para invalidar `financial-summary` do paciente; AppointmentDialog pode invalidar appointments por data quando expuser o filtro ativo.
- **Residuais API menores:** `auth/change-password` mantém bloco manual com headers `X-RateLimit-*` extras (fora do helper `apiRateLimited`); `handleApiError`/`RateLimitError` (`src/lib/errors.ts`) emitem shape legado sem header — sem uso em produção para 429 (candidatos a deprecação).

## VPS
- Operação: `docs/ops/vps-access.md`.
- Configuração privada: `../vps-hostinger/.env`; nunca copiar segredos para este repositório.