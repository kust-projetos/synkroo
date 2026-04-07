# Technical Research - Synkroo

**Data:** 2026-03-24
**Metodologia:** BMAD Technical Research
**Status:** ✅ Atualizado para MVP Simplificado

---

## Executive Summary

**Arquitetura MVP:** Stack simplificada **Supabase-only** com multi-tenancy via Row-Level Security (RLS), construída sobre **Claude Agent SDK** para orquestração de agentes autônomos.

> ⚠️ **Nota:** Este documento foi atualizado para refletir a stack simplificada do MVP. A versão original com microservices completa está disponível no histórico.

---

## 1. Stack Tecnológica MVP (Simplificada)

### 1.1 Stack Supabase-Only

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND                                  │
│   Next.js 15 + App Router + shadcn/ui + Tailwind           │
│   Zustand + TanStack Query                                   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    SUPABASE (TUDO EM UM)                    │
│   ├── PostgreSQL 16+ (com pgvector)                         │
│   ├── Auth (Row-Level Security)                              │
│   ├── Storage (arquivos)                                     │
│   ├── Realtime (subscriptions)                               │
│   └── Edge Functions (serverless)                            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    AGENTE SDK                                │
│   @anthropic-ai/sdk + Claude Agent SDK                       │
│   ├── Router Agent (MVP)                                     │
│   └── Assistant Agent (MVP)                                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    INTEGRAÇÕES                               │
│   ├── WhatsApp Web + Playwright                              │
│   ├── Instagram DM API                                       │
│   └── Chat Widget                                            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Frontend

| Componente | Tecnologia | Justificativa |
|------------|------------|---------------|
| **Framework** | Next.js 15 + App Router | Suporte React 19, Turbopack estável, SSR/SSG |
| **UI Library** | shadcn/ui + Tailwind CSS | Componentes acessíveis, desenvolvimento rápido |
| **State Management** | Zustand + TanStack Query | Simplicidade + cache eficiente |
| **Realtime** | Pusher ou Ably | Dashboard em tempo real, notificações |
| **Forms** | React Hook Form + Zod | Validação type-safe |

**Features do Next.js 15 aproveitadas:**
- Turbopack estável (76.7% mais rápido no startup)
- Caching semântico melhorado
- React 19 + React Compiler (experimental)
- Server Components com HMR otimizado
- `<Form>` component nativo com prefetch

### 1.2 Backend

| Componente | Tecnologia | Justificativa |
|------------|------------|---------------|
| **Runtime** | Node.js 22 LTS ou Bun | Performance, ecossistema maduro |
| **Framework** | Hono.js ou Fastify | Edge-ready, leve, TypeScript nativo |
| **Agent Framework** | @anthropic-ai/sdk + AI SDK Vercel | Integração nativa com Claude |
| **Queue/Workers** | BullMQ + Redis | Entrega garantida, retries, scheduling |
| **WebSocket** | Socket.io ou WS | Comunicação em tempo real |

### 1.3 Database & Storage

| Tipo | Tecnologia | Justificativa |
|------|------------|---------------|
| **Primary DB** | PostgreSQL 16+ (Supabase ou Neon) | RAG nativo com pgvector, RLS |
| **Vector Store** | pgvector + HNSW index | Busca semântica integrada ao PostgreSQL |
| **Cache/Sessions** | Redis (Upstash) | Sessões, rate limiting, filas |
| **Object Storage** | Cloudflare R2 ou AWS S3 | Áudios, documentos, imagens |
| **Blob/Files** | Vercel Blob ou Supabase Storage | Arquivos temporários |

### 1.4 Infrastructure

| Componente | Tecnologia | Justificativa |
|------------|------------|---------------|
| **Hosting** | Vercel ou AWS | Serverless-friendly |
| **CDN** | Cloudflare | Edge caching, DDoS protection |
| **Monitoring** | Sentry + Grafana Cloud | Error tracking + métricas |
| **Logging** | Axiom ou Better Stack | Logs estruturados |
| **Email** | Resend | Transacional + marketing |

---

## 2. Arquitetura de Agentes (v2.0 - 4+1)

> **Atualizado em:** 2026-03-25
> **Spec:** `docs/superpowers/specs/2026-03-25-agent-design.md`

### 2.1 Arquitetura Multi-Agente (4+1 com Lazy Activation)

A arquitetura utiliza um modelo 4+1 onde **4 especialistas** são ativados de forma **lazy** (sob demanda) por um **Orchestrator** central, com **Router** sempre ativo para classificação.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR AGENT                               │
│                    (Coordenador Central - Sempre Ativo)                  │
│                                                                          │
│  Responsabilidades:                                                      │
│  • Receber todas as mensagens                                            │
│  • Manter contexto da conversa                                           │
│  • Coordenar memória (5 camadas)                                         │
│  • Delegar para especialistas (via Router)                              │
│  • Retornar resposta final                                               │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────────────┐
         │                          │                                  │
         ▼                          ▼                                  ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐
│   ROUTER AGENT  │    │ SCHEDULER AGENT │    │     SALES AGENT         │
│   (Classifica)  │    │   (Agendamento) │    │   (Vendas/Reativação)   │
├─────────────────┤    ├─────────────────┤    ├─────────────────────────┤
│ Ativação: ALWAYS│    │ Ativação: LAZY  │    │ Ativação: LAZY          │
│                 │    │                 │    │                         │
│ • Classifica    │    │ • Agendar       │    │ • Follow-up orçamento   │
│   intenção      │    │ • Reagendar     │    │ • Reativar inativos     │
│ • Rota para     │    │ • Cancelar      │    │ • Cross-sell            │
│   especialista  │    │ • Lembretes     │    │ • Campanhas             │
│ • Confidence    │    │ • Disponibilidade│   │ • Promoções             │
│   scoring       │    │ • Lista espera  │    │                         │
│   < 0.8 = espec │    │ • Undo/rollback │    │                         │
└────────┬────────┘    └────────┬────────┘    └────────────┬────────────┘
         │                      │                           │
         └──────────────────────┴───────────────────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  GENERALIST AGENT │
                              │   (Fallback)      │
                              ├───────────────────┤
                              │ Ativação: LAZY    │
                              │                   │
                              │ • FAQs gerais     │
                              │ • Informações     │
                              │ • Saudações       │
                              │ • RAG search      │
                              └───────────────────┘
```

### 2.2 Especificações dos Agentes

#### Orchestrator Agent (Sempre Ativo)

```typescript
interface OrchestratorConfig {
  id: "orchestrator";
  model: "claude-sonnet-4-20250514";
  activation: "ALWAYS";

  responsibilities: [
    "receive_all_messages",
    "maintain_conversation_context",
    "coordinate_memory",
    "delegate_via_router",
    "return_final_response"
  ];

  contextWindow: {
    maxMessages: 50,
    priorityQueue: true,
    earlyExit: true
  };

  delegationThreshold: {
    routerConfidence: 0.8,  // Below this, invoke specialist
    escalateToHuman: 0.5    // Below this, escalate
  };
}
```

#### Router Agent (Sempre Ativo)

```typescript
interface RouterConfig {
  id: "router";
  model: "claude-haiku-4-5-20251001";  // Fast classification
  activation: "ALWAYS";

  classification: {
    intents: [
      "SCHEDULING",      // → Scheduler Agent
      "BILLING",         // → Sales Agent
      "MEDICAL_INFO",    // → Generalist Agent
      "REACTIVATION",    // → Sales Agent
      "FOLLOW_UP",       // → Scheduler Agent
      "GENERAL"          // → Generalist Agent
    ],

    confidenceThreshold: 0.8,

    routing: {
      SCHEDULING: "scheduler",
      BILLING: "sales",
      REACTIVATION: "sales",
      MEDICAL_INFO: "generalist",
      FOLLOW_UP: "scheduler",
      GENERAL: "generalist"
    }
  };
}
```

#### Scheduler Agent (Lazy Activation)

```typescript
interface SchedulerConfig {
  id: "scheduler";
  model: "claude-sonnet-4-20250514";
  activation: "LAZY";  // Only when Router confidence < 0.8

  capabilities: [
    "check_availability",
    "book_appointment",
    "cancel_appointment",
    "reschedule_appointment",
    "send_reminder",
    "manage_waitlist",
    "detect_no_show_risk"
  ];

  constraints: {
    workingHours: "clinic_config",
    bufferMinutes: 15,
    maxOverbooking: 0,
    respectBlockTimes: true
  };

  riskLevels: {
    LOW: {      // Auto-execute
      actions: ["check_availability", "send_reminder"],
      confirmation: "NONE"
    },
    MEDIUM: {   // Simple confirmation
      actions: ["book_appointment", "reschedule_appointment"],
      confirmation: "SIMPLE"
    },
    HIGH: {     // Double confirmation
      actions: ["cancel_appointment"],
      confirmation: "DOUBLE"
    }
  };
}
```

#### Sales Agent (Lazy Activation)

```typescript
interface SalesConfig {
  id: "sales";
  model: "claude-sonnet-4-20250514";
  activation: "LAZY";

  capabilities: [
    "follow_up_quote",
    "reactivate_inactive_patients",
    "cross_sell_procedures",
    "send_promotions",
    "collect_payment_info"
  ];

  triggers: {
    inactiveThreshold: "90 days",
    quoteFollowUpDelay: "48 hours",
    promotionTriggers: ["seasonal", "patient_birthday", "treatment_anniversary"]
  };

  persuasionTechniques: [
    "urgency", "social_proof", "reciprocity", "scarcity"
  ];
}
```

#### Generalist Agent (Lazy Activation)

```typescript
interface GeneralistConfig {
  id: "generalist";
  model: "claude-sonnet-4-20250514";
  activation: "LAZY";

  capabilities: [
    "answer_general_questions",
    "provide_clinic_info",
    "handle_greetings",
    "search_knowledge_base",
    "escalate_complex_medical"
  ];

  ragIntegration: {
    enabled: true,
    knowledgeBase: "clinic_documents",
    searchType: "hybrid",  // Vector + BM25
    topK: 5
  };
}
```

### 2.3 Sistema de Memória

```
┌─────────────────────────────────────────────────────────────────────┐
│                      MEMORY ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  SHORT-TERM MEMORY (Redis)                                   │   │
│  │  ├── TTL: 24 horas                                          │   │
│  │  ├── Uso: Contexto de conversa ativa                        │   │
│  │  ├── Estrutura: {session_id, messages[], context}           │   │
│  │  └── Acesso: <10ms                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LONG-TERM MEMORY (PostgreSQL + pgvector + HNSW)           │   │
│  │  ├── TTL: Permanente                                        │   │
│  │  ├── Uso: Histórico do paciente, preferências              │   │
│  │  ├── Indexação: HNSW para busca semântica                  │   │
│  │  └── Acesso: <50ms                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  RAG KNOWLEDGE BASE (pgvector)                              │   │
│  │  ├── Documentos: Protocolos, FAQs, preços, orientações     │   │
│  │  ├── Embeddings: text-embedding-3-small (OpenAI)           │   │
│  │  ├── Retrieval: Hybrid (vector similarity + BM25)          │   │
│  │  └── Chunking: 512 tokens, 50 overlap                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Integrações de Canais

### 3.1 WhatsApp Business API

| Aspecto | Especificação |
|---------|---------------|
| **Provider** | Meta Cloud API (direto) ou Twilio/360dialog |
| **Webhook** | `POST /webhooks/whatsapp` |
| **Autenticação** | Bearer token + Webhook verification signature |
| **Rate Limit** | 80 mensagens/segundo por número |

**Estratégia Híbrida:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WHATSAPP ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  INBOUND (Paciente → Clínica)                                       │
│  └── API Oficial Meta Cloud API                                     │
│      ├── Conformidade total com termos                              │
│      ├── Sem risco de banimento                                     │
│      └── Custo: USD 0.00-0.08/conversa (depende da categoria)      │
│                                                                      │
│  OUTBOUND (Clínica → Paciente)                                      │
│  ├── Dentro de 24h window: API Oficial                              │
│  │   └── Resposta livre (incluída na conversa iniciada)            │
│  │                                                                   │
│  └── Fora de 24h window: Playwright + WhatsApp Web                 │
│      ├── Simula comportamento humano                                │
│      ├── Reduz risco de banimento                                   │
│      ├── Sem custo de API                                           │
│      └── Requer manutenção contínua                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Custos Meta Cloud API:**

| Categoria | Custo | Janela |
|-----------|-------|--------|
| Authentication | USD 0.0135 | - |
| Marketing | USD 0.0250 | - |
| Utility | USD 0.0080 | - |
| Service | USD 0.0035 | - |
| **Conversa iniciada pelo usuário** | **Grátis** | 24h |

### 3.2 Instagram Graph API

| Aspecto | Especificação |
|---------|---------------|
| **Endpoint** | Graph API v18.0+ |
| **Escopos** | `instagram_basic`, `instagram_manage_messages` |
| **Webhook** | `POST /webhooks/instagram` |
| **Limite** | Janela de 24h para resposta livre |

### 3.3 Telegram Bot API

| Aspecto | Especificação |
|---------|---------------|
| **Endpoint** | `https://api.telegram.org/bot<token>` |
| **Webhook** | `POST /webhooks/telegram` |
| **Custo** | Gratuito |
| **Limite** | 30 mensagens/segundo |

---

## 4. MCP Servers

### 4.1 MCP Servers Necessários

| MCP Server | Uso | Status | Prioridade |
|------------|-----|--------|------------|
| **postgres-mcp** | Consultas ao banco, RAG queries | Existente | P0 |
| **filesystem-mcp** | Acesso a documentos da clínica | Existente | P1 |
| **brave-search-mcp** | Busca de informações médicas | Existente | P2 |
| **calendar-mcp** | Gerenciamento de agendamentos (custom) | Custom | P0 |
| **whatsapp-mcp** | Envio de mensagens WhatsApp (custom) | Custom | P0 |
| **patients-mcp** | Operações de pacientes (custom) | Custom | P1 |

### 4.2 MCP Servers para MVP

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MCP SERVERS - MVP                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  TIER 1: CRITICAL (Sprint 1-2)                                      │
│  ├── calendar-mcp (custom)                                          │
│  │   ├── check_availability                                        │
│  │   ├── book_appointment                                          │
│  │   ├── cancel_appointment                                        │
│  │   ├── reschedule_appointment                                    │
│  │   └── get_professional_schedule                                 │
│  │                                                                   │
│  ├── whatsapp-mcp (custom)                                          │
│  │   ├── send_message                                              │
│  │   ├── receive_message (webhook)                                 │
│  │   ├── send_template                                            │
│  │   └── get_qr_code                                               │
│  │                                                                   │
│  └── postgres-mcp (existente)                                       │
│      ├── query (RLS-aware)                                         │
│      ├── insert                                                     │
│      └── update                                                     │
│                                                                      │
│  TIER 2: IMPORTANT (Sprint 3-4)                                     │
│  ├── patients-mcp (custom)                                          │
│  │   ├── create_patient                                            │
│  │   ├── get_patient                                               │
│  │   ├── update_patient                                            │
│  │   ├── search_patients                                           │
│  │   └── get_patient_history                                       │
│  │                                                                   │
│  └── filesystem-mcp (existente)                                     │
│      ├── read_file (documentos, protocolos)                        │
│      └── list_directory                                            │
│                                                                      │
│  TIER 3: NICE-TO-HAVE (Pós-MVP)                                     │
│  ├── brave-search-mcp (existente)                                   │
│  │   └── search (informações médicas gerais)                       │
│  │                                                                   │
│  └── instagram-mcp (custom)                                         │
│      ├── send_dm                                                    │
│      └── receive_dm                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 MCP Custom: calendar-mcp

```typescript
// server.ts - Calendar MCP Server
import { McpServer } from "@modelcontextprotocol/sdk";

const server = new McpServer({
  name: "clinic-calendar",
  version: "1.0.0"
});

// Tools
server.tool("check_availability", {
  description: "Verifica disponibilidade de horário",
  parameters: {
    professional_id: { type: "string" },
    datetime: { type: "string" },
    duration_minutes: { type: "number" }
  },
  handler: async (params) => {
    // Query PostgreSQL for availability
    return { available: true, slots: [...] };
  }
});

server.tool("book_appointment", {
  description: "Agenda uma consulta",
  parameters: {
    patient_id: { type: "string" },
    professional_id: { type: "string" },
    datetime: { type: "string" },
    duration_minutes: { type: "number" },
    notes: { type: "string" }
  },
  handler: async (params) => {
    // Create appointment in database
    // Trigger confirmation flow
    return { appointment_id: "...", confirmed: true };
  }
});
```

---

## 5. Multi-Tenancy

### 5.1 Estratégia: Row-Level Security (RLS)

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Criar políticas de isolamento
CREATE POLICY clinic_isolation_patients ON patients
  USING (clinic_id = current_setting('app.current_clinic')::uuid);

CREATE POLICY clinic_isolation_appointments ON appointments
  USING (clinic_id = current_setting('app.current_clinic')::uuid);

CREATE POLICY clinic_isolation_conversations ON conversations
  USING (clinic_id = current_setting('app.current_clinic')::uuid);
```

### 5.2 Set Clinic Context (Middleware)

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const clinicId = request.headers.get('x-clinic-id')
    || getSessionClinicId(request);

  // Set PostgreSQL session variable for RLS
  await db.query(`
    SET app.current_clinic = '${clinicId}'
  `);

  return NextResponse.next();
}
```

### 5.3 Per-Tenant Customization

| Aspecto | Customização |
|---------|--------------|
| **Branding** | Logo, cores, nome |
| **Horários** | Funcionamento por profissional |
| **Mensagens** | Templates personalizados |
| **Flows** | Jornadas de conversa customizadas |
| **Integrações** | Canais ativos por clínica |
| **Modelo IA** | Claude Sonnet ou Opus |

---

## 6. RAG Architecture

### 6.1 Hybrid RAG (Vector + Keyword)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      RAG PIPELINE                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. INGESTION                                                       │
│     ├── Upload documentos (PDF, DOCX, TXT)                         │
│     ├── Chunking: 512 tokens, 50 overlap                           │
│     ├── Embedding: text-embedding-3-small                          │
│     └── Store: PostgreSQL + pgvector                               │
│                                                                      │
│  2. RETRIEVAL                                                       │
│     ├── Query embedding                                             │
│     ├── Vector search (HNSW, k=20)                                  │
│     ├── BM25 keyword search (PostgreSQL full-text)                  │
│     ├── Hybrid fusion (RRF)                                         │
│     └── Re-ranking (Cohere Rerank - opcional)                      │
│                                                                      │
│  3. GENERATION                                                      │
│     ├── Context assembly                                            │
│     ├── Prompt construction                                         │
│     └── Claude API call                                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Knowledge Sources

| Fonte | Conteúdo | Atualização |
|-------|----------|-------------|
| **Protocolos médicos** | Procedimentos, condutas | Manual |
| **Tabela de preços** | Valores, convênios | Manual |
| **FAQs** | Perguntas frequentes | Manual |
| **Orientações pós** | Cuidados pós-procedimento | Manual |
| **Políticas** | Cancelamento, reagendamento | Manual |

---

## 7. Security & Compliance

### 7.1 LGPD Requirements

| Artigo | Requisito | Implementação |
|--------|-----------|---------------|
| **Art. 11** | Consentimento explícito | Checkbox no primeiro contato |
| **Art. 13** | Direito de acesso | Endpoint `/api/patient/data` |
| **Art. 18** | Direito de eliminação | Soft delete + purge em 30 dias |
| **Art. 20** | Decisões automatizadas | Log de decisões + opção de revisão |
| **Art. 46** | Segurança dos dados | Criptografia, access control |

### 7.2 Technical Controls

| Controle | Implementação |
|----------|---------------|
| **Criptografia at-rest** | AES-256-GCM (AWS KMS) |
| **Criptografia in-transit** | TLS 1.3 |
| **Authentication** | JWT + Refresh tokens, MFA para admins |
| **Authorization** | RBAC (owner, admin, staff) |
| **Audit Logging** | Trigger em todas tabelas sensíveis |
| **Data Residency** | AWS São Paulo (sa-east-1) |
| **Backup** | Diário, 30 dias retenção |

### 7.3 AI-Specific (Art. 20 LGPD)

```typescript
// Transparência sobre uso de IA
const AI_DISCLOSURE = `
Este atendimento é realizado por assistente virtual com inteligência artificial.
Você pode solicitar falar com uma pessoa humana a qualquer momento.
`;

// Opção de falar com humano
function handleHumanRequest(conversationId: string) {
  // Notificar equipe
  // Pausar respostas automáticas
  // Transferir contexto
}

// Log de decisões da IA
interface AIDecisionLog {
  timestamp: Date;
  conversationId: string;
  intent: string;
  action: string;
  confidence: number;
  humanReviewRequested: boolean;
}
```

---

## 8. Custos Estimados

### 8.1 Custos por Clínica (mensal)

| Porte | Conversas/dia | Claude API | Canais | Infra | Total |
|-------|---------------|------------|--------|-------|-------|
| **Pequena** | 50 | $15-25 | $30 | $50 | **~$100/mês** |
| **Média** | 200 | $60-100 | $120 | $100 | **~$350/mês** |
| **Grande** | 1000 | $300-500 | $600 | $200 | **~$1.350/mês** |

### 8.2 Custos de Infraestrutura

| Ambiente | Custo/mês | Especificação |
|----------|-----------|---------------|
| **Development** | $0-50 | Vercel hobby + Supabase free |
| **Production Small** | $200-450 | Vercel Pro + Supabase Pro + Upstash |
| **Production Medium** | $600-1.150 | Vercel Team + Supabase Team + Redis |
| **Production Large** | $1.900-3.900 | AWS/GCP + Multi-region |

### 8.3 Claude API Pricing

| Modelo | Input | Output | Uso Recomendado |
|--------|-------|--------|-----------------|
| **Claude Sonnet 4** | $3/MTok | $15/MTok | Padrão (95% dos casos) |
| **Claude Opus 4** | $15/MTok | $75/MTok | Casos complexos |
| **Claude Haiku** | $0.25/MTok | $1.25/MTok | Classificação simples |

---

## 9. Diagrama de Arquitetura

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CLIENTES (Clínicas)                              │
│    Dashboard Next.js  │  WhatsApp  │  Instagram  │  Telegram  │  Email  │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                        CDN / EDGE (Cloudflare)                           │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                     API GATEWAY (Vercel / AWS)                           │
│                    Rate Limiting, Auth, Routing                          │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  WEBHOOK HANDLER  │   │   API SERVICES    │   │   DASHBOARD API   │
│  /whatsapp        │   │   /patients       │   │   /analytics      │
│  /instagram       │   │   /appointments   │   │   /reports        │
│  /telegram        │   │   /conversations  │   │   /settings       │
└─────────┬─────────┘   └─────────┬─────────┘   └─────────┬─────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      MESSAGE QUEUE (BullMQ + Redis)                      │
│                                                                          │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│   │  incoming   │   │  outgoing   │   │   agents    │   │   reminders │ │
│   └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘ │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                    AGENT ORCHESTRATOR SERVICE                            │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      ROUTER AGENT                                │   │
│   │              (Classifica e Delega)                               │   │
│   └──────────────────────────────┬──────────────────────────────────┘   │
│                                  │                                       │
│   ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│   │ Scheduling │ │  Medical   │ │  Billing   │ │  Triage    │          │
│   │   Agent    │ │Info Agent  │ │   Agent    │ │   Agent    │          │
│   └────────────┘ └────────────┘ └────────────┘ └────────────┘          │
│                                                                          │
│                         │ CLAUDE API SDK │                              │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                          MCP SERVERS LAYER                               │
│                                                                          │
│   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│   │ filesystem│ │  postgres │ │  calendar │ │  brave    │ │ whatsapp  │ │
│   │    mcp    │ │    mcp    │ │    mcp    │ │  search   │ │    mcp    │ │
│   └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘ │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                            DATA LAYER                                    │
│                                                                          │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │
│   │   PostgreSQL    │   │      Redis      │   │  Object Storage │       │
│   │   + pgvector    │   │    (Upstash)    │   │    (R2/S3)      │       │
│   │   Multi-tenant  │   │                 │   │                 │       │
│   │   RLS Enabled   │   │                 │   │                 │       │
│   └─────────────────┘   └─────────────────┘   └─────────────────┘       │
│                                                                          │
│                     AWS São Paulo (sa-east-1)                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Próximos Passos

### 10.1 FASE 1: MVP (4 semanas)

**Sprint 1-2:**
- [ ] Setup projeto (Next.js 15 + Hono)
- [ ] PostgreSQL + RLS
- [ ] Redis para sessões
- [ ] WhatsApp Business API integration
- [ ] Router Agent básico

**Sprint 3-4:**
- [ ] Scheduling Agent
- [ ] Sistema de lembretes
- [ ] Dashboard básico
- [ ] CRM básico
- [ ] **Piloto com 1 clínica**

### 10.2 FASE 2: Consolidação (4 semanas)

- Multi-tenant robusto
- Instagram integration
- RAG com pgvector
- Dashboard avançado

### 10.3 FASE 3: Expansão (8 semanas)

- Telegram integration
- Call Center IA
- Marketing automation
- App mobile

---

## 11. Referências

- [Next.js 15 Documentation](https://nextjs.org/blog/next-15)
- [Anthropic Claude API](https://docs.anthropic.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [PostgreSQL pgvector](https://github.com/pgvector/pgvector)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [LGPD - Lei Geral de Proteção de Dados](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)