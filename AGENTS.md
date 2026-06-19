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
| State | Zustand 5 (local) + TanStack Query 5 (server) |
| UI | Tailwind CSS + Radix UI + CVA + Recharts 3 |
| LLM | MiniMax / OpenAI / OpenRouter (factory em `src/lib/llm/`) |
| WhatsApp | Evolution API v2.3.7 + Playwright fallback |
| Testes | Jest (unit) + Playwright (E2E) |
| CI | GitHub Actions (lint → tsc → test → build) |

## Comandos
| Comando | Função |
|---|---|
| `npm run dev` | Dev server (porta 3000) |
| `npm run build` | Production build (NÃO ignora erros TS/lint) |
| `npm run lint` | ESLint |
| `npm test` | Jest unit/integration tests |
| `npm run test:e2e` | Playwright E2E |
| `npm run db:push` | Push schema Drizzle |
| `npm run db:reset` | Reset local DB (aguarda container healthy via `--wait`) |
| `npm run db:health` | Health check do banco |
| `npm run test:integration` | Jest integration tests contra Postgres local real |
| `npm run whatsapp:start` | WhatsApp CLI (QR code) |
| `npm run health` | Health check |

## Estrutura
```
src/
├── app/
│   ├── api/          # 34 módulos de API (~207 arquivos)
│   ├── dashboard/    # 18 páginas protegidas
│   ├── login/        # Auth pages
│   └── signup/
├── components/       # UI por domínio (calendar, contacts, pipeline, whatsapp, reports, ui/)
├── hooks/            # 5 hooks custom (kanban, toast, financial, payments, treatment)
├── lib/
│   ├── db/           # Drizzle ORM: schema, client, types, migrations
│   ├── llm/          # Factory multi-provider
│   ├── validations/  # 10 Zod schemas por domínio
│   ├── auth/         # Auth context (NextAuth)
│   └── env.ts        # Validação de env vars (fail-fast em prod)
├── services/         # 22 domínios de lógica de negócio
│   ├── agent/        # AgentService + risk scoring + pending actions
│   ├── agents/       # Multi-agent: router, scheduler, sales, generalist
│   ├── memory/       # L1-L5 memory layers
│   ├── rag/          # Embedding + RAG retrieval
│   ├── whatsapp/     # WhatsApp service + Evolution API + templates
│   └── [17 mais]
└── middleware.ts     # Auth SSR (NextAuth/Auth.js)
```

## Convenções
- **Componentes:** PascalCase (`AppointmentDialog.tsx`)
- **Hooks:** camelCase com `use` (`useKanban.ts`)
- **Utilidades:** kebab-case (`rate-limit.ts`)
- **Imports:** alias `@/` → `src/`
- **Validação:** Zod schemas em `src/lib/validations/`
- **DB types:** `src/lib/db/types.ts` (inferidos do schema Drizzle; fonte: `src/lib/db/schema/*`)

## API Modules
| Módulo | Caminho | Descrição |
|---|---|---|
| Agent | `/api/agent/*` | Classificação, mensagens, pending actions, schedule flow |
| Appointments | `/api/appointments/*` | CRUD, disponibilidade, confirmação |
| Auth | `/api/auth/*` | Login, logout, signup, session |
| Budgets | `/api/budgets/*` | Orçamentos, aceitação, follow-up |
| Campaigns | `/api/campaigns/*` | Campanhas, segmentação |
| Contacts | `/api/contacts/*` | CRM contatos |
| Conversations | `/api/conversations/*` | Chat conversas |
| Cron | `/api/cron/*` | Jobs: cleanup, followups, reminders, smart-triggers (CRON_SECRET + timingSafeEqual) |
| Leads | `/api/leads/*` | CRM leads |
| Messages | `/api/messages/*` | Inbound (WEBHOOK_SECRET), send (rate-limited), history |
| Patients | `/api/patients/*` | Gestão pacientes, dedup, preferências |
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
- `/api/messages/inbound` usa `crypto.timingSafeEqual` para WEBHOOK_SECRET
- Rate limiting ativo em: auth/login, agent/classify, leads, messages/send, instagram/webhook
- `exec_sql` RPC desativado (rota retorna 403)

## Testes
- Unit/Integration: Jest (`src/**/__tests__/`) — 53 suites
- E2E: Playwright (`e2e/`) — 41 specs
- Coverage threshold: 70% global (branches, functions, lines, statements)

## Direção da Stack
- Stack real: Drizzle ORM + `pg` + NextAuth + Cloudflare Workers (OpenNext).
- Fonte de verdade: `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md`.
- Supabase removido; migrations convertidas para Drizzle em `src/lib/db/schema/`.