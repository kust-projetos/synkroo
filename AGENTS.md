# AGENTS.md — Synkroo

## Projeto
SaaS odontológico: agendamento, CRM/leads, campanhas, analytics, WhatsApp bot, agente IA conversacional, LGPD.

## Stack
| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript 5.6 |
| DB/Auth | Supabase (PostgreSQL + RLS + pgvector + Auth SSR) |
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
| `npm run db:push` | Push schema Supabase |
| `npm run db:reset` | Reset local DB |
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
│   ├── supabase/     # Client, server, admin, typed, database.types
│   ├── llm/          # Factory multi-provider
│   ├── validations/  # 10 Zod schemas por domínio
│   ├── auth/         # Auth context
│   └── env.ts        # Validação de env vars (fail-fast em prod)
├── services/         # 22 domínios de lógica de negócio
│   ├── agent/        # AgentService + risk scoring + pending actions
│   ├── agents/       # Multi-agent: router, scheduler, sales, generalist
│   ├── memory/       # L1-L5 memory layers
│   ├── rag/          # Embedding + RAG retrieval
│   ├── whatsapp/     # WhatsApp service + Evolution API + templates
│   └── [17 mais]
└── middleware.ts     # Auth SSR (Supabase cookies)
```

## Convenções
- **Componentes:** PascalCase (`AppointmentDialog.tsx`)
- **Hooks:** camelCase com `use` (`useKanban.ts`)
- **Utilidades:** kebab-case (`rate-limit.ts`)
- **Imports:** alias `@/` → `src/`
- **Validação:** Zod schemas em `src/lib/validations/`
- **DB types:** `src/lib/supabase/database.types.ts` (gerado via `npm run db:types`)

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
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` (≥16 chars)

## Env vars opcionais por feature
- `MINIMAX_API_KEY` / `OPENAI_API_KEY` → LLM
- `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` → WhatsApp
- `WEBHOOK_SECRET` → validação de webhook inbound
- `CRON_SECRET` → auth de cron jobs
- `SEED_SECRET` → seed endpoint

## Segurança
- Middleware protege rotas com Supabase Auth SSR
- `/api/seed` público só em dev
- `/api/cron/*` usa `crypto.timingSafeEqual` para CRON_SECRET
- `/api/messages/inbound` usa `crypto.timingSafeEqual` para WEBHOOK_SECRET
- Rate limiting ativo em: auth/login, agent/classify, leads, messages/send, instagram/webhook
- `exec_sql` RPC desativado (rota retorna 403)

## Testes
- Unit/Integration: Jest (`src/**/__tests__/`) — 53 suites
- E2E: Playwright (`e2e/`) — 41 specs
- Coverage threshold: 70% global (branches, functions, lines, statements)

## Supabase CLI
- Caminho: `C:\Users\walis\supabase-cli\supabase.exe`
- Remote project: `jlkifrngxxayjrfunuuz`
- Migrations: `supabase/migrations/` (44 arquivos)
- Push com include-all: `supabase db push --include-all`