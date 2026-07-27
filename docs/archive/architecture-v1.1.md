---
stepsCompleted: []
inputDocuments:
  - prd-v3.2.md
  - ux-design.md
workflowType: architecture
version: 1.1
validation: BMAD v6.2.2
---

# Arquitetura Técnica - Synkroo

**Versão:** 1.2 (BMAD Compliant)
**Data:** 2026-03-26
**Baseado em:** PRD v3.2 + UX Design v2.0
**Arquiteto:** Winston (BMAD Agent)

---

## 1. Visão Geral da Arquitetura

### 1.1 Diagrama de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    SYNKROO ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              CLIENT LAYER                                          │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │  │
│  │  │   Web App   │   │  Mobile App │   │  WhatsApp   │   │ Chat Widget │           │  │
│  │  │  (Next.js)  │   │  (Responsive│   │   Web/API   │   │  (Embed)    │           │  │
│  │  │             │   │    PWA)     │   │             │   │             │           │  │
│  │  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘           │  │
│  └─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────┘  │
│            │                  │                  │                  │                     │
│            ▼                  ▼                  ▼                  ▼                     │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              API GATEWAY LAYER                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                     Supabase Edge Functions (Deno)                          │  │  │
│  │  │  • Auth Middleware  • Rate Limiting  • Request Validation  • CORS           │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                          │                                              │
│                                          ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              APPLICATION LAYER                                     │  │
│  │                                                                                    │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                   │  │
│  │  │   Auth Service  │  │ Appointment Svc │  │  Patient Svc    │                   │  │
│  │  │   (Supabase)    │  │   (Edge Fn)     │  │   (Edge Fn)     │                   │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘                   │  │
│  │                                                                                    │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                   │  │
│  │  │  WhatsApp Svc   │  │   Agent Svc     │  │  Dashboard Svc  │                   │  │
│  │  │   (Edge Fn)     │  │   (Claude SDK)  │  │   (Edge Fn)     │                   │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘                   │  │
│  │                                                                                    │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                          │                                              │
│                                          ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              MCP SERVERS LAYER                                     │  │
│  │                                                                                    │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                   │  │
│  │  │  calendar-mcp   │  │ whatsapp-mcp    │  │  postgres-mcp   │  ← Tier 1        │  │
│  │  │   (Critical)    │  │   (Critical)    │  │   (Critical)    │                   │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘                   │  │
│  │                                                                                    │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                                         │  │
│  │  │  patients-mcp   │  │ filesystem-mcp  │  ← Tier 2 (Important)                  │  │
│  │  └─────────────────┘  └─────────────────┘                                         │  │
│  │                                                                                    │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                          │                                              │
│                                          ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              DATA LAYER                                            │  │
│  │                                                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                     Supabase PostgreSQL (Multi-tenant RLS)                  │  │  │
│  │  │                                                                              │  │  │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐     │  │  │
│  │  │  │  clinics  │ │  users    │ │ patients  │ │appointments│ │conversations│    │  │  │
│  │  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘     │  │  │
│  │  │                                                                              │  │  │
│  │  │  + 15 more tables (soft delete, partitioning for conversations)             │  │  │
│  │  │                                                                              │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                    │  │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐       │  │
│  │  │   NextAuth/Auth.js  │  │   Object Storage    │  │  pgvector (RAG)     │       │  │
│  │  │   (JWT + RLS)       │  │   (Files/Images)    │  │  (Embeddings)       │       │  │
│  │  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘       │  │
│  │                                                                                    │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              EXTERNAL SERVICES                                     │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │  │
│  │  │ LLM API     │   │  Playwright │   │   Redis     │   │   CDN       │           │  │
│  │  │(Multi-Prov) │   │  (WhatsApp) │   │  (Cache)    │   │  (Static)   │           │  │
│  │  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘           │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Princípios Arquiteturais

| Princípio | Descrição | Aplicação |
|-----------|-----------|-----------|
| **Simplicidade** | Backend como serviço | Supabase-only para MVP |
| **Multi-tenant** | Row-Level Security | Isolamento por `clinic_id` |
| **Serverless First** | Edge Functions | Escala automática, menor custo |
| **Event-Driven** | Webhooks + Realtime | Sincronização em tempo real |
| **API-First** | REST + Realtime | Frontend agnóstico |
| **Security by Default** | RLS + Auth | Dados protegidos no banco |

---

## 2. Stack Tecnológica

### 2.1 Frontend

| Tecnologia | Versão | Motivo |
|------------|--------|--------|
| **Next.js** | 15.x (App Router) | SSR, API routes, otimização |
| **React** | 19.x | Componentes, hooks, ecossistema |
| **TypeScript** | 5.x | Type safety, DX |
| **Tailwind CSS** | 4.x | Utility-first, design system |
| **Radix UI** | Latest | Componentes acessíveis |
| **TanStack Query** | 5.x | Cache, sincronização |
| **Zustand** | 5.x | State management simples |
| **React Hook Form** | 7.x | Formulários performáticos |
| **Zod** | 3.x | Validação de schemas |

### 2.2 Backend

| Tecnologia | Versão | Motivo |
|------------|--------|--------|
| **Supabase** | Latest | Auth, DB, Storage, Realtime |
| **PostgreSQL** | 15+ | Banco relacional robusto |
| **pgvector** | 0.5+ | Embeddings para RAG |
| **Edge Functions** | Deno | Serverless, baixa latência |
| **Redis** | 7+ | Cache, filas, sessões |

### 2.3 Agentes IA

| Tecnologia | Versão | Motivo |
|------------|--------|--------|
| **Multi-LLM Provider Layer** | Factory Pattern | Provider-agnostic (Claude produção, MiniMax dev) |
| **Modelo Produção** | Claude Sonnet 4 | Qualidade superior para produção |
| **Modelo Dev** | MiniMax M2.7 | Testes locais sem custo |
| **MCP Servers** | Custom | Tool calling estruturado |

### 2.4 Infraestrutura

| Tecnologia | Motivo |
|------------|--------|
| **Vercel** | Hosting Next.js, Edge Functions |
| **Supabase Cloud** | Managed PostgreSQL + Auth |
| **Upstash Redis** | Redis serverless |
| **Playwright** | WhatsApp Web automation |

---

## 3. Architecture Decision Records (ADRs)

> **BMAD Requirement:** Documentar decisões críticas de arquitetura.

### ADR-001: Supabase-Only para MVP

**Status:** ✅ Accepted

**Contexto:**
Precisamos escolher a stack de backend para o MVP. Opções consideradas:
1. Supabase (BaaS)
2. Custom Node.js + PostgreSQL
3. Firebase
4. AWS Amplify

**Decision:**
Usar **Supabase** como backend único para MVP.

**Rationale:**
| Critério | Supabase | Custom | Firebase | AWS |
|----------|----------|--------|----------|-----|
| Time to market | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Multi-tenant RLS | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| PostgreSQL | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐⭐ |
| Realtime | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Cost (MVP) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Vector search | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ | ⭐⭐⭐ |

**Consequences:**
- ✅ Menor tempo de desenvolvimento
- ✅ RLS nativo para multi-tenant
- ✅ pgvector para RAG
- ⚠️ Vendor lock-in (mitigado por ser PostgreSQL padrão)
- ⚠️ Limitações de customização (aceitável para MVP)

---

### ADR-002: WhatsApp Híbrido (Web + API)

**Status:** ✅ Accepted

**Contexto:**
Precisamos de integração WhatsApp para comunicação com pacientes. Opções:
1. WhatsApp Business API oficial
2. WhatsApp Web via Playwright
3. Provedores terceiros (Twilio, MessageBird)

**Decision:**
Implementar **abordagem híbrida**: Playwright para MVP, transição para API oficial quando necessário.

**Rationale:**
| Critério | Business API | Playwright | Provedor |
|----------|--------------|------------|----------|
| Custo inicial | R$ 0 | R$ 0 | R$ 500+/mês |
| Custo por msg | R$ 0.05-0.30 | R$ 0 | R$ 0.10+ |
| Setup time | 2-4 semanas | 1 semana | 1-2 semanas |
| Confiabilidade | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Templates | Obrigatório | Não | Obrigatório |

**Strategy:**
```
MVP (Semanas 1-8):
├── WhatsApp Web via Playwright
├── Custo: ~R$ 0/mês
├── Limitações: Rate limits manuais
└── Monitoramento: Semanal

Growth (Semana 9+):
├── Transição gradual para Business API
├── Contas de alto volume migram primeiro
└── Pool misto durante transição
```

**Consequences:**
- ✅ Zero custo inicial
- ✅ Setup rápido
- ✅ Sem templates obrigatórios
- ⚠️ Risco de ban (mitigado com rate limiting)
- ⚠️ Manutenção constante

---

### ADR-003: Row-Level Security para Multi-Tenant

**Status:** ✅ Accepted

**Contexto:**
Precisamos isolar dados entre clínicas. Opções:
1. Schema per tenant
2. Database per tenant
3. Row-Level Security (RLS)
4. Application-level filtering

**Decision:**
Usar **Row-Level Security (RLS)** no PostgreSQL via Supabase.

**Rationale:**
| Critério | Schema/DB | RLS | App-level |
|----------|-----------|-----|-----------|
| Isolamento | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Custo | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Complexidade | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Performance | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Migrations | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Scalability | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Implementation:**
```sql
-- JWT custom claims
ALTER TABLE auth.users
ADD COLUMN clinic_id UUID REFERENCES clinics(id);

-- RLS Policy
CREATE POLICY "clinic_isolation" ON patients
FOR ALL USING (clinic_id = auth.jwt() ->> 'clinic_id');

-- Enable RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
```

**Consequences:**
- ✅ Isolamento garantido no banco
- ✅ Zero vazamento de dados
- ✅ Simplicidade de implementação
- ✅ Escala bem até centenas de tenants
- ⚠️ Queries devem usar clinic_id (mitigado com middleware)

---

### ADR-004: 4+1 Multi-Agent Architecture

**Status:** ✅ Accepted

**Contexto:**
Precisamos de arquitetura de agente IA que seja eficiente e especializada. Opções:
1. Single agent monolítico
2. Multi-agent com todos ativos
3. Multi-agent com lazy activation (4+1)
4. Ensemble de modelos

**Decision:**
Implementar **4+1 Multi-Agent Architecture** com lazy activation.

**Rationale:**
| Critério | Single | Multi (All) | 4+1 Lazy | Ensemble |
|----------|--------|-------------|-----------|----------|
| Custo tokens | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| Latência | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Especialização | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Complexidade | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Manutenção | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |

**Architecture:**
```
┌─────────────────────────────────────┐
│        ORCHESTRATOR (Always)        │
│   • Coordena todos os agentes       │
│   • Gerencia estado da sessão       │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│         ROUTER (Always)              │
│   • Classifica intenção             │
│   • Confidence score                │
│   • Decide delegação                │
└─────────────────┬───────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌────────┐  ┌────────┐  ┌────────┐
│Scheduler│  │ Sales  │  │General │
│ (Lazy)  │  │ (Lazy) │  │ (Lazy) │
└────────┘  └────────┘  └────────┘

Activation Rules:
├── Router confidence >= 0.8 → Router resolve
├── Intent = scheduling → Scheduler activated
├── Intent = sales → Sales activated
└── Intent = general → Generalist activated
```

**Consequences:**
- ✅ Redução de 60-80% nos custos de tokens
- ✅ Latência menor (só router ativo)
- ✅ Especialização mantida
- ⚠️ Complexidade de coordenação

---

### ADR-005: 5-Layer Memory System

**Status:** ✅ Accepted

**Contexto:**
Agentes precisam de memória persistente e contextual. Opções:
1. Stateless (sem memória)
2. Single context window
3. Multi-layer memory
4. External RAG only

**Decision:**
Implementar **5-Layer Memory System** hierárquico.

**Rationale:**
| Critério | Stateless | Single | Multi-Layer | RAG Only |
|----------|-----------|--------|-------------|----------|
| Contexto | ❌ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Custo | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Latência | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Persistência | ❌ | ❌ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Layers:**
```
L1: Session Cache (Redis, <5ms)
    └── Contexto ativo, últimas 20 mensagens

L2: Patient Memory (Postgres, <50ms)
    └── Dados estruturados do paciente

L3: Clinic Knowledge (Postgres, <50ms)
    └── Configurações, horários, profissionais

L4: Conversational Memory (Postgres, <100ms)
    └── Histórico de conversas, busca semântica

L5: Episodic/RAG (pgvector, <150ms)
    └── Knowledge base, FAQs, embeddings
```

**Consequences:**
- ✅ Contexto rico e persistente
- ✅ Latência otimizada por camada
- ✅ Escalabilidade
- ⚠️ Complexidade de sincronização

---

## 4. Performance Targets (SLIs/SLOs)

> **BMAD Requirement:** Targets mensuráveis com SLIs, SLOs e SLAs.

### 4.1 Service Level Indicators (SLIs)

| SLI | Definição | Método de Coleta |
|-----|-----------|-------------------|
| **Latência API** | Tempo de resposta HTTP | Vercel Analytics + APM |
| **Latência Agent** | Tempo até resposta do Claude | Logging interno |
| **Disponibilidade** | % de requests bem-sucedidos | Uptime monitoring |
| **Erro Rate** | % de requests com erro 5xx | Error tracking |
| **Throughput** | Requests/segundo | Load balancer metrics |
| **Token Efficiency** | Tokens por conversa completada | Claude API metrics |

### 4.2 Service Level Objectives (SLOs)

| Serviço | SLI | SLO (Target) | SLO (Warning) | Janela |
|----------|-----|---------------|---------------|--------|
| **API Gateway** | Latência p50 | < 100ms | < 150ms | 5 min |
| **API Gateway** | Latência p95 | < 200ms | < 300ms | 5 min |
| **API Gateway** | Latência p99 | < 500ms | < 750ms | 5 min |
| **API Gateway** | Disponibilidade | 99.9% | 99.5% | Mensal |
| **API Gateway** | Erro Rate | < 0.1% | < 0.5% | 5 min |
| **Agent Service** | Latência p50 | < 3s | < 5s | 5 min |
| **Agent Service** | Latência p95 | < 5s | < 8s | 5 min |
| **Agent Service** | Confiança | > 85% | > 75% | Diário |
| **WhatsApp** | Delivery Rate | > 99% | > 95% | Diário |
| **WhatsApp** | Latência | < 10s | < 30s | 5 min |
| **Dashboard** | Load Time p95 | < 2s | < 3s | 5 min |
| **Database** | Query Time p99 | < 50ms | < 100ms | 5 min |

### 4.3 Error Budgets

| Serviço | SLO | Error Budget/Mês | Consumo Atual |
|---------|-----|------------------|----------------|
| API Gateway | 99.9% | 43.2 min downtime | 0 min |
| Agent Service | 99.5% | 216 min downtime | 0 min |
| WhatsApp | 99.0% | 432 min downtime | 0 min |

### 4.4 Performance Test Scenarios

| Cenário | Carga | Métrica Target | Ferramenta |
|---------|-------|-----------------|------------|
| **Normal** | 100 req/s | p95 < 200ms | k6 |
| **Pico** | 500 req/s | p95 < 500ms | k6 |
| **Stress** | 1000 req/s | p95 < 1s | k6 |
| **Soak** | 200 req/s por 4h | Sem memory leak | k6 |
| **Spike** | 0 → 1000 req/s | Sem timeout | k6 |

---

## 5. API Contract

### 5.1 OpenAPI Specification

> **BMAD Requirement:** Contrato de API definido.

**Base URL:** `https://api.synkroo.com/v1`

**Authentication:** Bearer JWT (NextAuth/Auth.js)

**Content-Type:** `application/json`

### 5.2 Core Schemas

```yaml
# Patient Schema
Patient:
  type: object
  required:
    - id
    - clinic_id
    - name
    - phone
  properties:
    id:
      type: string
      format: uuid
    clinic_id:
      type: string
      format: uuid
    name:
      type: string
      maxLength: 255
    phone:
      type: string
      pattern: '^\+?[1-9]\d{1,14}$'
    email:
      type: string
      format: email
    whatsapp_id:
      type: string
    notes:
      type: string
    risk_score:
      type: number
      minimum: 0
      maximum: 1
    created_at:
      type: string
      format: date-time
    updated_at:
      type: string
      format: date-time

# Appointment Schema
Appointment:
  type: object
  required:
    - id
    - clinic_id
    - patient_id
    - dentist_id
    - procedure_id
    - datetime
    - status
  properties:
    id:
      type: string
      format: uuid
    clinic_id:
      type: string
      format: uuid
    patient_id:
      type: string
      format: uuid
    dentist_id:
      type: string
      format: uuid
    procedure_id:
      type: string
      format: uuid
    datetime:
      type: string
      format: date-time
    status:
      type: string
      enum: [scheduled, confirmed, completed, cancelled, no_show]
    notes:
      type: string
    confirmed_at:
      type: string
      format: date-time
    reminder_sent:
      type: boolean
    created_at:
      type: string
      format: date-time
    updated_at:
      type: string
      format: date-time

# Error Response
Error:
  type: object
  properties:
    error:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: array
          items:
            type: object
```

### 5.3 API Endpoints

> **Ver detalhes completos em:** Seção 7 do documento original

| Endpoint | Método | Rate Limit | Cache |
|----------|--------|------------|-------|
| `/auth/*` | POST | 10/min | None |
| `/appointments` | GET/POST | 100/min | 30s |
| `/patients` | GET/POST | 100/min | 60s |
| `/conversations` | GET | 60/min | 10s |
| `/whatsapp/*` | ALL | 50/min | None |
| `/dashboard/*` | GET | 30/min | 30s |

---

## 6. Observability Strategy

### 6.1 Three Pillars

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              OBSERVABILITY ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  METRICS                                                                         │   │
│  │                                                                                  │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                     │   │
│  │  │  Prometheus   │  │    Grafana    │  │   Vercel      │                     │   │
│  │  │   (Storage)   │  │  (Dashboards) │  │   Analytics   │                     │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘                     │   │
│  │                                                                                  │   │
│  │  Key Metrics:                                                                   │   │
│  │  ├── Request latency (p50, p95, p99)                                           │   │
│  │  ├── Error rate (4xx, 5xx)                                                     │   │
│  │  ├── Throughput (req/s)                                                        │   │
│  │  ├── Agent confidence scores                                                   │   │
│  │  ├── Token usage per conversation                                              │   │
│  │  └── WhatsApp delivery rate                                                    │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LOGS                                                                            │   │
│  │                                                                                  │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                     │   │
│  │  │   Logflare    │  │     Axiom     │  │   Supabase    │                     │   │
│  │  │  (App logs)   │  │  (Analysis)   │  │   (DB logs)   │                     │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘                     │   │
│  │                                                                                  │   │
│  │  Log Levels:                                                                    │   │
│  │  ├── ERROR: Application errors, exceptions                                     │   │
│  │  ├── WARN: Recoverable issues, degraded performance                            │   │
│  │  ├── INFO: Business events, agent decisions                                   │   │
│  │  └── DEBUG: Development details (prod: sampled)                               │   │
│  │                                                                                  │   │
│  │  Structured Format:                                                             │   │
│  │  {                                                                              │   │
│  │    "timestamp": "2026-03-26T10:00:00Z",                                       │   │
│  │    "level": "INFO",                                                            │   │
│  │    "clinic_id": "uuid",                                                        │   │
│  │    "user_id": "uuid",                                                          │   │
│  │    "action": "appointment_created",                                            │   │
│  │    "duration_ms": 45,                                                          │   │
│  │    "trace_id": "abc123"                                                        │   │
│  │  }                                                                              │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  TRACES                                                                           │   │
│  │                                                                                  │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                     │   │
│  │  │   OpenTelemetry│  │    Jaeger    │  │   Sentry      │                     │   │
│  │  │   (SDK)        │  │  (Backend)   │  │  (APM)        │                     │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘                     │   │
│  │                                                                                  │   │
│  │  Instrumented Operations:                                                       │   │
│  │  ├── HTTP requests (API endpoints)                                             │   │
│  │  ├── Database queries                                                          │   │
│  │  ├── Agent conversations (Claude API calls)                                    │   │
│  │  ├── MCP tool calls                                                            │   │
│  │  └── WhatsApp message flow                                                     │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Dashboards

| Dashboard | Propósito | Atualização | Acesso |
|-----------|-----------|-------------|--------|
| **Operations** | Health, latency, errors | Real-time | DevOps |
| **Business** | Conversations, appointments, conversions | 5 min | Product |
| **Agent Performance** | Confidence, escalation rate, token usage | 1 min | AI Team |
| **WhatsApp** | Delivery rate, connection status | Real-time | Support |

### 6.3 Alerting Rules

| Alert | Condição | Severidade | Canal |
|-------|----------|------------|-------|
| **High Error Rate** | Error rate > 1% por 5 min | Critical | PagerDuty |
| **API Latency** | p95 > 500ms por 10 min | Warning | Slack |
| **Agent Down** | No agent responses por 2 min | Critical | PagerDuty |
| **WhatsApp Disconnect** | Connection lost | Critical | Slack |
| **DB Slow Queries** | p99 > 100ms por 5 min | Warning | Slack |
| **Token Budget** | Usage > 80% do budget | Warning | Email |

---

## 7. Testing Strategy

### 7.1 Testing Pyramid

```
                    ┌─────────────┐
                    │     E2E     │  ← 10%
                    │   Tests     │
                    ├─────────────┤
                    │ Integration │  ← 20%
                    │   Tests     │
                    ├─────────────┤
                    │    Unit     │  ← 70%
                    │   Tests     │
                    └─────────────┘
```

### 7.2 Test Types

| Tipo | Framework | Cobertura Target | CI Stage |
|------|-----------|------------------|----------|
| **Unit Tests** | Vitest | 80% | Pre-commit |
| **Integration Tests** | Vitest + Supabase Local | 70% | PR |
| **E2E Tests** | Playwright | Critical paths | Pre-deploy |
| **API Tests** | Postman/Newman | All endpoints | PR |
| **Load Tests** | k6 | SLOs validation | Weekly |
| **Security Tests** | OWASP ZAP | Auth, RLS | Weekly |

### 7.3 Test Scenarios

#### Unit Tests
```typescript
// Example: Agent intent classification
describe('Router Agent', () => {
  it('should classify scheduling intent with >0.9 confidence', async () => {
    const message = 'Quero agendar uma consulta';
    const result = await router.classifyIntent(message);

    expect(result.intent).toBe('scheduling');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should escalate when confidence < 0.5', async () => {
    const message = 'asdfghjkl';
    const result = await router.classifyIntent(message);

    expect(result.action).toBe('escalate');
  });
});
```

#### Integration Tests
```typescript
// Example: Appointment creation flow
describe('Appointment Flow', () => {
  it('should create appointment and send confirmation', async () => {
    const patient = await createTestPatient();
    const dentist = await createTestDentist();

    const response = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient_id: patient.id,
        dentist_id: dentist.id,
        procedure_id: 'limpeza',
        datetime: '2026-03-27T14:00:00Z'
      });

    expect(response.status).toBe(201);
    expect(response.body.appointment.status).toBe('scheduled');

    // Verify reminder was scheduled
    const reminders = await getReminders(response.body.appointment.id);
    expect(reminders).toHaveLength(2); // 24h and 2h
  });
});
```

#### E2E Tests
```typescript
// Example: WhatsApp scheduling flow
test('patient can schedule via WhatsApp', async ({ page }) => {
  // Open WhatsApp widget
  await page.goto('/demo');
  await page.click('[data-testid="whatsapp-button"]');

  // Simulate message
  await page.fill('[data-testid="chat-input"]', 'Quero agendar uma limpeza');
  await page.press('[data-testid="chat-input"]', 'Enter');

  // Wait for agent response
  await page.waitForSelector('[data-testid="agent-response"]');

  // Verify scheduling started
  const response = await page.textContent('[data-testid="agent-response"]');
  expect(response).toContain('procedimento');
});
```

### 7.4 Test Data Management

```yaml
# Test fixtures
fixtures:
  clinics:
    - id: test-clinic-1
      name: Clínica Teste
      plan: growth

  patients:
    - id: test-patient-1
      clinic_id: test-clinic-1
      name: João Teste
      phone: '+5511999999999'

  dentists:
    - id: test-dentist-1
      clinic_id: test-clinic-1
      name: Dra. Maria Teste
```

---

## 8. CI/CD Pipeline

### 8.1 Pipeline Architecture

```yaml
# .github/workflows/main.yml
name: Synkroo CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  SUPABASE_PROJECT: ${{ secrets.SUPABASE_PROJECT }}

jobs:
  # Stage 1: Quality Gates
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  # Stage 2: Tests
  test-unit:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3

  test-integration:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: supabase/postgres:15.1.0.147
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres

  test-e2e:
    runs-on: ubuntu-latest
    needs: [test-unit, test-integration]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  # Stage 3: Security
  security-scan:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm audit --audit-level=high
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  # Stage 4: Build
  build:
    runs-on: ubuntu-latest
    needs: [test-unit, test-integration, test-e2e, security-scan]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: .next/

  # Stage 5: Deploy
  deploy-preview:
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          scope: ${{ secrets.VERCEL_SCOPE }}

  deploy-production:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          scope: ${{ secrets.VERCEL_SCOPE }}
      - name: Run migrations
        run: npx supabase db push --linked
```

### 8.2 Environments

| Environment | Branch | URL | Purpose |
|-------------|--------|-----|---------|
| **Development** | develop | dev.synkroo.com | Feature testing |
| **Preview** | PRs | pr-*.vercel.app | Review apps |
| **Staging** | main | staging.synkroo.com | Pre-production |
| **Production** | main (tagged) | app.synkroo.com | Live |

### 8.3 Deployment Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DEPLOYMENT FLOW                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  1. CODE PUSH                                                                           │
│     └── GitHub receives push to branch                                                  │
│                                                                                          │
│  2. CI PIPELINE                                                                         │
│     ├── Lint & Type Check                                                               │
│     ├── Unit Tests (80% coverage required)                                              │
│     ├── Integration Tests                                                               │
│     ├── E2E Tests (critical paths)                                                      │
│     └── Security Scan                                                                   │
│                                                                                          │
│  3. BUILD                                                                               │
│     └── Next.js build generation                                                        │
│                                                                                          │
│  4. PREVIEW DEPLOY                                                                      │
│     └── Vercel preview URL for PR review                                               │
│                                                                                          │
│  5. STAGING DEPLOY                                                                      │
│     ├── Merge to main triggers staging deploy                                           │
│     ├── Database migrations (supabase db push)                                         │
│     └── Smoke tests automated                                                           │
│                                                                                          │
│  6. PRODUCTION DEPLOY                                                                   │
│     ├── Manual approval (tagged releases)                                               │
│     ├── Blue-green deployment                                                           │
│     ├── Health check (30s)                                                              │
│     └── Rollback automated on failure                                                  │
│                                                                                          │
│  7. POST-DEPLOY                                                                         │
│     ├── Monitor error rates (10 min)                                                    │
│     ├── Performance baseline check                                                      │
│     └── Alert if degradation detected                                                  │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Rollback Procedure

```bash
# Automatic rollback (CI/CD)
vercel rollback --token $VERCEL_TOKEN

# Manual rollback
git revert HEAD
git push origin main

# Database rollback (if migration failed)
supabase migration repair --status reverted <migration_id>
```

---

## 9. Disaster Recovery

### 9.1 Backup Strategy

| Component | RPO | RTO | Backup Method | Retention |
|-----------|-----|-----|---------------|-----------|
| **PostgreSQL** | 1h | 15 min | Supabase PITR | 7 days |
| **Storage** | 24h | 1h | Cross-region replication | 30 days |
| **Redis** | 5 min | 5 min | AOF + Snapshot | 7 days |
| **Code** | 0 | 5 min | Git (GitHub) | Unlimited |

### 9.2 Recovery Procedures

#### Database Recovery
```bash
# Point-in-time recovery
supabase db restore --timestamp "2026-03-26T10:00:00Z"

# Full database restore
supabase db reset --linked
supabase db push --linked
```

#### WhatsApp Connection Recovery
```typescript
// Automatic reconnection logic
const reconnectWhatsApp = async (clinicId: string) => {
  // 1. Check connection status
  const status = await whatsapp.getStatus(clinicId);

  if (status === 'disconnected') {
    // 2. Generate new QR code
    const qr = await whatsapp.generateQR(clinicId);

    // 3. Notify admin
    await notifications.send({
      clinicId,
      type: 'whatsapp_reconnect_required',
      qrCode: qr
    });
  }
};
```

### 9.3 Incident Response

| Severity | Response Time | Escalation | Communication |
|----------|---------------|------------|---------------|
| **P1 (Critical)** | 5 min | PagerDuty → On-call | Status page + Slack |
| **P2 (High)** | 30 min | Slack → Team lead | Slack |
| **P3 (Medium)** | 4h | Ticket | Email |
| **P4 (Low)** | 24h | Ticket | None |

---

## 10. Data Architecture

### 10.1 Schema Diagram

> **Ver schema completo (20 tabelas) em:** Seção 6 do documento original

### 10.2 Indexes Críticos

```sql
-- Performance críticos
CREATE INDEX idx_appointments_clinic_date ON appointments(clinic_id, datetime);
CREATE INDEX idx_patients_clinic_phone ON patients(clinic_id, phone);
CREATE INDEX idx_conversations_clinic_status ON conversations(clinic_id, status);

-- RLS Performance
CREATE INDEX idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX idx_appointments_clinic_id ON appointments(clinic_id);

-- Vector search (RAG)
CREATE INDEX idx_knowledge_embedding ON knowledge_base
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 11. Security Architecture

### 11.1 Security Layers

> **Ver detalhes em:** Seção 9 do documento original

### 11.2 LGPD Compliance

| Requisito | Implementação |
|-----------|---------------|
| **Consentimento** | Opt-in no cadastro, termos de uso |
| **Direito de acesso** | Endpoint `/patients/:id/export` |
| **Direito de exclusão** | Soft delete + endpoint de remoção permanente |
| **Portabilidade** | Export JSON/CSV de dados |
| **Minimização** | Só coletar dados necessários |
| **Retenção** | Política de retenção (2 anos inativo = anonimizar) |

---

## 12. Scalability

### 12.1 Scaling Strategy

> **Ver detalhes em:** Seção 10 do documento original

### 12.2 Cost Model

| Fase | Clínicas | Infra Cost/mês | Cost/Clínica |
|------|----------|----------------|---------------|
| **MVP** | 1-50 | R$ 500-1.000 | R$ 10-20 |
| **Growth** | 50-200 | R$ 2.000-5.000 | R$ 10-25 |
| **Scale** | 200+ | R$ 10.000+ | R$ 30-50 |

---

## 13. Appendices

### 13.1 Related Documents

| Documento | Path | Status |
|-----------|------|--------|
| PRD v3.2 | `docs/planning/prd-v3.2.md` | ✅ BMAD Compliant |
| UX Design v2.0 | `docs/ux-design.md` | ✅ Aprovado |
| BMAD Validation | `docs/planning/bmad-validation-report.md` | ✅ Completo |

### 13.2 ADR Index

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | Supabase-Only para MVP | ✅ Accepted |
| ADR-002 | WhatsApp Híbrido | ✅ Accepted |
| ADR-003 | RLS para Multi-Tenant | ✅ Accepted |
| ADR-004 | 4+1 Multi-Agent Architecture | ✅ Accepted |
| ADR-005 | 5-Layer Memory System | ✅ Accepted |

---

**Document Status:** ✅ BMAD Compliant
**Next Step:** UX Design v2.1 (Wireframes visuais + Interaction Design)
**Generated by:** BMAD Method v6.2.2