# Synkroo

Automação inteligente para clínicas odontológicas com agentes IA conversacionais.

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Configure your credentials
# - Supabase URL and keys
# - MiniMax or OpenAI API key
# - WhatsApp integration (Evolution API)

# Run development server
npm run dev
```

## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes (85+ endpoints)
│   │   ├── agent/            # AI agent endpoints
│   │   ├── appointments/     # Scheduling endpoints
│   │   ├── patients/         # Patient management
│   │   ├── leads/            # CRM leads
│   │   ├── campaigns/        # Marketing campaigns
│   │   ├── budgets/          # Quote/budget management
│   │   ├── conversations/    # Chat conversations
│   │   ├── whatsapp/         # WhatsApp integration
│   │   ├── analytics/        # Metrics and predictions
│   │   └── auth/             # Authentication
│   ├── dashboard/           # Admin dashboard (26 pages)
│   ├── login/                # Login page
│   └── signup/               # Signup page
├── lib/
│   ├── supabase/             # Supabase clients (client, server, admin)
│   ├── llm/                  # Multi-LLM provider factory
│   ├── auth/                 # Auth context and helpers
│   ├── ui/                   # Shared UI components
│   └── validations/          # Zod schemas
├── services/                 # Business logic services
│   ├── agent/                # AI agent orchestration
│   ├── appointments/         # Scheduling logic
│   ├── patients/             # Patient management
│   ├── leads/                # Lead tracking
│   ├── followup/             # Retention campaigns
│   ├── analytics/            # Metrics and predictions
│   ├── whatsapp/             # WhatsApp integration
│   └── rag/                  # RAG for knowledge base
└── components/
    ├── chat-widget/          # Embedded chat widget
    └── ui/                   # UI components
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Database | Supabase (PostgreSQL + RLS multi-tenant) |
| Auth | Supabase Auth (JWT + SSR cookies) |
| LLM | Multi-provider factory (MiniMax, OpenAI, Claude via proxy) |
| WhatsApp | Evolution API v2.3.7 (Docker) + Playwright fallback |
| Styling | Tailwind CSS |
| Validation | Zod |
| Testing | Jest + React Testing Library |

## API Overview

### Core Modules

| Module | Endpoints | Description |
|--------|-----------|-------------|
| **Appointments** | 12 | CRUD, availability, confirmations, rescheduling |
| **Patients** | 10 | Patient management, history, preferences, dedup |
| **Leads** | 6 | Lead capture, hot leads, notifications |
| **Campaigns** | 6 | Follow-up campaigns, segmentation |
| **Budgets** | 7 | Quotes, acceptance, follow-up |
| **Analytics** | 5 | Metrics, ROI, no-show prediction |
| **WhatsApp** | 6 | Send, receive, webhook, QR code |
| **Auth** | 5 | Login, logout, signup, session |

### Key API Endpoints

```
POST   /api/agent/classify          # Classify message intent
POST   /api/messages/inbound        # Process inbound message
POST   /api/messages/send           # Send message
GET    /api/appointments/availability  # Check available slots
POST   /api/appointments/[id]/confirm   # Confirm appointment
POST   /api/analytics/noshow-prediction # Predict no-show risk
POST   /api/campaigns/[id]/start    # Start marketing campaign
```

## Features

### Implemented (MVP)

- [x] **E-01**: Atendimento Multicanal (WhatsApp + AI Agent)
- [x] **E-02**: Gestão de Agendamentos (CRUD + disponibilidade)
- [x] **E-03**: Follow-up e Retenção (campanhas, pacientes inativos)
- [x] **E-04**: CRM Inteligente (leads, pacientes, tags, dedup)
- [x] **E-05**: Vendas e Conversão (orçamentos, ROI)
- [x] **E-08**: Dashboard de Gestão (analytics, configurações)

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Documentation

- [Arquitetura Técnica](./docs/architecture-v1.1.md) - Architecture v1.1
- [PRD](./docs/planning/prd-v3.2.md) - Product Requirements
- [UX Design](./docs/ux-design.md) - Design System
- [Stories](./docs/planning/stories/) - User Stories by Epic

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LLM Provider (choose one)
LLM_PROVIDER=minimax|openai|claude|openrouter
MINIMAX_API_KEY=
OPENAI_API_KEY=

# WhatsApp (Evolution API)
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
```

## Development

```bash
# Start local Supabase
npm run supabase:start

# Setup database
npm run db:setup

# Generate types from database
npm run db:types

# Health check
npm run health
```
