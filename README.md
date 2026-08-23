# Synkroo

Automação inteligente para clínicas odontológicas com agentes IA conversacionais, gestão clínica, CRM, financeiro e LGPD.

## Setup

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local

# Configurar credenciais essenciais
# - PostgreSQL (DATABASE_URL)
# - NextAuth (AUTH_SECRET, JWT_SECRET)
# - MiniMax ou OpenAI API key
# - WhatsApp integration (Evolution API)

# Executar servidor de desenvolvimento
npm run dev
```

## Estrutura do Projeto

```
src/
├── app/                      # Next.js 15 App Router
│   ├── api/                  # 36 módulos de API (192 arquivos de rotas/handlers)
│   │   ├── agent/            # Endpoints do agente IA
│   │   ├── appointments/     # Gestão e agendamentos de consultas
│   │   ├── auth/             # Autenticação e sessão NextAuth
│   │   ├── budgets/          # Orçamentos e aprovações
│   │   ├── campaigns/        # Campanhas e segmentações
│   │   ├── contacts/         # CRM contatos e histórico
│   │   ├── conversations/    # Chat e conversas multicanal
│   │   ├── cron/             # Jobs periódicos de limpeza e triggers
│   │   ├── leads/            # Captura e qualificação de leads
│   │   ├── messages/         # Mensageria inbound/outbound
│   │   ├── patients/         # Prontuário, histórico e preferências
│   │   ├── payments/         # Processamento de cobranças e webhooks
│   │   ├── pipeline/         # Funil de vendas e etapas
│   │   ├── treatment-plans/  # Planos de tratamento e sessões
│   │   ├── whatsapp/         # Webhooks e integração Evolution API
│   │   └── analytics/        # Métricas, ROI e predição de no-show
│   ├── dashboard/           # Painel administrativo protegido (17 páginas)
│   ├── login/                # Página de login
│   └── signup/               # Página de cadastro (desabilitada em prod)
├── components/               # UI por 12 domínios (calendar, campaigns, charts, contacts, financeiro, lgpd, notifications, pi-finance, pipeline, reports, ui, whatsapp)
├── hooks/                    # 5 hooks custom (useKanban, useToast, useFinancialSummary, usePayments, useTreatmentPlans)
├── lib/
│   ├── db/                   # Drizzle ORM (11 schemas, client, migrations, types)
│   ├── llm/                  # Factory multi-provider (MiniMax, OpenAI, OpenRouter)
│   ├── auth/                 # Auth context e helpers (NextAuth)
│   ├── ui/                   # Componentes base e menu actions
│   └── validations/          # 11 Zod schemas por domínio
├── modules/                  # Bounded contexts modulares (atendimento, comercial, core, crm, financeiro, followup, operacional)
├── repositories/             # Data access layer com Drizzle ORM
├── services/                 # 16 domínios de regras de negócio
├── workers/                  # Cloudflare Workers auxiliares
│   ├── ia-agent/             # Durable Objects, Agents SDK e busca vetorial
│   └── ia-bridge/            # Bridge de mensageria e webhook no edge
└── middleware.ts             # Proteção de rotas SSR (NextAuth edge-ready)
```

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript 5.6 |
| DB | PostgreSQL 17 via Drizzle ORM + `pg` (Supabase removido) |
| Auth | NextAuth/Auth.js (JWT, edge middleware) |
| Runtime alvo | Cloudflare Workers (OpenNext) + Hyperdrive + Vectorize |
| Workers auxiliares | Cloudflare Agents SDK / Agent DO (`ia-agent`) + `ia-bridge` |
| State | Zustand 5 (local) + TanStack Query 5 (server) |
| UI | Tailwind CSS + Radix UI + CVA + Recharts 3 |
| LLM | Multi-provider factory (MiniMax, OpenAI, OpenRouter) |
| WhatsApp | Evolution API v2.3.7 + Playwright fallback |
| Validação | Zod (11 schemas dedicados) |
| Testes | Jest (264 suites) + Playwright (14 specs E2E) + Stryker (mutation) |

## Comandos Principais

```bash
# Desenvolvimento e build
npm run dev                  # Dev server local (porta 3000)
npm run build                # Production build (valida TS e ESLint)
npm run lint                 # ESLint com zero warnings
npm run typecheck            # Validação de tipos TypeScript (tsc --noEmit)

# Testes e qualidade
npm test                     # Testes unitários e de integração (Jest)
npm run test:integration:run # Runner seguro de integração isolada em loopback
npm run test:security        # Security test suite com relatório de cobertura
npm run test:e2e             # Playwright E2E tests
npm run verify               # Verificação canônica completa de integridade
npm run roadmap:check        # Validação do ledger de conformidade do roadmap (143 itens)

# Banco de dados
npm run db:up / npm run db:down # Subir / parar PostgreSQL via Docker Compose
npm run db:migrate           # Executar migrações Drizzle
npm run db:seed              # Seed de banco local
npm run db:health            # Health check do banco de dados

# Cloudflare Workers
npm run build:cf             # Build OpenNext para Cloudflare Workers
npm run dev:ia-agent         # Dev server do worker de agente IA
npm run dev:ia-bridge        # Dev server do worker bridge de mensageria
```

## Documentação

- [Arquitetura Técnica Base](./docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md) - Especificação técnica modular
- [Índice de Decisões de Arquitetura (ADRs)](./docs/adr/INDEX.md) - Registros de decisões de arquitetura
- [Plano Mestre de Pendências](./docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md) - Roadmap de conformidade
- [PRD](./docs/planning/prd-v3.2.md) - Requisitos do produto
- [UX Design](./docs/ux-design.md) - Design system e interfaces

## Variáveis de Ambiente

```bash
# PostgreSQL (obrigatório)
DATABASE_URL=postgresql://synkroo:password@127.0.0.1:55432/synkroo

# Autenticação NextAuth (obrigatório)
AUTH_SECRET=sua-chave-secreta-com-pelo-menos-32-caracteres
JWT_SECRET=sua-chave-jwt-com-pelo-menos-16-caracteres

# Provedores de IA (opcional por feature)
MINIMAX_API_KEY=
OPENAI_API_KEY=

# Integração WhatsApp (opcional por feature)
EVOLUTION_API_URL=
EVOLUTION_API_KEY=

# Segredos de Webhook e Cron
WEBHOOK_SECRET=
CRON_SECRET=
```
