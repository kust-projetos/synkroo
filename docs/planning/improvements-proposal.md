# Proposta de Melhorias - Synkroo

**Data:** 2026-03-24
**Status:** ✅ Atualizado com Classificação MVP/Pós-MVP
**Objetivo:** Estruturar o projeto ideal antes da implementação

---

## Legenda de Prioridade

| Tag | Significado |
|-----|-------------|
| **[MVP]** | Incluído no MVP (8 semanas) |
| **[Pós-MVP]** | Após MVP, fases de expansão |
| **[Futuro]** | Roadmap longo prazo |

---

## 1. Features Expandidas

### 1.1 MÓDULO: Inteligência Preditiva **[Pós-MVP]**

**Problema:** Sistema atual é reativo - responde quando paciente contata.

**Solução:** Sistema proativo que prevê necessidades.

| Feature | Descrição | Valor |
|---------|-----------|-------|
| **Previsão de No-Show** | ML que prevê probabilidade de no-show por paciente | Reduz perdas em 20-30% |
| **Churn Prediction** | Identifica pacientes em risco de abandonar tratamento | Recupera receita |
| **Oportunidades de Upsell** | Sugere procedimentos baseado em histórico | Aumenta ticket médio |
| **Análise de Sazonalidade** | Prevê demanda por período | Otimiza agenda |

**Exemplo de Uso:**
```
Agente: "Dr. Roberto, identifiquei que João tem 78% de chance de não comparecer
amanhã (histórico: já faltou 3x às sextas). Quer que eu ligue para confirmar ou
já ofereça outro horário?"
```

---

### 1.2 MÓDULO: Voz e Telefone Avançado **[Pós-MVP]**

**Expansão do Call Center IA:**

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| **Voz Clonada da Clínica** | IA com voz personalizada da atendente | P1 |
| **Gravação + Transcrição** | Todas ligações gravadas e transcritas | P0 |
| **Análise de Sentimento** | Detecta frustração, urgência | P1 |
| **Detecção de Palavras-Chave** | "dor", "urgente", "cancelar" disparam alertas | P1 |
| **CRM Voice Notes** | Resumo automático da ligação no prontuário | P0 |

**Fluxo de Ligação:**
```
1. Ligações entram no sistema
2. IA atende com voz da clínica
3. Transcrição em tempo real
4. Análise de sentimento
5. Resumo automático no CRM
6. Follow-up agendado se necessário
```

---

### 1.3 MÓDULO: Comunicação Assíncrona Avançada **[MVP - Parcial]**

| Feature | Status MVP | Nota |
|---------|------------|------|
| **Chat Widget no Site** | ✅ Incluído | Sprint 5-6 |
| **WhatsApp Web + Playwright** | ✅ Incluído | Sprint 1-2 |
| **Instagram DM** | ✅ Incluído | Sprint 1-2 |
| **App Próprio (PWA)** | ❌ Pós-MVP | Sprint 9+ |
| **Email Inteligente** | ❌ Pós-MVP | Sprint 9+ |
| **SMS Gateway** | ❌ Futuro | Baixa prioridade |
| **Notificações Push** | ❌ Pós-MVP | Junto com PWA |

**Estratégia de Canal Inteligente:**
```
Sistema escolhe melhor canal baseado em:
├── Custo (preferir canais gratuitos)
├── Urgência (SMS/Push para urgente)
├── Histórico (onde paciente responde mais)
├── Horário (respeitar janelas)
└── Compliance (LGPD, termos WhatsApp)
```

---

### 1.4 MÓDULO: Gestão Financeira Integrada **[Pós-MVP]**

**Problema:** Sistema atual não cuida do fluxo financeiro.

**Solução:** Módulo financeiro completo.

| Feature | Descrição | Status |
|---------|-----------|--------|
| **Contas a Receber** | Controle de pagamentos, parcelamentos | Pós-MVP |
| **Cobrança Automática** | Lembretes de vencimento, boletos | Pós-MVP |
| **Integração PIX** | Geração e confirmação automática | Pós-MVP |
| **Gateway de Pagamento** | Integração com ASAAS, MercadoPago | Futuro |
| **Relatórios Financeiros** | DRE simplificado, fluxo de caixa | Pós-MVP |
| **Inadimplência** | Campanhas automáticas de recuperação | Pós-MVP |

**Fluxo Financeiro:**
```
1. Procedimento realizado → Gera cobrança
2. Envia link de pagamento (PIX/cartão)
3. Confirmação automática
4. Parcelamento → Lembretes de parcelas
5. Inadimplência → Sequência de recuperação
6. Relatório mensal → WhatsApp do dono
```

---

### 1.5 MÓDULO NOVO: Business Intelligence

**Dashboards Executivos:**

| Dashboard | Métricas |
|-----------|----------|
| **Operacional** | Consultas/dia, no-show, tempo resposta, conversas ativas |
| **Financeiro** | Receita, inadimplência, ticket médio, LTV |
| **Comercial** | Leads, conversão, funil de vendas, origem |
| **Pacientes** | Novos, ativos, inativos, reativados, churn |
| **Equipe** | Produtividade por profissional, horários ociosos |

**Alertas Inteligentes:**
```
"Dr. Roberto, alerta: sua taxa de no-show subiu de 15% para 22% este mês.
Principal causa: pacientes de quinta à tarde. Quer que eu implemente
confirmação dupla para esse horário?"
```

---

## 2. Integrações Expandidas

### 2.1 Integrações de Saúde

| Integração | Valor | Prioridade |
|------------|-------|------------|
| **Doctoralia** | Sincronização de agenda e pacientes | P0 |
| **Feegow** | Migração de dados, backup | P1 |
| **Google Calendar** | Sync bidirecional | P0 |
| **Google Meet/Zoom** | Teleconsultas automáticas | P1 |
| **iCal/Outlook** | Calendários externos | P1 |

### 2.2 Integrações Financeiras

| Integração | Valor | Prioridade |
|------------|-------|------------|
| **ASAAS** | Pagamentos, cobranças, PIX | P0 |
| **MercadoPago** | Checkout transparente | P1 |
| **iugu** | Assinaturas recorrentes | P2 |
| **Bancos (Open Finance)** | Conciliação automática | P3 |

### 2.3 Integrações de Marketing

| Integração | Valor | Prioridade |
|------------|-------|------------|
| **Google Business Profile** | Respostas a avaliações, posts | P0 |
| **Meta Ads** | Leads → conversão automática | P1 |
| **Google Ads** | Captação, tracking | P2 |
| **Mailchimp** | Email marketing | P2 |
| **RD Station** | Automação de marketing B2B | P3 |

### 2.4 Integrações Operacionais

| Integração | Valor | Prioridade |
|------------|-------|------------|
| **Laboratórios** | Solicitação de exames | P2 |
| **Convênios** | Verificação de elegibilidade | P2 |
| **Fornecedores** | Pedidos de material | P3 |
| **Contabilidade** | Exportação de dados | P2 |

---

## 3. Melhorias na Arquitetura

### 3.1 Edge Computing

**Problema:** Latência pode ser problema para respostas em tempo real.

**Solução:** Deploy em edge (Cloudflare Workers/Vercel Edge).

```
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  CLOUDFLARE EDGE (Brasil - GRU)                         │  │
│   │  ├── Webhook handlers (WhatsApp, Instagram, Telegram)  │  │
│   │  ├── Rate limiting                                     │  │
│   │  ├── Request validation                                │  │
│   │  └── Cache de respostas frequentes                     │  │
│   │      Latência: <10ms para 95% das requests             │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  ORIGIN (AWS/Vercel - sa-east-1)                        │  │
│   │  ├── Agent orchestration                                │  │
│   │  ├── Database operations                               │  │
│   │  └── Business logic                                    │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Multi-Region

**Para escalar:**
- Brasil: sa-east-1 (São Paulo)
- Europa: eu-west-1 (expansão futura)
- USA: us-east-1 (expansão futura)

### 3.3 Offline-First

**Para clínicas com internet instável:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    OFFLINE-FIRST ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   FRONTEND (PWA)                                                │
│   ├── Service Worker → Cache de dados essenciais               │
│   ├── IndexedDB → Agenda, pacientes offline                     │
│   ├── Background Sync → Sincroniza quando volta online         │
│   └── Push Notifications → Mesmo offline                        │
│                                                                  │
│   CENÁRIO: Internet cai durante agendamento                    │
│   1. Sistema continua funcionando (offline mode)               │
│   2. Agendamento salvo localmente                              │
│   3. Quando voltar, sincroniza automaticamente                 │
│   4. Paciente recebe confirmação                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 API Pública

**Para ecossistema de parceiros:**

```typescript
// API pública para integrações
interface ClinicAIAPI {
  // Webhooks
  'POST /webhooks/appointment.created': void;
  'POST /webhooks/appointment.confirmed': void;
  'POST /webhooks/appointment.cancelled': void;
  'POST /webhooks/patient.created': void;
  'POST /webhooks/conversation.escalated': void;

  // REST API
  'GET /api/v1/patients': Patient[];
  'GET /api/v1/appointments': Appointment[];
  'POST /api/v1/appointments': Appointment;
  'GET /api/v1/conversations': Conversation[];

  // SDKs
  'npm install @clinica-ai/sdk': SDK;
}
```

---

## 4. Diferenciação Competitiva

### 4.1 Agente que "Vê" e "Faz"

**Além de conversar, o agente pode:**

| Capacidade | Descrição |
|------------|-----------|
| **Acessar Câmera** | Ver documento do paciente, fazer upload |
| **Preencher Formulários** | Automatizar paper work |
| **Gerar Odontograma** | Via comando de voz do dentista |
| **Integrar com Software** | Operar sistema legado da clínica |
| **Fazer Pesquisas** | Buscar informações em tempo real |

**Exemplo:**
```
Dentista: "Agente, veja a câmera e registre que o dente 36 tem cárie"
Agente: [Captura foto, analisa, registra no prontuário]
        "Foto salva, registrado cárie no dente 36. Quer que eu agende
        o tratamento?"
```

### 4.2 Memória Perfeita

**Sistema lembra TUDO:**

```
Memória do Paciente João:
├── Dados básicos (nome, telefone, nascimento)
├── Histórico médico (alergias, medicamentos)
├── Histórico dental (tratamentos, procedimentos)
├── Preferências (hora preferida, profissional favorito)
├── Comunicações (todas as conversas desde o início)
├── Financeiro (pagamentos, inadimplência)
├── Comportamento (taxa de no-show, padrões)
└── Sentimento (satisfação nas interações)
```

**Uso:**
```
João: "Quero remarcar"
Agente: "Oi João! Vi que sua consulta é com a Dra. Ana amanhã às 14h.
        Ela perguntou sobre o clareamento na última vez. Quer
        remarcar ou falar sobre o clareamento?"
```

### 4.3 Automação de Processos

**Fluxos automatizados complexos:**

```
FLUXO: NOVO PACIENTE DE IMPLANTE
├── 1. Lead chega → Qualificação automática
├── 2. Agendamento de avaliação
├── 3. Pré-anamnese via WhatsApp (antes da consulta)
├── 4. Lembrete 24h + 2h
├── 5. Pós-avaliação: Orçamento enviado
├── 6. Follow-up 3 dias (se não responder)
├── 7. Follow-up 7 dias (se não responder)
├── 8. Aprovação: Agendamento de cirurgia
├── 9. Orientações pré-cirúrgicas (D-7, D-1)
├── 10. Pós-cirúrgico: Sequência de follow-up
│    ├── D1: "Como está se sentindo?"
│    ├── D3: "Algum inchaço?"
│    └── D7: "Retorno amanhã!"
├── 11. Osseointegração: Acompanhamento mensal
├── 12. Prótese: Agendamento automático
└── 13. Manutenção: Recall 6 meses

TUDO AUTOMATIZADO, HUMANO SÓ INTERVÉM QUANDO NECESSÁRIO
```

---

## 5. Features por Segmento

### 5.1 Odontologia (MVP)

| Feature | Prioridade |
|---------|------------|
| Agendamento inteligente | P0 |
| Lembretes automáticos | P0 |
| Follow-up pós-procedimento | P0 |
| Odontograma digital | P1 |
| Proposta de tratamento visual | P2 |

### 5.2 Estética (Expansão Fase 2)

| Feature | Prioridade |
|---------|------------|
| Agenda por procedimento | P0 |
| Pacotes e sessões | P0 |
| Antes/Depois (fotos) | P1 |
| Campanhas sazonais | P1 |
| Fidelidade e pontos | P2 |

### 5.3 Fisioterapia (Expansão Fase 3)

| Feature | Prioridade |
|---------|------------|
| Sessões recorrentes | P0 |
| Evolução do paciente | P0 |
| Exercícios domiciliares (vídeos) | P1 |
| Convênios | P1 |
| Relatórios para seguradoras | P2 |

---

## 6. Roadmap de Features Proposto

### FASE 1: MVP+ (4 semanas)

| Semana | Feature |
|--------|---------|
| 1-2 | WhatsApp + Router Agent + Agendamento |
| 3-4 | Lembretes + Dashboard + CRM básico + Piloto |

**Novo no MVP+:**
- Chat widget no site (owned channel)
- Memória persistente desde dia 1
- Log de decisões IA (LGPD)

### FASE 2: Core+ (4 semanas)

| Feature | Prioridade |
|---------|------------|
| Instagram DM | P0 |
| Voz básica (inbound) | P0 |
| RAG com pgvector | P0 |
| Dashboards avançados | P1 |
| Integração Google Calendar | P1 |
| Notificações Push | P1 |

### FASE 3: Intelligence (8 semanas)

| Feature | Prioridade |
|---------|------------|
| Voz completa (outbound + clonada) | P0 |
| Previsão de no-show (ML) | P0 |
| Churn prediction | P1 |
| BI completo | P1 |
| Módulo financeiro | P1 |
| API pública | P2 |

### FASE 4: Scale (Ongoing)

- Multi-region
- Offline-first PWA
- Integrações avançadas
- Novos segmentos
- White-label

---

## 7. Grafo de Dependências de Features

### 7.1 Mapa de Dependências

```
┌─────────────────────────────────────────────────────────────────────┐
│                 FEATURE DEPENDENCY GRAPH                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  LAYER 0: FOUNDATION (Sem dependências)                             │
│  ├── [MVP] Multi-tenant RLS                                        │
│  ├── [MVP] Auth (Supabase)                                         │
│  └── [MVP] Schema DB (20 tabelas)                                  │
│                                                                      │
│  LAYER 1: CORE COMMUNICATION                                        │
│  ├── [MVP] WhatsApp Web ──► Depende de: Foundation                 │
│  ├── [MVP] Router Agent ──► Depende de: Foundation                 │
│  └── [MVP] Message Queue ──► Depende de: Foundation                │
│                                                                      │
│  LAYER 2: CORE FUNCTIONALITY                                        │
│  ├── [MVP] Scheduling Agent ──► Depende de: Router, WhatsApp       │
│  ├── [MVP] Appointments CRUD ──► Depende de: Foundation            │
│  ├── [MVP] Patients CRUD ──► Depende de: Foundation                │
│  └── [MVP] Lembretes ──► Depende de: Appointments, WhatsApp        │
│                                                                      │
│  LAYER 3: INTELLIGENCE                                              │
│  ├── [MVP] RAG básico ──► Depende de: Foundation, Router           │
│  ├── [MVP] Memória ──► Depende de: RAG                             │
│  ├── [MVP] Follow-up ──► Depende de: Appointments, WhatsApp        │
│  └── [MVP] Dashboard ──► Depende de: Appointments, Patients        │
│                                                                      │
│  LAYER 4: EXPANSION                                                 │
│  ├── [Pós-MVP] Instagram DM ──► Depende de: Router, Message Queue  │
│  ├── [Pós-MVP] Telegram ──► Depende de: Router, Message Queue      │
│  ├── [Pós-MVP] Chat Widget ──► Depende de: Router                  │
│  └── [Pós-MVP] Voz Básica ──► Depende de: Router, WhatsApp         │
│                                                                      │
│  LAYER 5: ADVANCED                                                  │
│  ├── [Pós-MVP] Voz Clonada ──► Depende de: Voz Básica              │
│  ├── [Pós-MVP] Previsão No-Show ──► Depende de: ML, Histórico      │
│  ├── [Pós-MVP] Churn Prediction ──► Depende de: ML, CRM            │
│  └── [Pós-MVP] Financeiro ──► Depende de: Appointments, Patients   │
│                                                                      │
│  LAYER 6: SCALE                                                     │
│  ├── [Futuro] API Pública ──► Depende de: Tudo estável             │
│  ├── [Futuro] Multi-region ──► Depende de: Infra                   │
│  └── [Futuro] White-label ──► Depende de: Tudo estável             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Caminho Crítico do MVP

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CRITICAL PATH - MVP (8 semanas)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Sprint 1-2 (Fundação)                                              │
│  ──────────────────────                                             │
│  Foundation ──► WhatsApp Web ──► Router Agent                       │
│       │              │                │                             │
│       └──────────────┴────────────────┘                             │
│                       │                                              │
│                       ▼                                              │
│  Sprint 3-4 (Core)                                                  │
│  ──────────────────                                                 │
│  Appointments ──► Patients ──► Lembretes                            │
│       │              │              │                               │
│       └──────────────┴──────────────┘                               │
│                       │                                              │
│                       ▼                                              │
│  Sprint 5-6 (Intelligence)                                          │
│  ────────────────────────                                           │
│  RAG ──► Memória ──► Follow-up ──► Dashboard                        │
│   │         │           │            │                              │
│   └─────────┴───────────┴────────────┘                              │
│                       │                                              │
│                       ▼                                              │
│  Sprint 7-8 (Piloto)                                                │
│  ──────────────────                                                 │
│  Validação com clínica real → Ajustes → Go/No-Go                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Bloqueios Comuns

| Feature | Bloqueada Por | Motivo |
|---------|---------------|--------|
| Voz Clonada | Voz Básica | Precisa infra de voz funcionando |
| Previsão No-Show | Histórico 6+ meses | Dados insuficientes para ML |
| Financeiro | Appointments, Patients | Integração com dados existentes |
| API Pública | Core estável | Breaking changes são caras |
| Multi-region | Volume alto | ROI não justifica no início |

---

## 8. Análise de Viabilidade

### 7.1 Complexidade vs Valor

```
                    VALOR
              Baixo     Médio     Alto
         ┌─────────┬─────────┬─────────┐
    Alto │         │  Voz    │ Agente  │
         │         │ Clonada │ Visão   │
COMP     ├─────────┼─────────┼─────────┤
Médio    │         │ Financeiro│ RAG   │
         │         │         │         │
         ├─────────┼─────────┼─────────┤
    Baixo│  SMS    │ Push    │ Lembretes│
         │         │ Notif   │ Auto    │
         └─────────┴─────────┴─────────┘

PRIORIDADE: Começar pelo canto inferior direito
```

### 7.2 Quick Wins (Alto valor, baixa complexidade)

| Feature | Esforço | Impacto | ROI |
|---------|---------|---------|-----|
| Lembretes automáticos | 2 dias | -50% no-show | 10x |
| Follow-up pós-consulta | 1 dia | +NPS | 15x |
| Notificações push | 3 dias | Engajamento | 8x |
| Chat widget site | 2 dias | Canal próprio | 5x |
| Relatórios WhatsApp | 1 dia | Transparência | 3x |

---

## 8. Próximos Passos

1. **Discutir prioridades** - Quais features são essenciais no MVP?
2. **Validar com pesquisa** - Entrevistar clínicas sobre necessidades
3. **Refinar PRD** - Incorporar features aprovadas
4. **Arquitetura** - Desenhar solução técnica
5. **UX Design** - Wireframes das novas features

---

## 9. Perguntas para Decisão

1. **Qual o foco do MVP?** Atendimento básico ou já incluir financeiro?
2. **Voz é prioridade?** Pode ser diferencial competitivo forte
3. **Qual a estratégia de canais?** Foco em WhatsApp ou diversificar desde o início?
4. **Multi-segmento no MVP?** Ficar só odonto ou já preparar para estética?
5. **Integrações legadas?** Já integrar com Feegow/Doctoralia no MVP?

---

**Documento para discussão e decisão**