# Agent IA Design Specification - Synkroo

**Versão:** 2.0
**Data:** 2026-03-25
**Status:** Aprovado
**Baseado em:** Brainstorming Session com Walis

---

## Executive Summary

O Agente IA do Synkroo é um sistema multi-agente autônomo que conversa, entende contexto e **executa tarefas**. Diferente de chatbots tradicionais, o agente não apenas responde — ele agenda, cancela, reativa pacientes, envia lembretes e toma decisões inteligentes baseadas em contexto.

**Diferenciais Chave:**
- Arquitetura 4+1 com ativação lazy de especialistas
- 5 camadas de memória com cache L1/L2
- Sistema de ações com níveis de risco e rollback
- Personalidade adaptativa com templates predefinidos
- Autonomia transparente com explicabilidade total

---

## 1. Arquitetura Multi-Agente (4+1)

### 1.1 Visão Geral

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR AGENT                               │
│                    (Coordenador Central - Sempre Ativo)                  │
│                                                                          │
│  Responsabilidades:                                                      │
│  • Receber todas as mensagens                                            │
│  • Manter contexto da conversa                                           │
│  • Coordenar memória                                                     │
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
                              │ • Casos simples   │
                              └───────────────────┘
```

### 1.2 Especificações dos Agentes

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

  output: {
    intent: string,
    confidence: number,
    entities: Record<string, any>,
    suggestedAgent: string
  };
}
```

#### Scheduler Agent (Lazy Activation)

```typescript
interface SchedulerConfig {
  id: "scheduler";
  model: "claude-sonnet-4-20250514";
  activation: "LAZY";  // Only when Router confidence < 0.8 for scheduling

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
    "urgency",           // "Essa vaga é muito procurada!"
    "social_proof",      // "90% dos pacientes fazem retorno"
    "reciprocity",       // "Como você é paciente antiga..."
    "scarcity"           // "Só temos 2 horários essa semana"
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

  escalationTriggers: [
    "medical_diagnosis_request",
    "treatment_recommendation",
    "emergency_symptoms",
    "complex_medical_question"
  ];
}
```

### 1.3 Fluxo de Processamento de Mensagens

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MESSAGE PROCESSING FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. RECEPÇÃO                                                             │
│     ├── Mensagem chega via WhatsApp/Instagram/Chat                      │
│     └── Orchestrator recebe e inicia sessão                             │
│                                                                          │
│  2. MEMORY RETRIEVAL (Early Exit Pattern)                               │
│     ├── L1: Cache hit? → <5ms → Usa contexto                           │
│     ├── L2: Patient ID known? → <50ms → Carrega perfil                 │
│     ├── L3: Clinic config needed? → <50ms → Carrega settings           │
│     ├── L4: Need history? → <100ms → Busca conversas                   │
│     └── L5: Need knowledge? → <150ms → RAG search                      │
│                                                                          │
│  3. ROUTING                                                              │
│     ├── Router classifica intenção (confidence score)                   │
│     ├── Confidence >= 0.8 → Router resolve                             │
│     ├── Confidence 0.5-0.8 → Delega para especialista                  │
│     └── Confidence < 0.5 → Escala para humano                           │
│                                                                          │
│  4. EXECUTION                                                            │
│     ├── Especialista processa com contexto carregado                    │
│     ├── Avalia risco da ação (LOW/MEDIUM/HIGH)                         │
│     ├── Executa ou solicita confirmação                                 │
│     └── Registra decisão no log                                         │
│                                                                          │
│  5. RESPONSE                                                             │
│     ├── Orchestrator consolida resposta                                 │
│     ├── Aplica personalidade da clínica                                 │
│     ├── Envia mensagem                                                   │
│     └── Atualiza memória (L1, L2, L4)                                   │
│                                                                          │
│  TOTAL LATENCY TARGET: <3000ms                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Algoritmo de Cálculo de Confidence Score

```typescript
interface ConfidenceScoreResult {
  score: number;        // 0.0 - 1.0
  factors: ConfidenceFactor[];
  recommendation: "resolve" | "delegate" | "escalate";
}

interface ConfidenceFactor {
  name: string;
  weight: number;       // 0.0 - 1.0
  value: number;        // 0.0 - 1.0
  contribution: number; // weight * value
}

function calculateConfidenceScore(
  message: string,
  context: ConversationContext,
  clinicConfig: ClinicConfig
): ConfidenceScoreResult {

  const factors: ConfidenceFactor[] = [
    // Fator 1: Clareza da Intenção (peso 30%)
    {
      name: "intent_clarity",
      weight: 0.30,
      value: classifyIntentClarity(message),
      // Alta: "quero agendar" (0.9)
      // Média: "preciso de ajuda" (0.5)
      // Baixa: mensagem ambígua (0.2)
    },

    // Fator 2: Histórico do Paciente (peso 25%)
    {
      name: "patient_context",
      weight: 0.25,
      value: context.hasHistory ? 0.9 : 0.4,
      // Se paciente conhecido e tem histórico: 0.9
      // Se paciente novo: 0.4
    },

    // Fator 3: Complexidade da Tarefa (peso 25%)
    {
      name: "task_complexity",
      weight: 0.25,
      value: 1 - estimateTaskComplexity(message),
      // Tarefa simples (FAQ): complexidade baixa → valor alto
      // Tarefa complexa (reagendamento múltiplo): valor baixo
    },

    // Fator 4: Disponibilidade de Conhecimento (peso 20%)
    {
      name: "knowledge_availability",
      weight: 0.20,
      value: checkKnowledgeBase(message, clinicConfig),
      // Resposta no RAG: 0.9
      // Resposta parcial: 0.5
      // Sem resposta: 0.1
    }
  ];

  // Calcular score ponderado
  const score = factors.reduce(
    (sum, f) => sum + (f.weight * f.value),
    0
  );

  // Determinar recomendação
  let recommendation: "resolve" | "delegate" | "escalate";
  if (score >= 0.8) recommendation = "resolve";
  else if (score >= 0.5) recommendation = "delegate";
  else recommendation = "escalate";

  return { score, factors, recommendation };
}

// Exemplos de scoring:
//
// Caso 1: "Quero agendar uma limpeza"
// - intent_clarity: 0.95 (intenção clara)
// - patient_context: 0.90 (paciente conhecido)
// - task_complexity: 0.85 (tarefa simples)
// - knowledge_availability: 0.90 (procedimento conhecido)
// → Score: 0.90 → resolve
//
// Caso 2: "Não sei o que fazer"
// - intent_clarity: 0.20 (intenção ambígua)
// - patient_context: 0.40 (paciente novo)
// - task_complexity: 0.50 (incerto)
// - knowledge_availability: 0.30 (precisa mais info)
// → Score: 0.33 → escalate
//
// Caso 3: "Quero remarcar minha consulta de amanhã"
// - intent_clarity: 0.85 (intenção clara)
// - patient_context: 0.90 (paciente conhecido com consulta)
// - task_complexity: 0.70 (tarefa média)
// - knowledge_availability: 0.80 (contexto disponível)
// → Score: 0.81 → resolve
```

---

## 2. Especificações dos Agentes

### 2.1 Arquitetura de Memória

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MEMORY ARCHITECTURE (5 LAYERS)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 1: SESSION MEMORY (Redis - L1 Cache)                     │    │
│  │                                                                  │    │
│  │  • TTL: 24 horas                                                │    │
│  │  • Uso: Conversa ativa, contexto imediato                       │    │
│  │  • Estrutura: {session_id, last_20_messages, current_intent}    │    │
│  │  • Acesso: <5ms                                                 │    │
│  │  • Priority Queue: Mensagens recentes primeiro                  │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 2: PATIENT MEMORY (PostgreSQL - L2 Cache)               │    │
│  │                                                                  │    │
│  │  • TTL: Permanente                                              │    │
│  │  • Uso: Perfil do paciente, histórico, preferências             │    │
│  │  • Estrutura: patients, patient_risk_scores                    │    │
│  │  • Acesso: <50ms                                                │    │
│  │  • Campos: nome, telefone, última consulta, tratamentos, NPS    │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 3: CLINIC MEMORY (PostgreSQL)                            │    │
│  │                                                                  │    │
│  │  • TTL: Permanente                                              │    │
│  │  • Uso: Configurações da clínica, horários, profissionais       │    │
│  │  • Estrutura: clinics, dentists, clinic_settings               │    │
│  │  • Acesso: <50ms                                                │    │
│  │  • Inclui: branding, personalidade do agente, políticas         │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 4: CONVERSATIONAL MEMORY (PostgreSQL + pgvector)        │    │
│  │                                                                  │    │
│  │  • TTL: 2 anos (LGPD compliance)                                │    │
│  │  • Uso: Histórico de todas conversas                            │    │
│  │  • Estrutura: conversations (particionada), messages            │    │
│  │  • Acesso: <100ms (busca semântica)                            │    │
│  │  • Busca: HNSW para similaridade semântica                      │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 5: EPISODIC MEMORY (PostgreSQL + pgvector + RAG)        │    │
│  │                                                                  │    │
│  │  • TTL: Permanente                                              │    │
│  │  • Uso: Eventos importantes, lições aprendidas, padrões         │    │
│  │  • Estrutura: knowledge_base, episodic_events                   │    │
│  │  • Acesso: <150ms (HNSW search)                                │    │
│  │  • Contém: Protocolos, FAQs, orientações, casos especiais       │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Fluxo de Recuperação de Memória

```typescript
interface MemoryRetrievalFlow {
  // 1. Chegou mensagem → L1 Cache primeiro
  step1: {
    source: "L1_SESSION",
    action: "get_last_20_messages",
    latency: "<5ms",
    fallback: "L2 if miss"
  };

  // 2. Precisa contexto do paciente → L2
  step2: {
    source: "L2_PATIENT",
    action: "get_patient_profile",
    latency: "<50ms",
    trigger: "patient_id in message"
  };

  // 3. Precisa info da clínica → L3
  step3: {
    source: "L3_CLINIC",
    action: "get_clinic_config",
    latency: "<50ms",
    trigger: "always (for personality)"
  };

  // 4. Precisa histórico relevante → L4
  step4: {
    source: "L4_CONVERSATIONAL",
    action: "semantic_search_similar",
    latency: "<100ms",
    trigger: "complex query"
  };

  // 5. Precisa conhecimento especializado → L5
  step5: {
    source: "L5_EPISODIC",
    action: "rag_search",
    latency: "<150ms",
    trigger: "medical question or procedure info"
  };
}
```

### 2.3 Priority Queue para Contexto

```typescript
interface ContextPriorityQueue {
  // Alta prioridade (sempre incluir)
  high: [
    "ultima_mensagem_paciente",
    "intenção_atual",
    "dados_paciente_ativo"
  ];

  // Média prioridade (incluir se couber)
  medium: [
    "últimas_5_mensagens",
    "agendamentos_pendentes",
    "configuração_clínica"
  ];

  // Baixa prioridade (incluir se relevante)
  low: [
    "histórico_semântico",
    "conhecimento_rag",
    "métricas_paciente"
  ];

  // Early exit quando contexto suficiente
  earlyExit: {
    minContextSize: 3,
    maxContextSize: 20,
    exitWhenConfidence: 0.9
  };
}
```

---

## 3. Personalidade Adaptativa

### 3.1 Templates de Personalidade

```typescript
interface PersonalityTemplate {
  id: string;
  name: string;
  description: string;

  // Campos personalizáveis
  config: {
    agentName: string;           // Nome do agente
    tone: "formal" | "informal" | "casual" | "professional";
    useEmojis: boolean;          // Usar emojis?
    greeting: string;            // Saudação inicial
    signature: string;           // Assinatura final
    vocabulary: string[];        // Vocabulário preferido
    brandVoice: string;          // Descrição da voz da marca
  };

  // Adaptatividade
  adaptation: {
    detectPatientTone: boolean;  // Detectar tom do paciente?
    adaptToPatient: boolean;     // Adaptar ao tom do paciente?
    maintainBrandVoice: boolean; // Manter voz da marca?
  };
}
```

### 3.2 Templates Predefinidos

#### Odonto Formal

```typescript
const odontoFormalTemplate: PersonalityTemplate = {
  id: "odonto-formal",
  name: "Odonto Formal",
  description: "Ideal para clínicas odontológicas tradicionais",

  config: {
    agentName: "Assistente Virtual",
    tone: "formal",
    useEmojis: false,
    greeting: "Olá, seja bem-vindo à {clinic_name}. Como posso ajudá-lo?",
    signature: "Atenciosamente, {clinic_name}",
    vocabulary: ["Senhor", "Senhora", "Doutor", "Consulta", "Procedimento"],
    brandVoice: "Profissional, educado, confiável, médico"
  },

  adaptation: {
    detectPatientTone: true,
    adaptToPatient: false,
    maintainBrandVoice: true
  }
};
```

#### Estética Acolhedora

```typescript
const esteticaAcolhedoraTemplate: PersonalityTemplate = {
  id: "estetica-acolhedora",
  name: "Estética Acolhedora",
  description: "Ideal para clínicas de estética e bem-estar",

  config: {
    agentName: "Bia",
    tone: "informal",
    useEmojis: true,
    greeting: "Oiê! Tudo bem? 😊 Sou a Bia da {clinic_name}!",
    signature: "Beijos, Bia 💕",
    vocabulary: ["Amor", "Querida", "Linda", "Treatment", "Sessão"],
    brandVoice: "Acolhedor, caloroso, feminino, amigável"
  },

  adaptation: {
    detectPatientTone: true,
    adaptToPatient: true,
    maintainBrandVoice: false
  }
};
```

#### Fisio Prática

```typescript
const fisioPraticaTemplate: PersonalityTemplate = {
  id: "fisio-pratica",
  name: "Fisio Prática",
  description: "Ideal para clínicas de fisioterapia",

  config: {
    agentName: "Atendente",
    tone: "professional",
    useEmojis: false,
    greeting: "Olá! {clinic_name}. Posso ajudar?",
    signature: "{clinic_name}",
    vocabulary: ["Sessão", "Tratamento", "Avaliação", "Profissional"],
    brandVoice: "Prático, direto, eficiente, técnico"
  },

  adaptation: {
    detectPatientTone: true,
    adaptToPatient: false,
    maintainBrandVoice: true
  }
};
```

#### Custom

```typescript
const customTemplate: PersonalityTemplate = {
  id: "custom",
  name: "Personalizado",
  description: "Configuração totalmente customizada pela clínica",

  config: {
    agentName: "",  // Definido pela clínica
    tone: "informal",  // Selecionável
    useEmojis: true,   // Selecionável
    greeting: "",      // Definido pela clínica
    signature: "",     // Definido pela clínica
    vocabulary: [],    // Definido pela clínica
    brandVoice: ""     // Definido pela clínica
  },

  adaptation: {
    detectPatientTone: true,
    adaptToPatient: true,
    maintainBrandVoice: true
  }
};
```

### 3.3 Exemplos de Adaptação

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CENÁRIO: Paciente informal com template Odonto Formal                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Paciente: "Oiê! Quero marcar um dentinho pra fazer limpeza né?"        │
│                                                                          │
│  Agente (mantém formalidade):                                           │
│  "Olá! Seja bem-vindo à Clínica Sorriso.                                │
│   Para agendar sua limpeza, qual dia da semana você prefere?"           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  CENÁRIO: Paciente formal com template Estética Acolhedora              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Paciente: "Gostaria de informações sobre o procedimento de limpeza."   │
│                                                                          │
│  Agente (adapta para mais formal):                                      │
│  "Claro! Ficarei feliz em ajudar. 😊                                    │
│   Nossa limpeza de pele profunda dura 1h e custa R$ 180.                │
│   Posso enviar mais detalhes?"                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Sistema de Ações

### 4.1 Níveis de Risco

```typescript
interface ActionRiskLevels {
  LOW: {
    riskScore: [0, 30];
    actions: [
      "check_availability",
      "send_reminder",
      "search_patient",
      "answer_faq"
    ];
    confirmation: "NONE";
    autoExecute: true;
    notifyClinic: false;
  };

  MEDIUM: {
    riskScore: [31, 60];
    actions: [
      "book_appointment",
      "reschedule_appointment",
      "send_follow_up",
      "add_to_waitlist"
    ];
    confirmation: "SIMPLE";  // "Confirma agendamento para quinta?"
    autoExecute: false;
    notifyClinic: false;
  };

  HIGH: {
    riskScore: [61, 100];
    actions: [
      "cancel_appointment",
      "reactivate_patient",
      "send_promotion",
      "collect_payment_info"
    ];
    confirmation: "DOUBLE";  // "Tem certeza que deseja cancelar? (SIM/NÃO)"
    autoExecute: false;
    notifyClinic: true;      // Notificar clínica
  };
}
```

### 4.2 Fluxo de Confirmação

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ACTION CONFIRMATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  AÇÃO: book_appointment (MEDIUM RISK)                                   │
│                                                                          │
│  1. Agente propõe: "Tenho quinta às 14h. Quer agendar?"                 │
│     │                                                                    │
│     ▼                                                                    │
│  2. Paciente: "Sim"                                                      │
│     │                                                                    │
│     ▼                                                                    │
│  3. Agente executa: book_appointment()                                   │
│     │                                                                    │
│     ├── Salva ação em: pending_actions (5 min TTL)                      │
│     │                                                                    │
│     └── Retorna: "✅ Agendado! Quinta 14h com Dr. Roberto."            │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  AÇÃO: cancel_appointment (HIGH RISK)                                   │
│                                                                          │
│  1. Paciente: "Quero cancelar minha consulta"                           │
│     │                                                                    │
│     ▼                                                                    │
│  2. Agente: "Você tem consulta amanhã às 10h.                          │
│             Tem certeza que deseja cancelar? (SIM/NÃO)"                 │
│     │                                                                    │
│     ▼                                                                    │
│  3. Paciente: "SIM"                                                      │
│     │                                                                    │
│     ▼                                                                    │
│  4. Agente: "Confirmar cancelamento?                                    │
│             A vaga será liberada para outros pacientes.                 │
│             Digite CONFIRMAR para prosseguir."                          │
│     │                                                                    │
│     ▼                                                                    │
│  5. Paciente: "CONFIRMAR"                                                │
│     │                                                                    │
│     ▼                                                                    │
│  6. Agente executa: cancel_appointment()                                 │
│     │                                                                    │
│     ├── Salva ação em: pending_actions (5 min TTL)                      │
│     ├── Notifica clínica via dashboard                                   │
│     │                                                                    │
│     └── Retorna: "✅ Consulta cancelada.                                │
│                   Posso ajudar a remarcar quando quiser."               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Undo/Rollback (5 minutos)

```typescript
interface ActionRollback {
  enabled: true;
  windowMinutes: 5;

  // Ações reversíveis
  reversibleActions: [
    "book_appointment",      // → cancel_appointment
    "cancel_appointment",    // → restore_appointment
    "reschedule_appointment" // → revert_reschedule
  ];

  // Como funciona
  flow: {
    step1: "Ação executada → salva em pending_actions com TTL 5min",
    step2: "Paciente: 'Desfazer' ou 'Espere, não era isso'",
    step3: "Agente verifica TTL → se dentro da janela, reverte",
    step4: "Notifica paciente: 'Ação desfeita!'",
    step5: "Após 5min → ação permanente, registro removido"
  };

  // Exemplo
  example: {
    patient: "Quero agendar para quinta às 14h",
    agent: "✅ Agendado!",
    patient: "Espera, na verdade sexta é melhor",
    agent: "Sem problema! Vou remarcar para sexta. 🔧 Pronto!",
    note: "Dentro da janela de 5min, agente pode ajustar"
  };
}
```

### 4.4 Rate Limiting

```typescript
interface RateLimiting {
  // Por paciente
  perPatient: {
    maxActionsPerMinute: 5,
    maxAppointmentsPerDay: 20,
    cooldownAfterCancel: "30 minutes"
  };

  // Por clínica
  perClinic: {
    maxConversationsPerMinute: 100,
    maxMessagesPerHour: 5000
  };

  // Proteção contra abuso
  abuseProtection: {
    repeatedCancels: {
      threshold: 3,
      window: "24 hours",
      action: "escalate_to_human"
    },
    spamMessages: {
      threshold: 10,
      window: "1 minute",
      action: "rate_limit_5min"
    }
  };
}
```

### 4.5 Error Handling Architecture

```typescript
interface ErrorHandlingConfig {
  // Retry Strategy
  retry: {
    maxAttempts: 3;
    backoffStrategy: "exponential";  // 1s, 2s, 4s
    retryableErrors: [
      "MCP_TIMEOUT",
      "MCP_CONNECTION_ERROR",
      "DATABASE_TEMP_UNAVAILABLE",
      "RATE_LIMIT_EXCEEDED"
    ];
  };

  // Fallback Behavior
  fallback: {
    onRouterFailure: "generalist",     // Fallback to generalist
    onSchedulerFailure: "human_escalation",
    onSalesFailure: "generalist",
    onMCPFailure: "cached_response",   // Use cached data if available
  };

  // Circuit Breaker (per MCP server)
  circuitBreaker: {
    failureThreshold: 5;      // Open after 5 failures
    resetAfter: "60s";        // Try again after 60s
    halfOpenRequests: 1;      // Test with 1 request
  };

  // Graceful Degradation
  degradation: {
    withoutCalendar: "Informa que não pode agendar agora, pede para ligar",
    withoutPatientDB: "Pede dados ao paciente, explica situação",
    withoutKnowledge: "Informa limitação, oferece conectar humano",
    withoutWhatsApp: "Queue messages, retry when back"
  };
}

// Error Recovery Flow
interface ErrorRecoveryFlow {
  // Quando MCP server falha
  mcpFailure: {
    step1: "Log error with context";
    step2: "Check circuit breaker state";
    step3: "Attempt retry with backoff";
    step4: "If max retries: activate fallback";
    step5: "Notify monitoring system";
    step6: "Queue for retry when service restored";
  };

  // Quando ação falha
  actionFailure: {
    step1: "Log error with action details";
    step2: "Notify patient of issue";
    step3: "Offer alternative (human, later retry)";
    step4: "Update error metrics";
    step5: "Store for error learning";
  };

  // Quando classificação falha
  classificationFailure: {
    step1: "Default to generalist agent";
    step2: "Ask clarification question";
    step3: "Use context clues to narrow intent";
    step4: "If still unclear: escalate to human";
  };
}

// Error Response Templates
const errorResponses = {
  mcp_unavailable: "Desculpe, estou com dificuldades técnicas. " +
                   "Pode tentar novamente em alguns minutos ou ligar para {phone}?",

  action_failed: "Tive um problema ao processar sua solicitação. " +
                 "Vou notificar a equipe. Posso ajudar com algo mais?",

  unknown_error: "Ops, algo inesperado aconteceu. " +
                 "Nossa equipe foi avisada. Pode repetir sua mensagem?"
};
```

---

## 5. Smart Triggers

### 5.1 Triggers Autônomos

```typescript
interface SmartTriggers {
  // Lembretes automáticos
  reminders: {
    "24h_before": {
      trigger: "appointment.datetime - 24h",
      action: "send_reminder",
      message: "Oi {name}! Amanhã você tem consulta às {time}. Confirma?",
      priority: 1
    },
    "2h_before": {
      trigger: "appointment.datetime - 2h",
      action: "send_reminder",
      message: "Te esperamos em 2h! 📍 {address}",
      priority: 1
    }
  };

  // Follow-up pós-consulta
  followUp: {
    "1d_after": {
      trigger: "appointment.completed + 1 day",
      action: "send_follow_up",
      message: "Oi {name}! Como está se sentindo após o procedimento?",
      priority: 2
    },
    "7d_after": {
      trigger: "appointment.completed + 7 days",
      action: "send_satisfaction_survey",
      message: "Como foi sua experiência? Avalie de 1 a 5 ⭐",
      priority: 3
    }
  };

  // Reativação de inativos
  reactivation: {
    "30d_inactive": {
      trigger: "patient.last_visit + 30 days",
      action: "check_recall_schedule",
      priority: 4
    },
    "90d_inactive": {
      trigger: "patient.last_visit + 90 days",
      action: "send_reactivation_message",
      message: "Faz tempo que não vemos você! Como estão seus dentes?",
      priority: 5
    }
  };

  // No-show recovery
  noShowRecovery: {
    "1h_after_missed": {
      trigger: "appointment.status = 'no_show' + 1h",
      action: "send_recovery_message",
      message: "Oi {name}, senti sua falta hoje! Quer remarcar?",
      priority: 1
    }
  };
}
```

### 5.2 Priorização de Triggers

```typescript
interface TriggerPrioritization {
  // Regras de prioridade
  priorityRules: [
    { trigger: "24h_reminder", priority: 1, weight: 100 },
    { trigger: "2h_reminder", priority: 1, weight: 100 },
    { trigger: "no_show_recovery", priority: 1, weight: 90 },
    { trigger: "reactivation_90d", priority: 5, weight: 30 },
    { trigger: "marketing_campaign", priority: 10, weight: 10 }
  ];

  // Cooldown entre triggers
  cooldown: {
    samePatient: "2 hours",    // Mínimo entre mensagens
    sameType: "24 hours",      // Mínimo entre mesmo tipo
    marketing: "7 days"        // Mínimo entre marketing
  };

  // Merge de triggers
  merging: {
    enabled: true,
    example: {
      situation: "Paciente tem consulta amanhã E está inativo há 90 dias",
      mergedMessage: "Oi {name}! Amanhã você tem consulta às 14h. Confirma? Também faz um tempinho que não vemos você - depois da consulta podemos agendar seu retorno? 😊"
    }
  };
}
```

---

## 6. Sistema de Conhecimento

### 6.1 RAG com Versionamento

```typescript
interface KnowledgeSystem {
  // Fontes de conhecimento
  sources: [
    "protocolos_medicos",     // PDFs, DOCX
    "tabela_precos",          // Planilhas
    "faqs",                   // Texto estruturado
    "orientacoes_pos",        // Documentos
    "politicas_clinica",      // Configurações
    "scripts_atendimento"     // Texto
  ];

  // Processamento
  ingestion: {
    chunking: {
      size: 512,              // tokens por chunk
      overlap: 50             // tokens de overlap
    },
    embedding: {
      model: "text-embedding-3-small",
      dimensions: 1536
    },
    storage: "knowledge_base table with pgvector"
  };

  // Busca híbrida
  retrieval: {
    vector: {
      enabled: true,
      index: "HNSW",
      topK: 20
    },
    keyword: {
      enabled: true,
      method: "BM25",
      topK: 20
    },
    fusion: {
      method: "RRF",          // Reciprocal Rank Fusion
      rerank: false           // Opcional com Cohere
    }
  };
}
```

### 6.2 Versionamento e Validação

```typescript
interface KnowledgeVersioning {
  // Versionamento
  versioning: {
    enabled: true,
    retention: 10,            // Manter últimas 10 versões
    rollbackEnabled: true,
    diffView: true
  };

  // Validação antes de publicar
  validation: {
    required: true,
    checks: [
      "format_validation",    // Estrutura correta
      "content_validation",   // Conteúdo apropriado
      "embedding_test",       // Embedding gerou corretamente
      "retrieval_test"        // Busca funciona
    ],
    previewBeforePublish: true
  };

  // Gap detection
  gapDetection: {
    enabled: true,
    method: "analyze_unanswered_questions",
    dashboard: true,          // Mostrar gaps no dashboard
    alertThreshold: 5         // Alertar após 5 perguntas sem resposta
  };

  // Exemplo de uso
  flow: {
    step1: "Clínica faz upload de novo protocolo",
    step2: "Sistema valida formato e conteúdo",
    step3: "Sistema gera embeddings e testa busca",
    step4: "Preview mostra como ficará",
    step5: "Clínica aprova → versão publicada",
    step6: "Versão anterior mantida para rollback"
  };
}
```

---

## 7. Autonomia e Explicabilidade

### 7.1 Níveis de Autonomia

```typescript
interface AutonomyLevels {
  // Thresholds numéricos para decisões
  thresholds: {
    autoExecute: {
      min: 0,
      max: 30,              // Risk score 0-30 → auto-execute
      description: "Ações de baixo risco executadas automaticamente"
    },
    confirmationRequired: {
      min: 31,
      max: 60,              // Risk score 31-60 → confirmação simples
      description: "Ações de médio risco requerem confirmação"
    },
    doubleConfirmation: {
      min: 61,
      max: 100,             // Risk score 61-100 → dupla confirmação
      description: "Ações de alto risco requerem dupla confirmação"
    },
    escalateToHuman: {
      threshold: 0.5,       // Confidence < 0.5
      description: "Escalar para humano quando não confiante"
    }
  };

  // Exemplos de decisão
  examples: [
    {
      situation: "Paciente pede horário disponível",
      action: "check_availability",
      riskScore: 10,
      decision: "AUTO-EXECUTE",
      reasoning: "Ação informativa, sem modificação de dados"
    },
    {
      situation: "Paciente quer agendar consulta",
      action: "book_appointment",
      riskScore: 45,
      decision: "CONFIRMATION_REQUIRED",
      reasoning: "Modifica agenda, requer confirmação do paciente"
    },
    {
      situation: "Paciente quer cancelar consulta",
      action: "cancel_appointment",
      riskScore: 75,
      decision: "DOUBLE_CONFIRMATION",
      reasoning: "Alto impacto, pode ser arrependimento"
    },
    {
      situation: "Paciente pergunta sobre tratamento",
      action: "answer_medical_question",
      riskScore: 55,
      decision: "ESCALATE_TO_HUMAN",
      reasoning: "Pergunta médica complexa, não diagnosticar"
    }
  ];
}
```

### 7.2 Explainability

```typescript
interface ExplainabilitySystem {
  // Log de todas as decisões
  decisionLogging: {
    enabled: true,
    storage: "decision_logs table",
    retention: "2 years",

    fields: [
      "timestamp",
      "conversation_id",
      "patient_id",
      "intent_classified",
      "confidence_score",
      "action_taken",
      "risk_level",
      "reasoning",
      "human_override"
    ]
  };

  // Explicação para o paciente
  patientExplainability: {
    enabled: true,
    triggers: [
      "patient_asks_why",
      "patient_seems_confused",
      "action_with_impact"
    ],

    responses: {
      why_action: "Vou agendar sua consulta para quinta às 14h. Isso funciona para você?",
      why_question: "Preciso confirmar alguns dados para garantir que tudo correto.",
      why_escalate: "Essa pergunta é melhor respondida pelo Dr. Roberto. Posso transferir?"
    }
  };

  // Explicação para a clínica
  clinicExplainability: {
    dashboard: true,
    logs: true,

    example: {
      scenario: "Agente cancelou consulta automaticamente",
      log: {
        timestamp: "2026-03-25 14:32:00",
        patient: "Maria Silva",
        action: "cancel_appointment",
        reasoning: "Paciente confirmou cancelamento com dupla confirmação",
        confidence: 0.95,
        riskLevel: "HIGH",
        confirmationReceived: true,
        humanOverride: false
      }
    }
  };
}
```

### 7.3 Override e Error Learning

```typescript
interface OverrideSystem {
  // Override pelo paciente
  patientOverride: {
    triggers: [
      "pare",
      "espera",
      "não era isso",
      "quero falar com alguém",
      "desfazer"
    ],
    action: "pause_agent_and_escalate"
  };

  // Override pela clínica
  clinicOverride: {
    dashboard: true,
    realTime: true,
    actions: [
      "pause_agent",
      "take_over_conversation",
      "modify_last_action",
      "blacklist_action"
    ]
  };

  // Learning de erros
  errorLearning: {
    enabled: true,

    feedbackLoop: {
      step1: "Ação executada incorretamente",
      step2: "Clínica ou paciente corrige",
      step3: "Sistema registra erro",
      step4: "Embedding do erro é gerado",
      step5: "Sistema ajusta para situações similares",
      step6: "Padrão aprendido é armazenado"
    },

    storage: {
      table: "error_patterns",
      fields: ["error_type", "context", "correction", "learned_pattern"]
    },

    example: {
      error: "Agendei para quinta mas paciente disse 'próxima semana'",
      correction: "Quinta não é próxima semana, é essa semana",
      learned: "Quando paciente diz 'próxima semana', ignorar 'quinta' sem contexto"
    }
  };
}
```

---

## 8. Fluxos de Exemplo

### 8.1 Agendamento Completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DIÁLOGO: AGENDAMENTO COMPLETO COM CONFIRMAÇÃO                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Paciente: "Oi, quero marcar uma limpeza"                               │
│                                                                          │
│  [Router] Classifica: SCHEDULING (confidence: 0.95)                     │
│  [Router] Delega para: Scheduler Agent                                  │
│                                                                          │
│  [Scheduler] Busca: L1 (últimas mensagens)                              │
│  [Scheduler] Busca: L2 (perfil do paciente - não encontrado)            │
│  [Scheduler] Busca: L3 (config clínica - personalidade)                 │
│                                                                          │
│  Agente: "Olá! 👋 Seja bem-vindo à Clínica Sorriso!                    │
│          Para agendar sua limpeza, qual profissional você prefere?      │
│          👨‍⚕️ Dr. Roberto (Generalista)                                   │
│          👩‍⚕️ Dra. Ana (Especialista)"                                    │
│                                                                          │
│  Paciente: "Dr. Roberto"                                                 │
│                                                                          │
│  [Scheduler] check_availability (LOW RISK - auto-execute)               │
│  Risk Score: 10 → AUTO-EXECUTE                                          │
│                                                                          │
│  Agente: "Ótima escolha! Tenho horários disponíveis:                    │
│          📅 Quinta, 27/03 às 14:00                                      │
│          📅 Sexta, 28/03 às 10:00                                       │
│          📅 Segunda, 31/03 às 16:00                                     │
│          Qual funciona melhor?"                                         │
│                                                                          │
│  Paciente: "Quinta às 14h"                                               │
│                                                                          │
│  [Scheduler] book_appointment (MEDIUM RISK - confirmação)               │
│  Risk Score: 45 → CONFIRMATION_REQUIRED                                 │
│                                                                          │
│  Agente: "Perfeito! Vou agendar para quinta, 27/03 às 14:00            │
│          com o Dr. Roberto. Confirma?"                                  │
│                                                                          │
│  Paciente: "Sim, confirma"                                               │
│                                                                          │
│  [Scheduler] Executa: book_appointment()                                 │
│  [Scheduler] Salva: pending_actions (TTL 5min)                          │
│  [Scheduler] Agenda: reminders (24h, 2h antes)                          │
│                                                                          │
│  Agente: "✅ Agendado!                                                   │
│          📋 Resumo: Quinta, 27/03 às 14:00                              │
│          👨‍⚕️ Dr. Roberto                                                │
│          📍 Rua das Flores, 123                                         │
│                                                                          │
│          Vou te lembrar 24h antes e 2h antes! 😊                        │
│          Precisa de algo mais?"                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Reativação de Paciente Inativo

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DIÁLOGO: REATIVAÇÃO AUTOMÁTICA                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [TRIGGER] Paciente inativo há 90 dias                                   │
│  [TRIGGER] Última consulta: 25/12/2025                                  │
│  [TRIGGER] Próxima consulta recomendada: limpeza semestral              │
│                                                                          │
│  [Sales Agent] Ativado automaticamente                                   │
│  [Sales Agent] Busca: L2 (perfil paciente - Maria, NPS 9)               │
│  [Sales Agent] Busca: L3 (config - Estética Acolhedora)                 │
│  [Sales Agent] Técnica: reciprocidade (paciente antiga)                 │
│                                                                          │
│  Agente: "Oi Maria! 💕                                                  │
│          Faz um tempinho que não te vemos por aqui...                   │
│          Como estão seus dentes? 😊                                     │
│                                                                          │
│          Lembrei que já passou o tempo da sua limpeza semestral!        │
│          A Dra. Ana tem horários essa semana. Quer que eu agende?"      │
│                                                                          │
│  Paciente: "Nossa, nem lembrava! Quarta tem?"                            │
│                                                                          │
│  [Router] Classifica: SCHEDULING                                        │
│  [Scheduler] check_availability                                         │
│                                                                          │
│  Agente: "Quarta a Dra. Ana tem às 15:00! Quer que eu reserve?"         │
│                                                                          │
│  Paciente: "Pode ser!"                                                   │
│                                                                          │
│  [Scheduler] book_appointment (MEDIUM RISK)                             │
│                                                                          │
│  Agente: "✅ Agendado! Quarta, 15:00 com a Dra. Ana.                    │
│          Te espero! 💕"                                                 │
│                                                                          │
│  [DECISION LOG]                                                          │
│  {                                                                       │
│    "action": "reactivate_patient",                                      │
│    "trigger": "90d_inactive",                                           │
│    "risk_score": 55,                                                    │
│    "decision": "AUTO_SEND_MESSAGE",                                     │
│    "reasoning": "Paciente com NPS alto, baixo risco de rejeição",       │
│    "confidence": 0.92                                                   │
│  }                                                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Cancelamento com Undo

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DIÁLOGO: CANCELAMENTO COM UNDO                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Paciente: "Preciso cancelar minha consulta de amanhã"                  │
│                                                                          │
│  [Router] Classifica: SCHEDULING (action: cancel)                       │
│  [Scheduler] Busca: L1 (contexto - tem consulta amanhã)                 │
│  [Scheduler] Risk Score: 75 → HIGH RISK                                 │
│                                                                          │
│  Agente: "Você tem consulta amanhã às 10:00 com a Dra. Ana.            │
│          Tem certeza que deseja cancelar? (SIM/NÃO)"                    │
│                                                                          │
│  Paciente: "SIM"                                                         │
│                                                                          │
│  Agente: "Confirmar cancelamento?                                        │
│          A vaga será liberada para outros pacientes.                    │
│          Digite CONFIRMAR para prosseguir."                             │
│                                                                          │
│  Paciente: "CONFIRMAR"                                                   │
│                                                                          │
│  [Scheduler] Executa: cancel_appointment()                               │
│  [Scheduler] Salva: pending_actions (TTL 5min, id: act_123)             │
│  [Scheduler] Notifica: clínica via dashboard                            │
│                                                                          │
│  Agente: "✅ Consulta cancelada.                                         │
│          Se mudar de ideia, posso ajudar a remarcar. 😊                │
│          Posso fazer algo mais por você?"                               │
│                                                                          │
│  Paciente: "Espera, na verdade vou conseguir ir!"                       │
│                                                                          │
│  [Scheduler] Verifica: TTL de act_123 (2min decorridos)                 │
│  [Scheduler] Ação: RESTORE_APPOINTMENT                                  │
│                                                                          │
│  Agente: "Sem problema! Vou restaurar sua consulta.                    │
│          🔧 Pronto! Sua consulta de amanhã às 10:00 está confirmada!    │
│          Te espero! 😊"                                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Integrações

### 9.1 MCP Servers

```typescript
interface MCPServerIntegration {
  // MCP Servers necessários
  servers: [
    {
      name: "calendar-mcp",
      type: "custom",
      priority: "P0",
      tools: [
        "check_availability",
        "book_appointment",
        "cancel_appointment",
        "reschedule_appointment",
        "get_professional_schedule",
        "manage_waitlist"
      ],
      // Authentication
      auth: {
        type: "api_key",
        header: "X-Calendar-Key",
        rotationDays: 30
      },
      // Error handling
      errorHandling: {
        timeout: 5000,
        retryAttempts: 3,
        fallback: "Informar indisponibilidade, pedir para ligar"
      },
      // Rate limiting
      rateLimit: {
        requestsPerSecond: 10,
        burstSize: 20
      }
    },
    {
      name: "patients-mcp",
      type: "custom",
      priority: "P1",
      tools: [
        "create_patient",
        "get_patient",
        "update_patient",
        "search_patients",
        "get_patient_history",
        "update_risk_score"
      ],
      auth: {
        type: "jwt",
        audience: "patients-mcp.synkroo.internal",
        expiryMinutes: 60
      },
      errorHandling: {
        timeout: 3000,
        retryAttempts: 2,
        fallback: "Pedir dados ao paciente"
      },
      rateLimit: {
        requestsPerSecond: 20,
        burstSize: 50
      }
    },
    {
      name: "whatsapp-mcp",
      type: "custom",
      priority: "P0",
      tools: [
        "send_message",
        "receive_message",
        "send_template",
        "get_qr_code",
        "check_connection_status"
      ],
      auth: {
        type: "oauth2",
        provider: "meta",
        refreshThresholdMinutes: 10
      },
      errorHandling: {
        timeout: 10000,  // WhatsApp pode ser lento
        retryAttempts: 3,
        fallback: "Queue message, retry later"
      },
      rateLimit: {
        requestsPerSecond: 5,  // Meta rate limits
        burstSize: 10
      }
    },
    {
      name: "knowledge-mcp",
      type: "custom",
      priority: "P1",
      tools: [
        "search_knowledge",
        "ingest_document",
        "list_documents",
        "get_document_versions",
        "rollback_version"
      ],
      auth: {
        type: "api_key",
        header: "X-Knowledge-Key",
        rotationDays: 30
      },
      errorHandling: {
        timeout: 5000,
        retryAttempts: 2,
        fallback: "Usar resposta padrão, informar limitação"
      },
      rateLimit: {
        requestsPerSecond: 15,
        burstSize: 30
      }
    },
    {
      name: "postgres-mcp",
      type: "existing",
      priority: "P0",
      tools: [
        "query",
        "insert",
        "update"
      ],
      auth: {
        type: "connection_string",
        sslRequired: true,
        poolSize: 10
      },
      errorHandling: {
        timeout: 3000,
        retryAttempts: 3,
        fallback: "Usar cache Redis, informar degradação"
      },
      rateLimit: {
        requestsPerSecond: 50,
        burstSize: 100
      }
    }
  ];

  // Global MCP Configuration
  globalConfig: {
    healthCheckInterval: 30000,  // 30 seconds
    connectionTimeout: 5000,
    requestTimeout: 10000,
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      resetAfterMs: 60000
    },
    logging: {
      level: "info",
      includePayloads: false,  // Security: don't log sensitive data
      includeTimings: true
    }
  };
}
```

### 9.2 MCP Communication Protocol

```typescript
interface MCPMessageEnvelope {
  // Message identification
  messageId: string;         // UUID
  correlationId: string;     // Links request/response
  timestamp: Date;

  // Routing
  from: {
    agentId: string;
    agentType: AgentType;
  };
  to: {
    serverName: string;
    tool: string;
  };

  // Context propagation
  context: {
    clinicId: string;
    patientId?: string;
    sessionId: string;
    conversationId: string;
  };

  // Payload
  payload: Record<string, unknown>;

  // Metadata
  metadata: {
    priority: "P0" | "P1" | "P2";
    timeout: number;
    retryCount: number;
    fallbackUsed: boolean;
  };
}

// Agent handoff protocol
interface AgentHandoff {
  fromAgent: AgentType;
  toAgent: AgentType;
  reason: string;
  contextPreserved: boolean;
  conversationState: {
    lastIntent: string;
    pendingActions: string[];
    patientContext: PatientContext;
  };
  timestamp: Date;
}
```

---

## 10. Métricas e Monitoramento

### 10.1 KPIs do Agente

```typescript
interface AgentMetrics {
  // Performance
  performance: [
    "avg_response_time_ms",     // Target: <3000ms
    "intent_classification_accuracy", // Target: >95%
    "action_success_rate",      // Target: >99%
    "escalation_rate",          // Target: <5%
    "patient_satisfaction_nps"  // Target: >50
  ];

  // Uso
  usage: [
    "conversations_per_day",
    "messages_per_conversation",
    "actions_per_day",
    "tokens_consumed",
    "active_patients"
  ];

  // Erros
  errors: [
    "classification_errors",
    "action_failures",
    "timeout_errors",
    "escalations_to_human"
  ];

  // Learning
  learning: [
    "patterns_learned",
    "error_corrections",
    "knowledge_gaps_detected",
    "rag_retrieval_accuracy"
  ];
}
```

---

## 11. Roadmap de Implementação

### 11.1 Fase 1: Core (Sprint 1-2)

**Desenvolvimento:**
- [ ] Orchestrator Agent básico
- [ ] Router Agent com classificação de intenção
- [ ] Memória L1 (Redis) + L2 (PostgreSQL)
- [ ] Personalidade básica (1 template)
- [ ] Ações LOW e MEDIUM risk

**Testes:**
- [ ] Unit tests: Router confidence scoring (target: >90% coverage)
- [ ] Unit tests: Memory L1/L2 retrieval
- [ ] Integration tests: Orchestrator → Router handoff
- [ ] Performance tests: Memory latency targets (<5ms L1, <50ms L2)

### 11.2 Fase 2: Especialistas (Sprint 3-4)

**Desenvolvimento:**
- [ ] Scheduler Agent completo
- [ ] Sales Agent básico
- [ ] Generalist Agent com RAG
- [ ] Memória L3 + L4
- [ ] Ações HIGH risk + Undo

**Testes:**
- [ ] Unit tests: Each specialist agent logic
- [ ] Integration tests: Router → Scheduler delegation
- [ ] Integration tests: Risk level confirmation flows
- [ ] E2E tests: Full scheduling flow (message → booked)
- [ ] Performance tests: Agent response time (<3s target)

### 11.3 Fase 3: Inteligência (Sprint 5-6)

**Desenvolvimento:**
- [ ] Smart Triggers
- [ ] Knowledge Versioning
- [ ] Error Learning
- [ ] Explainability completo
- [ ] Todos os templates de personalidade

**Testes:**
- [ ] Unit tests: Trigger priority and merging logic
- [ ] Integration tests: Knowledge versioning + rollback
- [ ] E2E tests: No-show recovery flow
- [ ] E2E tests: Personality template switching
- [ ] Performance tests: RAG search latency (<150ms)
- [ ] Load tests: 100 concurrent conversations

### 11.4 Fase 4: Polish (Sprint 7-8)

**Desenvolvimento:**
- [ ] Gap Detection Dashboard
- [ ] Override System
- [ ] Métricas e Monitoramento
- [ ] Performance Optimization
- [ ] Piloto com clínica real

**Testes:**
- [ ] E2E tests: Complete patient journey (discovery → retention)
- [ ] Load tests: 500 concurrent conversations
- [ ] Chaos engineering: MCP server failure recovery
- [ ] Security tests: Input validation, injection attempts
- [ ] UAT: Pilot clinic acceptance tests
- [ ] Regression tests: Full test suite automated

### 11.5 Test Infrastructure

```typescript
interface TestInfrastructure {
  // Test environments
  environments: {
    unit: "Jest + TypeScript";
    integration: "Jest + TestContainers (PostgreSQL, Redis)";
    e2e: "Playwright + Mock WhatsApp API";
    load: "k6 + Grafana dashboards";
  };

  // Coverage targets
  coverage: {
    unit: 80;           // 80% line coverage
    integration: 70;    // 70% branch coverage
    e2e: 100;           // 100% critical paths
  };

  // Test data
  testData: {
    patients: "Synthetic patient records (LGPD compliant)";
    conversations: "Anonymized real conversation samples";
    knowledge: "Sample clinic knowledge bases";
  };

  // CI/CD integration
  cicd: {
    onPR: ["unit", "integration"];
    onMerge: ["unit", "integration", "e2e"];
    nightly: ["load", "security"];
    onRelease: ["full_regression"];
  };
}
```

---

## 12. Referências

- [Claude Agent SDK Documentation](https://docs.anthropic.com/claude/docs/agent-sdk)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [PostgreSQL pgvector](https://github.com/pgvector/pgvector)
- [LGPD - Lei 13.709/2018](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)

---

**Aprovado por:** Walis
**Data:** 2026-03-25