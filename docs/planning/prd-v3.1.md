# Product Requirements Document (PRD)
# Synkroo - Plataforma de Automação Empresarial para Clínicas

**Versão:** 3.1 - Consolidated Edition
**Data:** 2026-03-24
**Autor:** BMAD Master (com Walis)
**Status:** ✅ Atualizado com Melhorias
**Baseado em:**
- Product Brief v2.0 (Aprovado)
- PRD v3.0 + Refinamentos de Arquitetura

---

## Mudanças da v3.0 → v3.1

| Seção | Mudança |
|-------|---------|
| **Nome** | Clínica AI Platform → **Synkroo** |
| **Schema** | Expandido para 20 tabelas com soft delete |
| **APIs** | Detalhado ~35 endpoints |
| **Roadmap** | 8 semanas detalhado por sprint |
| **Modelo Custos** | Híbrido (setup + mensal + repasse tokens), margem 95%+ |
| **Riscos** | Expandido de 18 para 30 itens |

---

## Executive Summary

**Synkroo** é uma plataforma de automação empresarial construída sobre agentes SDK Claude que revoluciona como clínicas operam, vendem e escalam.

**Diferencial Único:** Agente IA que vê, fala e faz - não só conversa, mas executa tarefas, atende por voz, e opera de forma proativa.

| Aspecto | Detalhe |
|---------|---------|
| **Módulos MVP** | 6 módulos (Core, WhatsApp, Scheduling, CRM, Dashboard, Follow-up) |
| **Agentes** | 4+1 Multi-Agent: Orchestrator + Router (ativo) + Scheduler/Sales/Generalist (lazy) |
| **Canais** | WhatsApp, Instagram, Chat Widget |
| **Stack** | Supabase-only (simplificado) |
| **MVP** | 8 semanas |
| **Margem** | 95%+ (custos repassados) |
| **Spec Agente** | `docs/superpowers/specs/2026-03-25-agent-design.md` |

---

## 1. Modelo de Dados (20 Tabelas)

### 1.1 Tabelas Principais

```sql
-- Core
clinics          -- Multi-tenant (tenant isolation)
users            -- Admin, dentistas, atendentes
patients         -- Pacientes da clínica
dentists         -- Profissionais de saúde

-- Agendamento
appointments     -- Consultas agendadas
procedures       -- Procedimentos oferecidos
schedule_blocks  -- Bloqueios de agenda

-- Comunicação
conversations    -- PARTITIONED BY clinic_id, created_at
knowledge_base   -- RAG da clínica
whatsapp_instances -- Números WhatsApp
message_templates -- Templates reutilizáveis

-- Sessões e Contexto
sessions         -- Sessões do agente
follow_ups       -- Follow-ups agendados
reminders        -- Lembretes configurados

-- Analytics
no_show_history  -- Histórico de no-show
patient_risk_scores -- Scores preditivos

-- Configuração
clinic_settings  -- Configurações por clínica
audit_logs       -- LGPD compliance

-- Operacional
waitlist         -- Lista de espera
message_queue    -- Fila de mensagens
```

### 1.2 Colunas Padrão (todas as tabelas)

```sql
clinic_id UUID NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW(),
deleted_at TIMESTAMPTZ,  -- Soft delete
deleted_by UUID,         -- Soft delete audit
```

### 1.3 Partitioning Strategy

```sql
-- Conversations particionada por mês
CREATE TABLE conversations (
    id UUID,
    clinic_id UUID,
    created_at TIMESTAMPTZ,
    ...
) PARTITION BY RANGE (created_at);

-- Partições mensais automáticas
CREATE TABLE conversations_2026_03 PARTITION OF conversations
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

---

## 2. APIs (~35 Endpoints)

### 2.1 Autenticação (5)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/login` | Login com email/senha |
| POST | `/auth/logout` | Logout |
| POST | `/auth/refresh` | Refresh token |
| GET | `/auth/me` | Usuário atual |
| POST | `/auth/magic-link` | Magic link login |

### 2.2 Agendamentos (8)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/appointments` | Listar agendamentos |
| POST | `/appointments` | Criar agendamento |
| GET | `/appointments/:id` | Detalhes |
| PUT | `/appointments/:id` | Atualizar |
| DELETE | `/appointments/:id` | Cancelar (soft delete) |
| GET | `/appointments/available-slots` | Horários disponíveis |
| POST | `/appointments/:id/confirm` | Confirmar |
| POST | `/appointments/:id/reschedule` | Reagendar |

### 2.3 Pacientes (7)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/patients` | Listar pacientes |
| POST | `/patients` | Criar paciente |
| GET | `/patients/:id` | Detalhes |
| PUT | `/patients/:id` | Atualizar |
| DELETE | `/patients/:id` | Remover (soft delete) |
| GET | `/patients/:id/history` | Histórico |
| GET | `/patients/:id/appointments` | Agendamentos |

### 2.4 Agente (3)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/agent/chat` | Enviar mensagem ao agente |
| GET | `/agent/conversations` | Listar conversas |
| POST | `/agent/intervene` | Intervenção humana |

### 2.5 WhatsApp (6)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/whatsapp/instances` | Listar números |
| POST | `/whatsapp/connect` | Conectar número |
| POST | `/whatsapp/disconnect` | Desconectar |
| POST | `/whatsapp/send` | Enviar mensagem |
| POST | `/whatsapp/webhook` | Webhook Meta |
| GET | `/whatsapp/qr` | QR Code para escaneamento |

### 2.6 Dashboard (6)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/dashboard/stats` | Estatísticas gerais |
| GET | `/dashboard/appointments/today` | Agendamentos do dia |
| GET | `/dashboard/alerts` | Alertas ativos |
| GET | `/dashboard/roi/summary` | Resumo ROI |
| GET | `/dashboard/roi/report` | Relatório ROI |
| GET | `/dashboard/conversions` | Conversões |

---

## 3. Roadmap MVP (8 Semanas)

### Sprint 1-2: Core + Canais (2 semanas)

| Semana | Tarefas | Entregável |
|--------|---------|------------|
| 1 | Setup projeto, auth, multi-tenant RLS | Base funcional |
| 1 | Schema DB (20 tabelas) | Migrations prontas |
| 2 | WhatsApp Web + Playwright | Mensagens básicas |
| 2 | Agente Router básico | Responde conversas |

**Checkpoints:**
- [ ] Supabase configurado com RLS
- [ ] WhatsApp conectado e enviando
- [ ] Agente responde mensagens simples

---

### Sprint 3-4: Agendamento + CRM (2 semanas)

| Semana | Tarefas | Entregável |
|--------|---------|------------|
| 3 | CRUD agendamentos | Marcar/desmarcar |
| 3 | Verificação disponibilidade | Slots em tempo real |
| 3 | CRUD pacientes | Cadastro completo |
| 4 | Lembretes automáticos | 24h + 2h antes |
| 4 | Confirmação via WhatsApp | Fluxo completo |

**Checkpoints:**
- [ ] Agendamento funcionando end-to-end
- [ ] Lembretes enviando automaticamente
- [ ] Dashboard básico mostrando agenda

---

### Sprint 5-6: Inteligência + Dashboard (2 semanas)

| Semana | Tarefas | Entregável |
|--------|---------|------------|
| 5 | Memória de contexto (RAG básico) | Agente lembra paciente |
| 5 | Follow-up pós-consulta | Sequência automática |
| 5 | Recuperação no-show | Reagendamento proativo |
| 6 | Dashboard completo | Métricas e relatórios |
| 6 | Chat widget para site | Canal owned |

**Checkpoints:**
- [ ] Agente com memória persistente
- [ ] Follow-ups rodando
- [ ] Dashboard com métricas reais

---

### Sprint 7-8: Piloto + Ajustes (2 semanas)

| Semana | Tarefas | Entregável |
|--------|---------|------------|
| 7 | Onboarding clínica piloto | Primeiro cliente |
| 7 | Testes em produção | Bugs identificados |
| 7 | Documentação usuário | Manuais |
| 8 | Ajustes baseados em feedback | Iteração |
| 8 | Validação de métricas | ROI comprovado |
| 8 | Go/No-Go para expansão | Decisão |

**Checkpoints:**
- [ ] 1 clínica usando diariamente
- [ ] Métricas de ROI documentadas
- [ ] NPS > 50

---

## 4. Modelo de Custos

### 4.1 Estrutura de Receita (Híbrido)

```
SETUP FEE (único)
├── Básico: R$ 3.000 - 5.000
├── Intermediário: R$ 5.000 - 10.000
└── Enterprise: R$ 10.000 - 20.000

MENSALIDADE (recorrente)
├── Starter (1-2 prof): R$ 500-800/mês
├── Growth (3-5 prof): R$ 800-1.500/mês
└── Scale (6+ prof): R$ 1.500-3.000/mês

ADD-ONS (opcionais)
├── Call Center IA: +R$ 300-500/mês
├── Tráfego Pago: +R$ 200-400/mês
└── Relatórios Avançados: +R$ 100-200/mês

CUSTOS REPASSADOS AO CLIENTE
├── Tokens LLM (transparência total)
└── WhatsApp API oficial (só se quiser disparos)
```

### 4.2 Custos da Empresa

| Item | Custo/mês | Nota |
|------|-----------|------|
| Supabase Pro | $40 | Fase inicial |
| Redis/Cache | $10 | |
| Monitoring | $20 | |
| **Total Fixo** | **$75** | Compartilhado |

| Item | Custo/clínica |
|------|---------------|
| WhatsApp Web | $0 | Playwright/wcli |
| Storage | ~$2 | Compartilhado |
| **Marginal** | **~$2-5** | |

### 4.3 Unit Economics

```
RECEITA (Growth)
├── Setup Fee: R$ 7.500 (~$1,500)
└── Mensalidade: R$ 1.150/mês (~$230)

CUSTOS (empresa)
├── Fixo compartilhado: ~$2/mês por clínica
└── Margem: ~98%

MARGEM LÍQUIDA: 95-98%
```

### 4.4 Break-even

| Métrica | Valor |
|---------|-------|
| Investimento | $29,100 |
| Custos fixos/mês | $75 |
| Clientes break-even | **5-6 clínicas** |
| Tempo break-even | **2 meses** |

---

## 5. Riscos e Mitigações (30 Itens)

### 5.1 Técnicos (5)

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| WhatsApp Web mudar estrutura | Alta | Alto | Playwright + wcli como fallback; monitorar semanalmente |
| Ban de número por automação | Média | Alto | Rate limiting humano-like; warm-up; pool de backup |
| Claude API mudar/descer | Baixa | Alto | Abstração LLM com múltiplos providers |
| Playwright quebrar em update | Média | Médio | Lock de versão; smoke tests; alertas |
| Memory leak em sessões longas | Média | Médio | Restart periódico; health checks |

### 5.2 Negócio (5)

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Cliente não pagar setup | Média | Médio | 50% upfront; demo completa antes |
| Churn alto após 3 meses | Média | Alto | Onboarding robusto; health score |
| Concorrente copiar modelo | Alta | Baixo | Moat técnico; velocidade; GPCT |
| Scope creep no MVP | Alta | Alto | Freeze após Sprint 1; change request |
| Preço percebido como alto | Média | Médio | ROI calculator; demo com números reais |

### 5.3 Operacionais (4)

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Sobrecarga de suporte | Alta | Médio | Docs; chatbot help; Loom tutorials |
| Bug em produção sem rollback | Média | Alto | CI/CD com rollback; staging; feature flags |
| Vazamento de dados/LGPD | Baixa | Muito Alto | RLS; criptografia; logs auditoria |
| Funcionário chave sair | Baixa | Alto | Docs completas; cross-training |

### 5.4 Mercado (4)

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Meta bloquear automação | Média | Alto | Híbrido API + Web; compliance ToS |
| Recessão econômica | Baixa | Médio | Pricing flexível; foco em economia |
| IA regulamentação | Baixa | Médio | Transparência; opt-out; compliance |
| Google/Meta lançar similar | Baixa | Médio | Nicho clínicas; personalização |

### 5.5 Agente IA (5)

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Alucinação em resposta médica | Média | Muito Alto | Disclaimer; não diagnóstico; escalar humano |
| Contexto perdido em conversa longa | Média | Médio | Checkpoint a cada 10 turnos; resumo |
| Não entender gírias regionais | Média | Baixo | Fine-tuning BR; fallback clarificação |
| Resposta inapropriada | Baixa | Alto | Guardrails output; moderação; logs |
| Clonagem de voz indevida | Baixa | Muito Alto | Consentimento; watermark; logs uso |

### 5.6 Integração (4)

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Sistema legado sem API | Alta | Médio | MCP custom; planilha fallback |
| Migração perder dados | Média | Alto | Backup; validação; rollback plan |
| Formato incompatível | Média | Médio | Camada transformação; schemas flexíveis |
| Cliente não dar acesso | Baixa | Médio | Demo segurança; termo confidencialidade |

### 5.7 Modelo Custos (3)

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Cliente reclamar custo variável | Média | Médio | Dashboard consumo; alertas; pacotes pré-pagos |
| Uso abusivo tokens | Baixa | Médio | Rate limiting; alertas anômalos; ToS |
| Custo Claude subir | Média | Médio | Contrato preço fixo; buffer; múltiplos providers |

---

## 7. Diagramas Visuais

### 7.1 Arquitetura do Sistema (4+1 Multi-Agent)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ARQUITETURA SYNKROO v2.0                         │
│                    4+1 Multi-Agent com Lazy Activation                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                        CANAIS DE ENTRADA                             │ │
│  │                                                                      │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │ │
│  │  │ WhatsApp  │  │ Instagram │  │   Chat    │  │  Telefone │        │ │
│  │  │   Web     │  │    DM     │  │  Widget   │  │   (Pós)   │        │ │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘        │ │
│  └────────┼──────────────┼──────────────┼──────────────┼───────────────┘ │
│           │              │              │              │                 │
│           └──────────────┴──────┬───────┴──────────────┘                 │
│                                   │                                       │
│  ┌────────────────────────────────▼────────────────────────────────────┐ │
│  │                     ORCHESTRATOR AGENT                               │ │
│  │                                                                      │ │
│  │   • Coordena todos os agentes (sempre ativo)                        │ │
│  │   • Gerencia estado da sessão                                       │ │
│  │   • Decide quando escalar para humano                               │ │
│  │   • Monitora qualidade e performance                                │ │
│  │                                                                      │ │
│  └────────────────────────────────┬─────────────────────────────────────┘ │
│                                   │                                       │
│  ┌────────────────────────────────▼────────────────────────────────────┐ │
│  │                        ROUTER AGENT                                  │ │
│  │                       (SEMPRE ATIVO)                                 │ │
│  │                                                                      │ │
│  │   ┌─────────────────────────────────────────────────────────────┐   │ │
│  │   │  • Classifica intenção (confidence score 0-1)               │   │ │
│  │   │  • Confidence >= 0.8 → Resolve diretamente                  │   │ │
│  │   │  • Confidence < 0.8 → Delega para especialista              │   │ │
│  │   │  • Identifica paciente e carrega contexto                    │   │ │
│  │   │  • Gerencia roteamento entre agentes                        │   │ │
│  │   └─────────────────────────────────────────────────────────────┘   │ │
│  │                                   │                                   │ │
│  │           ┌───────────────────────┼───────────────────────┐         │ │
│  │           ▼                       ▼                       ▼         │ │
│  │   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐  │ │
│  │   │  SCHEDULER  │         │    SALES    │         │ GENERALIST  │  │ │
│  │   │   (LAZY)    │         │   (LAZY)    │         │   (LAZY)    │  │ │
│  │   ├─────────────┤         ├─────────────┤         ├─────────────┤  │ │
│  │   │ • Agendar   │         │ • Orçamentos│         │ • FAQs      │  │ │
│  │   │ • Reagendar │         │ • Promoções │         │ • RAG       │  │ │
│  │   │ • Cancelar  │         │ • Conversão │         │ • Geral     │  │ │
│  │   │ • Lembretes │         │ • Follow-up │         │             │  │ │
│  │   └─────────────┘         └─────────────┘         └─────────────┘  │ │
│  │                                   │                                   │ │
│  │   LAZY ACTIVATION: Especialistas só invocados quando necessário    │ │
│  │                                   │                                   │ │
│  └───────────────────────────────────┼───────────────────────────────────┘ │
│                                      │                                     │
│  ┌───────────────────────────────────▼───────────────────────────────────┐ │
│  │                          MCP SERVERS                                   │ │
│  │                                                                        │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │ │
│  │  │ calendar │ │ whatsapp │ │ patients │ │ postgres │ │filesystem│    │ │
│  │  │   mcp    │ │   mcp    │ │   mcp    │ │   mcp    │ │   mcp    │    │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │ │
│  └───────────────────────────────────┬───────────────────────────────────┘ │
│                                      │                                     │
│  ┌───────────────────────────────────▼───────────────────────────────────┐ │
│  │                    5-LAYER MEMORY SYSTEM                               │ │
│  │                                                                        │ │
│  │  L1: Session (Redis, <5ms)    - Contexto ativo                       │ │
│  │  L2: Patient (Postgres, <50ms) - Dados estruturados                  │ │
│  │  L3: Clinic (Postgres)         - Configurações                        │ │
│  │  L4: Conversational (Postgres) - Histórico                            │ │
│  │  L5: Episodic/RAG (pgvector)   - Base de conhecimento                 │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐│
│  │                    SUPABASE (PostgreSQL + pgvector)                   ││
│  │                                                                        ││
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               ││
│  │   │   clinics    │  │   patients   │  │ appointments │               ││
│  │   └──────────────┘  └──────────────┘  └──────────────┘               ││
│  │                                                                        ││
│  │   + pgvector (RAG)  + RLS (Multi-tenant)  + Realtime                  ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Ver spec completo:** `docs/superpowers/specs/2026-03-25-agent-design.md`

### 7.2 Fluxo de Agendamento

```
┌───────────────────────────────────────────────────────────────────────────┐
│                      FLUXO DE AGENDAMENTO COM AGENTE                       │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1. PACIENTE ENVIA MENSAGEM                                               │
│     │                                                                      │
│     │  "Oi, quero agendar uma consulta"                                   │
│     │                                                                      │
│     ▼                                                                      │
│  2. ROUTER AGENT PROCESSA                                                 │
│     │                                                                      │
│     ├── Identifica intenção: SCHEDULING                                   │
│     ├── Busca paciente no banco (por telefone)                            │
│     ├── Se não existe → Cria temporário                                   │
│     └── Delega para Scheduling Agent                                      │
│     │                                                                      │
│     ▼                                                                      │
│  3. SCHEDULING AGENT EXECUTA                                              │
│     │                                                                      │
│     ├── Pergunta procedimento                                              │
│     ├── Pergunta profissional                                              │
│     ├── Verifica disponibilidade (MCP calendar)                           │
│     ├── Oferece opções                                                     │
│     └── Aguarda escolha                                                    │
│     │                                                                      │
│     ▼                                                                      │
│  4. CONFIRMAÇÃO                                                            │
│     │                                                                      │
│     ├── Cria registro em appointments                                     │
│     ├── Envia confirmação via WhatsApp                                    │
│     ├── Agenda lembrete 24h antes                                         │
│     └── Agenda lembrete 2h antes                                          │
│     │                                                                      │
│     ▼                                                                      │
│  5. PÓS-AGENDAMENTO                                                       │
│     │                                                                      │
│     ├── 24h antes: Envia lembrete                                         │
│     ├── 2h antes: Envia lembrete                                          │
│     ├── Se não confirmar → Follow-up                                      │
│     └── Se confirmar → Aguarda consulta                                   │
│     │                                                                      │
│     ▼                                                                      │
│  6. PÓS-CONSULTA                                                           │
│     │                                                                      │
│     ├── Follow-up automático (1 dia depois)                               │
│     ├── Pesquisa de satisfação                                            │
│     └── Próximos passos (retorno, tratamento)                             │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Arquitetura Multi-Tenant

```
┌───────────────────────────────────────────────────────────────────────────┐
│                      MULTI-TENANT ARCHITECTURE                              │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         REQUEST                                      │  │
│  │                                                                      │  │
│  │   Headers: { "x-clinic-id": "clinic-uuid-123" }                     │  │
│  │   ou Session: { clinic_id: "clinic-uuid-123" }                      │  │
│  │                                                                      │  │
│  └────────────────────────────────┬────────────────────────────────────┘  │
│                                   │                                        │
│                                   ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      MIDDLEWARE                                      │  │
│  │                                                                      │  │
│  │   SET app.current_clinic = 'clinic-uuid-123'                        │  │
│  │                                                                      │  │
│  └────────────────────────────────┬────────────────────────────────────┘  │
│                                   │                                        │
│                                   ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                   POSTGRESQL + RLS                                   │  │
│  │                                                                      │  │
│  │   ┌───────────────────────────────────────────────────────────────┐ │  │
│  │   │  POLICY: clinic_isolation                                      │ │  │
│  │   │                                                                │ │  │
│  │   │  USING (clinic_id = current_setting('app.current_clinic'))   │ │  │
│  │   │                                                                │ │  │
│  │   └───────────────────────────────────────────────────────────────┘ │  │
│  │                                                                      │  │
│  │   Resultado: Query automaticamente filtrada por clinic_id          │  │
│  │                                                                      │  │
│  │   SELECT * FROM patients;                                           │  │
│  │   -- Internamente: SELECT * FROM patients                          │  │
│  │   -- WHERE clinic_id = 'clinic-uuid-123';                          │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                   ISOLAMENTO VISUAL                                  │  │
│  │                                                                      │  │
│  │   Clínica A (Odonto Sorriso)      Clínica B (Estética Bella)       │  │
│  │   ┌─────────────────────┐        ┌─────────────────────┐           │  │
│  │   │ patients: 150       │        │ patients: 80        │           │  │
│  │   │ appointments: 500   │        │ appointments: 300   │           │  │
│  │   │ conversations: 2K   │        │ conversations: 1K   │           │  │
│  │   └─────────────────────┘        └─────────────────────┘           │  │
│  │                                                                      │  │
│  │   ✅ Dados 100% isolados                                            │  │
│  │   ✅ Zero possibilidade de vazamento                                │  │
│  │   ✅ Performance individual por clínica                             │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Sistema de Memória do Agente (5 Camadas)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                      MEMORY ARCHITECTURE (5 LAYERS)                        │
│                    Otimizado para Latência e Contexto                      │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  LAYER 1: SESSION CACHE (Redis)                                     │  │
│  │                                                                      │  │
│  │  • TTL: 24 horas                                                    │  │
│  │  • Latência: <5ms                                                   │  │
│  │  • Uso: Conversa ativa, contexto imediato                           │  │
│  │  • Estrutura: {session_id, last_20_messages, current_intent,       │  │
│  │                agent_state, pending_actions}                        │  │
│  │  • Invalidação: On session end ou TTL                               │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  LAYER 2: PATIENT MEMORY (PostgreSQL)                               │  │
│  │                                                                      │  │
│  │  • TTL: Permanente                                                  │  │
│  │  • Latência: <50ms                                                  │  │
│  │  • Uso: Dados estruturados do paciente, preferências               │  │
│  │  • Estrutura: patients, patient_preferences, patient_risk_scores   │  │
│  │  • Inclui: histórico médico, tratamentos, preferências de agendamento│  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  LAYER 3: CLINIC KNOWLEDGE (PostgreSQL)                             │  │
│  │                                                                      │  │
│  │  • TTL: Permanente (atualizado pela clínica)                        │  │
│  │  • Latência: <50ms                                                  │  │
│  │  • Uso: Configurações, horários, profissionais, procedimentos      │  │
│  │  • Estrutura: clinic_settings, dentists, procedures, schedule_blocks│  │
│  │  • Personalidade: Templates de tom e estilo por clínica             │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  LAYER 4: CONVERSATIONAL MEMORY (PostgreSQL)                        │  │
│  │                                                                      │  │
│  │  • TTL: Permanente                                                  │  │
│  │  • Latência: <100ms                                                 │  │
│  │  • Uso: Histórico de conversas, padrões de comunicação             │  │
│  │  • Estrutura: conversations (particionada por mês)                  │  │
│  │  • Busca: Semântica via pgvector                                    │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  LAYER 5: EPISODIC/RAG (PostgreSQL + pgvector + HNSW)              │  │
│  │                                                                      │  │
│  │  • TTL: Permanente                                                  │  │
│  │  • Latência: <150ms (HNSW search)                                  │  │
│  │  • Uso: Base de conhecimento clínica, protocolos, FAQs             │  │
│  │  • Estrutura: knowledge_base (chunks com embeddings)               │  │
│  │  • Versionamento: 10 versões retidas, rollback habilitado           │  │
│  │  • Gap Detection: Alertas para lacunas de conhecimento             │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  FLUXO DE RECUPERAÇÃO (Memory Retrieval):                                 │
│                                                                            │
│  1. Chegou mensagem → L1 Session Cache (últimas 20)                       │
│  2. Precisa dados paciente → L2 Patient Memory                            │
│  3. Precisa configuração clínica → L3 Clinic Knowledge                    │
│  4. Precisa mais contexto → L4 Conversational (busca semântica)           │
│  5. Precisa informação clínica → L5 RAG (knowledge_base)                  │
│                                                                            │
│  PERFORMANCE TARGETS:                                                      │
│  ├── L1: <5ms (hot cache)                                                 │
│  ├── L2-L3: <50ms (indexed queries)                                       │
│  ├── L4: <100ms (semantic search)                                         │
│  └── L5: <150ms (HNSW vector search)                                      │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

**Ver spec completo:** `docs/superpowers/specs/2026-03-25-agent-design.md`

---

## 8. Especificação do Agente IA (4+1 Multi-Agent)

### 8.1 Arquitetura

| Agente | Estado | Função | Ativação |
|--------|--------|--------|----------|
| **Orchestrator** | Sempre ativo | Coordena agentes, gerencia sessão | - |
| **Router** | Sempre ativo | Classifica intenção, roteia | - |
| **Scheduler** | Lazy | Agendamento, reagendamento, cancelamento | Confidence < 0.8 para scheduling |
| **Sales** | Lazy | Vendas, orçamentos, conversão | Confidence < 0.8 para sales |
| **Generalist** | Lazy | FAQs, informações gerais, RAG | Confidence < 0.8 para geral |

### 8.2 Níveis de Risco de Ações

| Nível | Score | Ação | Exemplos |
|-------|-------|------|----------|
| **BAIXO** | 0-30 | Auto-executar | Listar horários, enviar lembrete, responder FAQ |
| **MÉDIO** | 31-60 | Confirmação simples | Agendar, reagendar, cancelar |
| **ALTO** | 61-100 | Dupla confirmação | Cancelar com reembolso, excluir paciente |

### 8.3 Personalidade Templates

| Template | Tom | Uso |
|----------|-----|-----|
| **Odonto Formal** | Profissional, respeitoso | Clínicas odontológicas tradicionais |
| **Estética Acolhedora** | Caloroso, empolgante | Clínicas de estética |
| **Fisio Prática** | Direto, objetivo | Clínicas de fisioterapia |
| **Custom** | Personalizado | Configuração pelo cliente |

### 8.4 Documentação Completa

Ver especificação detalhada em: `docs/superpowers/specs/2026-03-25-agent-design.md`

Inclui:
- Configurações de cada agente
- Sistema de memória 5 camadas
- 10 ações executáveis
- Smart triggers e priorização
- Sistema de undo/rollback
- Versionamento de conhecimento
- Explainability e logs de decisão

---

## 9. Próximos Passos

### Imediato
1. [ ] Aprovar PRD v3.1
2. [ ] Criar repositório Synkroo
3. [ ] Setup inicial do projeto

### Após Aprovação
4. **UX Design** - `bmad-create-ux-design`
5. **Arquitetura Técnica** - `bmad-create-architecture`
6. **Epics e Stories** - `bmad-create-epics-and-stories`

---

**Aprovado por:** _________________
**Data:** _________________