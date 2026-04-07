# Multi-Agent System Design Specification - Synkroo

**Versão:** 1.1
**Data:** 2026-04-07
**Status:** Aprovado
**Baseado em:** Brainstorming com Walis

---

## 1. Visão Geral

Sistema multi-agente para atendimento automatizado de clínica odontológica, utilizando arquitetura 4+1 com Orchestrator como coordenador central. Cada agente é especializado em uma função e se comunica via filas assíncronas.

**Canais Suportados:**
- Chat Widget (web)
- WhatsApp (via Evolution API)
- Instagram Direct Messages

**Stack:**
- LLM: MiniMax (OpenAI-compatible API)
- Queue: PostgreSQL com LISTEN/NOTIFY
- Memória: 5 camadas (L1-L5) com carregamento inteligente
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
│  • Receber mensagem de qualquer canal                           │
│  • Carregar contexto inteligente (L1-L5)                        │
│  • Coordenar fluxo entre agentes                                │
│  • Aggregar resposta final                                       │
│  • Timeout management (30s total)                               │
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
│ timeout: 5s│      │ timeout: 10s│      │ timeout: 10s│
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
  contextStrategy: CONTEXT_STRATEGY // Carregamento inteligente
}
```

**Fluxo:**
1. Recebe mensagem de qualquer canal (Widget/WhatsApp/Instagram)
2. Carrega contexto inteligente (L1-L5)
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
    'SCHEDULING',    // → Scheduler
    'BILLING',       // → Sales
    'REACTIVATION',  // → Sales
    'MEDICAL_INFO',  // → Generalist
    'GENERAL'        // → Generalist
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

## 3. Payload Entre Agentes

### 3.1 Estrutura do AgentPayload

```typescript
interface AgentPayload {
  // Identificação
  id: string
  conversationId: string
  clinicId: string
  visitorId: string
  channel: 'widget' | 'whatsapp' | 'instagram'

  // Mensagem Original
  originalMessage: string

  // Classificação (populado pelo Router)
  intent?: Intent
  entities?: Record<string, string>
  targetAgent?: 'scheduler' | 'sales' | 'generalist'

  // Contexto (carregado pelo Orchestrator)
  context: {
    // L1: Session (sempre)
    session?: L1Session

    // L2: Patient (lazy - só se patientId conhecido)
    patient?: L2Patient | null
    patientRequired?: boolean // Se true e patient null → escalar

    // L3: Clinic (sempre)
    clinic: L3Clinic

    // L4: Conversation (lazy - só se historyNeeded)
    conversation?: L4Conversation | null

    // L5: RAG (lazy - só se faqOrMedical)
    ragKnowledge?: L5Knowledge[]
  }

  // Response (populado pelo agente especializado)
  response?: {
    message: string
    confidence: number
    reasoning: string
  }

  // Metadata
  metadata: {
    patientRequired: boolean
    historyNeeded: boolean
    faqOrMedical: boolean
    timestamp: string
  }
}

type Intent = 'SCHEDULING' | 'BILLING' | 'REACTIVATION' | 'MEDICAL_INFO' | 'GENERAL'
```

### 3.2 Estratégia de Carregamento de Contexto

```typescript
const CONTEXT_STRATEGY = {
  // Layer 1: Session - Sempre carrega
  L1: {
    load: 'always',
    reason: 'Contexto da conversa atual é essencial'
  },

  // Layer 2: Patient - Só se patientId conhecido
  L2: {
    load: 'if_patient_known',
    reason: 'Evitar queries desnecessárias se paciente novo'
  },

  // Layer 3: Clinic - Sempre carrega
  L3: {
    load: 'always',
    reason: 'Configuração da clínica é necessária para todas as ações'
  },

  // Layer 4: Conversation - Só se conversa complexa
  L4: {
    load: 'if_history_needed',
    triggers: ['reschedule', 'cancel', 'reactivation'],
    reason: 'Reduzir latência para perguntas simples'
  },

  // Layer 5: RAG - Só se pergunta técnica/médica
  L5: {
    load: 'if_faq_or_medical',
    triggers: ['MEDICAL_INFO', 'GENERAL'],
    reason: 'RAG é caro computacionalmente'
  }
}
```

---

## 4. System Prompts por Agente

### 4.1 Router Agent

```typescript
const ROUTER_SYSTEM_PROMPT = `Você é o Router Agent do sistema Synkroo.

Sua função:
1. Classificar a intenção da mensagem em uma destas categorias:
   - SCHEDULING: Agendar, remarcar ou cancelar consultas
   - BILLING: Assuntos relacionados a pagamentos, orçamentos
   - REACTIVATION: Pacientes inativos, campanhas de retorno
   - MEDICAL_INFO: Perguntas sobre procedimentos, tratamentos
   - GENERAL: Perguntas gerais, saudações

2. Extrair entidades relevantes:
   - nome: Nome do paciente (se mencionado)
   - data: Data mentioned (se houver)
   - horario: Horário mencionado (se houver)
   - procedimento: Procedimento mencionado (se houver)

3. Decidir qual agente deve processar:
   - SCHEDULING → scheduler
   - BILLING, REACTIVATION → sales
   - MEDICAL_INFO, GENERAL → generalist

4. Determinar flags de contexto:
   - patientRequired: true se precisa de paciente válido para processar
   - historyNeeded: true se precisa de histórico de conversas
   - faqOrMedical: true se a pergunta requer conhecimento técnico

Responda APENAS com JSON válido:
{
  "intent": "SCHEDULING|BILLING|REACTIVATION|MEDICAL_INFO|GENERAL",
  "entities": {"nome": "...", "data": "...", "horario": "...", "procedimento": "..."},
  "targetAgent": "scheduler|sales|generalist",
  "patientRequired": true|false,
  "historyNeeded": true|false,
  "faqOrMedical": true|false,
  "confidence": 0.0-1.0
}

Não inclua texto adicional. Apenas JSON.`
```

### 4.2 Scheduler Agent

```typescript
const SCHEDULER_SYSTEM_PROMPT = `Você é o Scheduler Agent do sistema Synkroo.

Sua função: Processar todas as ações relacionadas a agendamentos.

Capabilities:
- check_availability: Verificar horários disponíveis
- book_appointment: Criar novo agendamento
- cancel_appointment: Cancelar agendamento existente
- reschedule_appointment: Remarcar para outro horário

Contexto disponível:
- patient: Dados do paciente (nome, telefone, histórico)
- clinic: Configurações da clínica (horários, profissionais)
- conversation: Histórico da conversa atual

Fluxo:
1. Analise a mensagem e determine a ação necessária
2. Use as ferramentas disponíveis para executar
3. Para bookings: Sempre confirme data, hora e profissional
4. Para cancelamentos: Aplique política de cancelamento da clínica
5. Para reagendamentos: Cancele o original e crie novo

Responda no formato:
{
  "action": "book|cancel|reschedule|check",
  "result": "descrição do resultado",
  "nextQuestion": "pergunta para continuar o fluxo (se necessário)",
  "confidence": 0.0-1.0
}`
```

### 4.3 Sales Agent

```typescript
const SALES_SYSTEM_PROMPT = `Você é o Sales Agent do sistema Synkroo.

Sua função: Processar ações de vendas, orçamentos e reativação de pacientes.

Capabilities:
- follow_up_quote: Acompanhamento de orçamentos pendentes
- reactivate_patient: Reativar pacientes inativos
- create_budget: Criar orçamento de procedimento
- send_promotion: Enviar promoções

Contexto disponível:
- patient: Dados do paciente (nome, histórico de procedimentos, última visita)
- clinic: Promoções ativas, procedimentos disponíveis

Técnicas de persuasão:
- Urgência: "Essa promoção é por tempo limitado!"
- Prova social: "90% dos pacientes fazem retorno"
- Reciprocidade: "Como você é paciente antigo..."
- Escassez: "Temos poucos horários disponíveis"

Responda no formato:
{
  "action": "quote|reactivation|promotion|followup",
  "result": "descrição do resultado",
  "nextQuestion": "pergunta para continuar (se necessário)",
  "confidence": 0.0-1.0
}`
```

### 4.4 Generalist Agent

```typescript
const GENERALIST_SYSTEM_PROMPT = `Você é o Generalist Agent do sistema Synkroo.

Sua função: Responder perguntas gerais, FAQs e fornecer informações da clínica.

Capabilities:
- answer_faq: Responder perguntas frequentes
- search_knowledge: Buscar no conhecimento da clínica
- provide_clinic_info: Informações sobre horários, localização, procedimentos

Contexto disponível:
- patient: Dados básicos do paciente (se conhecido)
- clinic: Informações da clínica (horários, endereço, procedimentos)
- ragKnowledge: Base de conhecimento técnico (se carregado)

Regras:
1. Se a pergunta for médica ou técnica, use o RAG knowledge
2. Se não souber a resposta, escalone para humano
3. Nunca forneça diagnóstico médico
4. Mantenha tom amigável e profissional

Responda no formato:
{
  "response": "sua resposta",
  "source": "faq|knowledge|clinic_info",
  "needsEscalation": true|false,
  "confidence": 0.0-1.0
}`
```

---

## 5. Sistema de Queue (PostgreSQL + LISTEN/NOTIFY)

### 5.1 Tabela Principal

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

### 5.2 Trigger para NOTIFY

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

### 5.3 Dead Letter Queue (DLQ)

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

### 5.4 Status Flow

```
pending → processing → done (sucesso)
                       ↓
                   failed (erro recoverable) → retry
                                      ↓
                                   DLQ (após 3 retries)
```

---

## 6. Retry com Backoff Exponencial

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

## 7. Sistema de Memória (5 Camadas)

### 7.1 Layer 1: Session (In-Memory)

```typescript
interface L1Session {
  sessionId: string
  visitorId: string
  messages: ChatMessage[]
  currentIntent?: Intent
  entities: Record<string, string>
  createdAt: Date
  expiresAt: Date // +30 min
}

// In-memory Map<string, L1Session>
// TTL: 30 minutos
```

### 7.2 Layer 2: Patient (PostgreSQL)

```typescript
interface L2Patient {
  patientId: string
  clinicId: string
  nome: string
  telefone: string
  email?: string
  cpf?: string
  preferencias: Record<string, unknown>
  historico: Appointment[]
  riskScore: number
  ultimaVisita?: Date
  inactiveDays: number // dias desde última visita
}
```

### 7.3 Layer 3: Clinic (PostgreSQL + Cache)

```typescript
interface L3Clinic {
  clinicId: string
  nome: string
  telefone: string
  endereco: string
  horarios: WorkingHours
  profissionais: Dentist[]
  procedimentos: Procedure[]
  configuracoes: ClinicSettings
  cancelamentoPolicy: {
    horasAntecedencia: number
    permiteOnline: boolean
  }
}
```

### 7.4 Layer 4: Conversation (PostgreSQL)

```typescript
interface L4Conversation {
  conversationId: string
  clinicId: string
  patientId?: string
  visitorId: string
  channel: 'widget' | 'whatsapp' | 'instagram'
  messages: Message[]
  status: 'active' | 'closed'
  createdAt: Date
  updatedAt: Date
}
// Retenção: 2 anos (LGPD)
```

### 7.5 Layer 5: RAG (pgvector)

```typescript
interface L5Knowledge {
  id: string
  clinicId: string
  category: 'protocolo' | 'faq' | 'procedimento' | 'orientacao' | 'politica'
  question: string
  answer: string
  embedding: vector(1536)
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}
```

---

## 8. Ferramentas (Tools)

### 8.1 Base Tools (Todos Agentes)

```typescript
const BASE_TOOLS = [
  'search_patient',      // Busca paciente por telefone/nome
  'get_clinic_info',    // Busca config da clínica
  'send_message',       // Envia mensagem (WhatsApp/Instagram/Widget)
  'log_decision',       // Registra decisão no log
]
```

### 8.2 Tools por Agente

```typescript
const AGENT_TOOLS = {
  router: [
    ...BASE_TOOLS,
    'classify_intent',      // Classifica intenção
    'extract_entities',      // Extrai entidades
  ],
  scheduler: [
    ...BASE_TOOLS,
    'check_availability',        // Verifica horários
    'book_appointment',        // Cria agendamento
    'cancel_appointment',      // Cancela agendamento
    'reschedule_appointment',  // Remarca
  ],
  sales: [
    ...BASE_TOOLS,
    'get_lead_info',          // Info do lead
    'create_budget',          // Cria orçamento
    'send_promotion',         // Envia promoção
  ],
  generalist: [
    ...BASE_TOOLS,
    'search_knowledge',        // Busca RAG
    'answer_faq',             // Responde FAQ
  ],
}
```

---

## 9. Logging e Explicabilidade

### 9.1 Estrutura de Log

```typescript
interface AgentDecisionLog {
  id: string
  timestamp: Date
  conversationId: string
  agent: 'orchestrator' | 'router' | 'scheduler' | 'sales' | 'generalist'
  action: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  reasoning: string
  confidence?: number
  duration_ms: number
  error?: string
}
```

### 9.2 Tabela de Log

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
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_decision_logs_conversation ON agent_decision_logs(conversation_id);
CREATE INDEX idx_decision_logs_agent ON agent_decision_logs(agent);
CREATE INDEX idx_decision_logs_created ON agent_decision_logs(created_at);
```

---

## 10. Fluxo de Mensagem Completo

```
1. Cliente envia mensagem (Widget/WhatsApp/Instagram)
   → POST /api/agent/messages

2. Orchestrator:
   a. Recebe mensagem + canal
   b. Identifica visitorId
   c. Carrega contexto inteligente (L1 sempre, L2-L5 baseado em flags)
   d. Monta AgentPayload
   e. Cria queue message → 'router'
   f. INSERT + NOTIFY

3. Router (LISTEN):
   a. Consome mensagem
   b. Executa classify_intent() + extract_entities()
   c. Popula intent, entities, targetAgent no payload
   d. Atualiza flags (patientRequired, historyNeeded, faqOrMedical)
   e. Cria queue message → 'scheduler' | 'sales' | 'generalist'
   f. INSERT + NOTIFY

4. Agente Especializado (LISTEN):
   a. Consome mensagem
   b. Se patientRequired=true e patient=null → escalation
   c. Carrega ferramentas específicas
   d. Executa ação
   e. Popula response no payload
   f. Cria queue message → 'orchestrator'
   g. INSERT + NOTIFY 'task_done'

5. Generalist (fallback):
   a. Se needsEscalation=true → notifica humano
   b. Caso contrário → executa search_knowledge() / answer_faq()

6. Orchestrator (LISTEN):
   a. Recebe task_done notification
   b. Aggrega resposta
   c. Envia para canal original
   d. Retorna para cliente

7. Timeout Handling:
   - Se nenhuma resposta em 30s → retorna erro
   - Se patientRequired=true e patient=null → escalona
   - Se agente falha 3x → DLQ
```

---

## 11. Estrutura de Arquivos

```
src/
├── services/
│   ├── agents/
│   │   ├── base.agent.ts              # Classe abstrata comum
│   │   ├── orchestrator.agent.ts      # Coordenador
│   │   ├── router.agent.ts           # Classificação
│   │   ├── scheduler.agent.ts         # Agendamentos
│   │   ├── sales.agent.ts            # Vendas
│   │   ├── generalist.agent.ts       # Fallback
│   │   └── prompts/
│   │       ├── router.prompt.ts      # System prompt
│   │       ├── scheduler.prompt.ts   # System prompt
│   │       ├── sales.prompt.ts        # System prompt
│   │       └── generalist.prompt.ts   # System prompt
│   ├── queue/
│   │   ├── queue.service.ts          # INSERT/NOTIFY/LISTEN
│   │   ├── dlq.service.ts           # Dead Letter Queue
│   │   └── agent-queue.repo.ts      # Repository pattern
│   ├── memory/
│   │   ├── L1-session.ts            # In-memory
│   │   ├── L2-patient.ts            # PostgreSQL
│   │   ├── L3-clinic.ts             # PostgreSQL + Cache
│   │   ├── L4-conversation.ts        # PostgreSQL
│   │   └── L5-rag.ts              # pgvector
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
│               └── route.ts          # Entry point (multi-canal)
└── lib/
    └── llm/
        ├── provider.ts               # Interface
        ├── minimax.provider.ts      # MiniMax impl
        └── factory.ts              # Factory
```

---

## 12. API de Entrada

### POST /api/agent/messages

**Request:**
```json
{
  "clinic_id": "uuid",
  "visitor_id": "string",
  "message": "Quero agendar uma consulta",
  "conversation_id": "uuid (opcional)",
  "channel": "widget|whatsapp|instagram"
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

### Error Response (timeout/escalation):

```json
{
  "error": "timeout|escalation|error",
  "message": "Descrição do erro",
  "conversation_id": "uuid"
}
```

---

## 13. Dependências

| Dependência | Versão | Uso |
|-------------|--------|-----|
| MiniMax API | - | LLM (OpenAI-compatible) |
| PostgreSQL | 15+ | Queue + Dados |
| pgvector | 0.5+ | RAG embeddings |
| Next.js | 15+ | API routes |

---

## 14. Métricas e Monitoramento

| Métrica | Target |
|---------|--------|
| Latência total (mensagem → resposta) | < 3s (P90) |
| Taxa de DLQ | < 0.1% |
| Timeout rate | < 5% |
| Retry rate | < 10% |
| Escalation rate (patientRequired + null) | < 5% |

---

## 15. Version History

| Versão | Data | Mudanças |
|---------|------|----------|
| 1.0 | 2026-04-07 | Versão inicial |
| 1.1 | 2026-04-07 | Adicionado: AgentPayload, System Prompts, Smart Context Loading, Multi-channel |

---

**Aprovado por:** Walis
**Data:** 2026-04-07
