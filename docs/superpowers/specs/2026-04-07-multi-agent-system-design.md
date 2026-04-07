# Multi-Agent System Design Specification - Synkroo

**Versão:** 1.0
**Data:** 2026-04-07
**Status:** Aprovado
**Baseado em:** Brainstorming com Walis

---

## 1. Visão Geral

Sistema multi-agente para atendimento automatizado de clínica odontológica, utilizando arquitetura 4+1 com Orchestrator como coordenador central. Cada agente é especializado em uma função e se comunica via filas assíncronas.

**Stack:**
- LLM: MiniMax (OpenAI-compatible API)
- Queue: PostgreSQL com LISTEN/NOTIFY
- Memória: 5 camadas (L1-L5)
- Logging: Resumido (essencial + decisões)

---

## 2. Arquitetura de Agentes (4+1)

### 2.1 Diagrama de Arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR AGENT                           │
│  (Coordenador Central - Sempre Ativo)                           │
│                                                                   │
│  Responsabilidades:                                               │
│  • Receber mensagem do cliente                                    │
│  • Carregar contexto (L1-L5)                                      │
│  • Coordenar fluxo entre agentes                                 │
│  • Aggregar resposta final                                        │
│  • Timeout management (30s total)                                │
└────────────────────────────┬─────────────────────────────────────┘
                              │ NOTIFY "new_task"
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   ROUTER   │      │  SCHEDULER  │      │    SALES   │
│   AGENT    │      │   AGENT     │      │   AGENT    │
├─────────────┤      ├─────────────┤      ├─────────────┤
│ Ativação:  │      │ Ativação:   │      │ Ativação:   │
│ ALWAYS     │      │ LAZY        │      │ LAZY        │
├─────────────┤      ├─────────────┤      ├─────────────┤
│ • classify()│      │ • schedule()│      │ • sales()  │
│ • extract() │      │ • book()    │      │ • lead()   │
│             │      │ • cancel()  │      │ • budget() │
│ timeout: 5s │      │ timeout: 10s│      │ timeout: 10s│
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            ▼ NOTIFY "task_done"
                   ┌─────────────┐
                   │ GENERALIST │
                   │   AGENT    │
                   ├─────────────┤
                   │ Ativação:   │
                   │ LAZY        │
                   ├─────────────┤
                   │ • fallback()│
                   │ • search()  │
                   │ • answer()  │
                   │ timeout: 5s │
                   └─────────────┘
```

### 2.2 Especificações dos Agentes

#### Orchestrator Agent

```typescript
interface OrchestratorConfig {
  id: 'orchestrator'
  timeout: 30000 // 30s total
  memoryLayers: ['L1', 'L2', 'L3', 'L4', 'L5'] // Carrega todas
}
```

**Fluxo:**
1. Recebe mensagem via API
2. Carrega contexto de todas as camadas (L1-L5)
3. Cria mensagem na fila para Router
4. Espera resposta (LISTEN + timeout)
5. Retorna resposta consolidada

#### Router Agent

```typescript
interface RouterConfig {
  id: 'router'
  activation: 'ALWAYS'
  timeout: 5000
  intents: [
    'SCHEDULING',   // → Scheduler
    'BILLING',      // → Sales
    'REACTIVATION', // → Sales
    'MEDICAL_INFO', // → Generalist
    'GENERAL'       // → Generalist
  ]
}
```

#### Scheduler Agent

```typescript
interface SchedulerConfig {
  id: 'scheduler'
  activation: 'LAZY'
  timeout: 10000
  capabilities: [
    'check_availability',
    'book_appointment',
    'cancel_appointment',
    'reschedule'
  ]
}
```

#### Sales Agent

```typescript
interface SalesConfig {
  id: 'sales'
  activation: 'LAZY'
  timeout: 10000
  capabilities: [
    'follow_up_quote',
    'reactivate_patient',
    'create_budget',
    'send_promotion'
  ]
}
```

#### Generalist Agent

```typescript
interface GeneralistConfig {
  id: 'generalist'
  activation: 'LAZY'
  timeout: 5000
  capabilities: [
    'answer_faq',
    'search_knowledge',
    'provide_clinic_info'
  ]
}
```

---

## 3. Sistema de Queue (PostgreSQL + LISTEN/NOTIFY)

### 3.1 Tabela Principal

```sql
CREATE TABLE agent_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent VARCHAR(50) NOT NULL,
  to_agent VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  process_after TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX idx_agent_queue_status ON agent_queue(status);
CREATE INDEX idx_agent_queue_to_agent ON agent_queue(to_agent);
CREATE INDEX idx_agent_queue_process_after ON agent_queue(process_after);
```

### 3.2 Trigger para NOTIFY

```sql
CREATE OR REPLACE FUNCTION agent_queue_notify()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('agent_queue', json_build_object(
    'id', NEW.id,
    'to_agent', NEW.to_agent,
    'status', NEW.status
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_queue_trigger
AFTER INSERT OR UPDATE ON agent_queue
FOR EACH ROW EXECUTE FUNCTION agent_queue_notify();
```

### 3.3 Dead Letter Queue (DLQ)

```sql
CREATE TABLE agent_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_queue_id UUID REFERENCES agent_queue(id),
  from_agent VARCHAR(50),
  to_agent VARCHAR(50),
  payload JSONB,
  error TEXT,
  retry_count INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  manual_action_required BOOLEAN DEFAULT true
);
```

### 3.4 Status Flow

```
pending → processing → done (sucesso)
                       ↓
                   failed (erro recoverable) → retry
                                      ↓
                                   DLQ (após 3 retries)
```

---

## 4. Retry com Backoff Exponencial

```typescript
const BACKOFF_CONFIG = {
  initialDelay: 1000,   // 1s
  multiplier: 2,        // ×2 a cada retry
  maxDelay: 16000,     // 16s max
  maxRetries: 3,
}

// Retry schedule:
// Retry 1: 1s
// Retry 2: 2s
// Retry 3: 4s
// Retry 4+: DLQ
```

---

## 5. Sistema de Memória (5 Camadas)

### 5.1 Layer 1: Session (In-Memory)

```typescript
interface L1Session {
  sessionId: string
  messages: ChatMessage[]
  currentIntent?: string
  entities: Record<string, string>
  createdAt: Date
  expiresAt: Date // +30 min
}

// In-memory Map<string, L1Session>
// TTL: 30 minutos
```

### 5.2 Layer 2: Patient (PostgreSQL)

```typescript
interface L2Patient {
  patientId: string
  nome: string
  telefone: string
  preferencias: Record<string, unknown>
  historico: Appointment[]
  riskScore: number
  ultimaVisita: Date
}
```

### 5.3 Layer 3: Clinic (PostgreSQL + Cache)

```typescript
interface L3Clinic {
  clinicId: string
  nome: string
  horarios: WorkingHours
  profissionais: Dentist[]
  procedimentos: Procedure[]
  configuracoes: ClinicSettings
}
```

### 5.4 Layer 4: Conversation (PostgreSQL)

```typescript
interface L4Conversation {
  conversationId: string
  messages: Message[]
  patientId?: string
  createdAt: Date
  updatedAt: Date
}
// Retenção: 2 anos (LGPD)
```

### 5.5 Layer 5: RAG (pgvector)

```typescript
interface L5Knowledge {
  id: string
  category: string
  question: string
  answer: string
  embedding: vector(1536)
  clinicId: string
  createdAt: Date
}
```

---

## 6. Ferramentas (Tools)

### 6.1 Base Tools (Todos Agentes)

```typescript
const BASE_TOOLS = [
  'search_patient',
  'get_clinic_info',
  'send_message',
  'log_decision',
]
```

### 6.2 Tools por Agente

```typescript
const AGENT_TOOLS = {
  router: [
    ...BASE_TOOLS,
    'classify_intent',
    'extract_entities',
  ],
  scheduler: [
    ...BASE_TOOLS,
    'check_availability',
    'book_appointment',
    'cancel_appointment',
    'reschedule_appointment',
  ],
  sales: [
    ...BASE_TOOLS,
    'get_lead_info',
    'create_budget',
    'send_promotion',
  ],
  generalist: [
    ...BASE_TOOLS,
    'search_knowledge',
    'answer_faq',
  ],
}
```

---

## 7. Logging e Explicabilidade

### 7.1 Estrutura de Log

```typescript
interface AgentDecisionLog {
  timestamp: Date
  agent: 'orchestrator' | 'router' | 'scheduler' | 'sales' | 'generalist'
  action: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  reasoning: string
  confidence?: number
  duration_ms: number
}
```

### 7.2 Tabela de Log

```sql
CREATE TABLE agent_decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  agent VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  input JSONB,
  output JSONB,
  reasoning TEXT,
  confidence DECIMAL(3,2),
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_decision_logs_conversation ON agent_decision_logs(conversation_id);
CREATE INDEX idx_decision_logs_agent ON agent_decision_logs(agent);
```

---

## 8. Fluxo de Mensagem Completo

```
1. Cliente envia mensagem → POST /api/agent/messages

2. Orchestrator:
   a. Recebe mensagem
   b. Carrega contexto (L1-L5)
   c. Cria queue message → 'router'
   d. INSERT + NOTIFY

3. Router (LISTEN):
   a. Consome mensagem
   b. classify_intent()
   c. extract_entities()
   d. Cria queue message → 'scheduler' | 'sales' | 'generalist'
   e. INSERT + NOTIFY

4. Agente Especializado (LISTEN):
   a. Consome mensagem
   b. Carrega ferramentas (tools)
   c. Executa ação
   d. Cria response message
   e. INSERT + NOTIFY 'task_done'

5. Generalist (fallback, se necessário):
   a. Consome mensagem
   b. search_knowledge() / answer_faq()
   c. Cria response message

6. Orchestrator (LISTEN):
   a. Recebe task_done notification
   b. Aggrega resposta
   c. Retorna para cliente

7. Timeout Handling:
   - Se nenhuma resposta em 30s → retorna erro
   - Se agente falha 3x → DLQ
```

---

## 9. Estrutura de Arquivos

```
src/
├── services/
│   ├── agents/
│   │   ├── base.agent.ts              # Classe abstrata comum
│   │   ├── orchestrator.agent.ts      # Coordenador
│   │   ├── router.agent.ts           # Classificação
│   │   ├── scheduler.agent.ts         # Agendamentos
│   │   ├── sales.agent.ts            # Vendas
│   │   └── generalist.agent.ts       # Fallback
│   ├── queue/
│   │   ├── queue.service.ts          # INSERT/NOTIFY/LISTEN
│   │   ├── dlq.service.ts           # Dead Letter Queue
│   │   └── agent-queue.repo.ts       # Repository pattern
│   ├── memory/
│   │   ├── L1-session.ts            # In-memory
│   │   ├── L2-patient.ts            # PostgreSQL
│   │   ├── L3-clinic.ts             # PostgreSQL + Cache
│   │   ├── L4-conversation.ts        # PostgreSQL
│   │   └── L5-rag.ts                # pgvector
│   └── tools/
│       ├── base.tools.ts             # Tools base
│       ├── router.tools.ts          # Router tools
│       ├── scheduler.tools.ts        # Scheduler tools
│       ├── sales.tools.ts           # Sales tools
│       └── generalist.tools.ts      # Generalist tools
├── app/
│   └── api/
│       └── agent/
│           └── messages/
│               └── route.ts          # Entry point
└── lib/
    └── llm/
        ├── provider.ts               # Interface
        ├── minimax.provider.ts      # MiniMax impl
        └── factory.ts              # Factory
```

---

## 10. API de Entrada

### POST /api/agent/messages

**Request:**
```json
{
  "clinic_id": "uuid",
  "visitor_id": "string",
  "message": "Quero agendar uma consulta",
  "conversation_id": "uuid (opcional)"
}
```

**Response:**
```json
{
  "conversation_id": "uuid",
  "message": "Para qual dia você gostaria de agendar?",
  "intent": "SCHEDULING",
  "agent": "scheduler",
  "confidence": 0.95
}
```

---

## 11. Dependências

| Dependência | Versão | Uso |
|-------------|--------|-----|
| MiniMax API | - | LLM (OpenAI-compatible) |
| PostgreSQL | 15+ | Queue + Dados |
| pgvector | 0.5+ | RAG embeddings |
| Next.js | 15+ | API routes |

---

## 12. Métricas e Monitoramento

| Métrica | Target |
|---------|--------|
| Latência total (mensagem → resposta) | < 3s (P90) |
| Taxa de DLQ | < 0.1% |
| Timeout rate | < 5% |
| Retry rate | < 10% |

---

**Aprovado por:** Walis
**Data:** 2026-04-07
