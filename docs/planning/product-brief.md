# Product Brief: Synkroo

**Versão:** 2.1 - Synkroo Edition
**Data:** 2026-03-24
**Autor:** Walis (com BMAD Master Mentor)
**Status:** ✅ Atualizado - Sincronizado com PRD v3.1

---

## Executive Summary

**Synkroo** é muito mais que um sistema de agendamento — é uma **plataforma de automação empresarial completa** construída sobre agentes SDK Claude que revoluciona como clínicas operam, vendem e escalam.

**O Problema Real:** Clínicas estão presas em um modelo operacional quebrado — dependem de funcionários que adoece, erra, tira férias, e se sobrecarrega tentando gerenciar WhatsApp, Instagram, telefone, email, agendamentos, follow-up, vendas e marketing tudo manualmente. O custo oculto é enorme: no-show de 30-40%, leads perdidos por demora na resposta, pacientes que abandonam tratamento por falta de follow-up, e receituários que nunca são cobrados.

**Nossa Solução:** Um ecossistema de agentes IA autônomos que não apenas "atendem", mas **gerenciam todo o ciclo de vida do paciente** — desde a primeira interação até a retenção de longo prazo. O agente pode marcar consultas, enviar lembretes, fazer follow-up pós-procedimento, recuperar leads abandonados, criar campanhas de reativação, postar nas redes sociais, e até preencher formulários e odontogramas. E tudo isso com memória persistente que lembra cada detalhe de cada paciente.

**O Diferencial Incomparável:** Enquanto concorrentes oferecem chatbots com árvore de decisão que alucinam e esquecem tudo, usamos o **Claude SDK** para criar agentes verdadeiramente inteligentes que:
- Mantêm contexto de conversas passadas
- Aprendem com cada interação via RAG
- Podem operar sistemas externos (MCPs)
- Executam tarefas no computador do cliente
- Funcionam 24/7 sem degradar

**Modelo de Negócio Único:** Não vendemos SaaS genérico. Vendemos **serviço personalizado** com metodologia GPCT — duas reuniões onde entendemos profundamente a dor do cliente e apresentamos uma solução que parece feita exclusivamente para ele. O cliente paga pelo que usa (modular), mas nosso sistema completo está pronto para escalar.

---

## The Problem - Análise Profunda

### 1. A Falácia do Funcionamento Atual

**O Custo Oculto do Modelo Tradicional:**

Clínicas operam com uma estrutura que parece barata mas é extremamente cara:

| Custo Visível | Custo Oculto |
|---------------|--------------|
| Salário atendente R$1.500-3.000 | Erros que perdem pacientes |
| Encargos ~40% | No-show 30-40% = R$5-15k/mês perdido |
| Treinamento | Férias/cobertura = queda de qualidade |
| | Doença = atendimento para |
| | Turnover = recomeço do zero |
| | Hora extra = sobrecarga crônica |
| | **Total real: R$8-20k/mês por atendente** |

### 2. A Fragmentação Sistêmica

**O que uma clínica usa HOJE:**

```
┌─────────────────────────────────────────────────────────┐
│                    CLÍNICA ATUAL                        │
├─────────────────────────────────────────────────────────┤
│ WhatsApp ──────► Funcionário responde manual           │
│ Instagram ─────► Funcionário responde manual           │
│ Telefone ──────► Funcionário atende                    │
│ Agendamento ───► Sistema separado (Feegow, Doctoralia) │
│ Planos saúde ──► Sistema do convênio                   │
│ Email ─────────► Caixa de entrada caótica              │
│ Follow-up ─────► NÃO EXISTE                            │
│ Marketing ─────► NÃO EXISTE                            │
│ Recall ────────► NÃO EXISTE                            │
│ Vendas ────────► Intuição do dono                      │
│ Pós-venda ─────► "Boa sorte paciente"                  │
└─────────────────────────────────────────────────────────┘
         │
         ▼
   Dados espalhados, erros duplicados, zero inteligência
```

**Consequências mensuráveis:**
- **Leads perdidos:** 60% dos leads que chegam depois das 18h não são respondidos
- **No-show:** 30-40% das consultas confirmadas não aparecem
- **Abandono:** 50% dos pacientes abandonam tratamento no meio
- **Inadimplência:** 20-30% dos procedimentos não são pagos
- **Inatividade:** Pacientes que sumiram há meses e ninguém lembrou

### 3. O Falso Promessa dos "Chatbots de IA"

O mercado oferece "soluções de IA" que são:

| O que Vendem | O que Entregam |
|--------------|----------------|
| "IA conversacional" | Árvore de decisão com 5 opções |
| "Atendimento 24/7" | Bot que não entende nada fora do script |
| "Memória" | Não lembra nem o nome do paciente |
| "Inteligência" | Alucina quando perguntam algo diferente |
| "Automação" | Precisa de manutenção toda semana |

**Resultado:** Clínicas pagam caro por algo que frustra pacientes e exige intervenção humana constante.

### 4. As Dores que Ninguém Resolve

**Dores Operacionais:**
- Funcionário adoece → atendimento para
- Funcionário pede demissão → caos total
- Sobrecarga → má disposição com paciente
- Erro humano → consulta marcada errada, dado perdido
- Férias → queda de qualidade ou custo de substituto

**Dores de Vendas:**
- Leads chegam e não são convertidos
- Paciente pergunta preço e some (sem follow-up)
- Orçamento enviado e esquecido
- Concorrente atende mais rápido e ganha o paciente

**Dores de Retenção:**
- Paciente faz primeira consulta e nunca mais volta
- Tratamento interrompido por falta de lembrete
- Pós-procedimento sem orientação = insatisfação
- Paciente inativo há 1 ano e ninguém notou

**Dores de Marketing:**
- Não sabem fazer campanhas
- Instagram parado
- Google Meu Negócio negligenciado
- Dependem 100% de indicação

---

## The Solution - Arquitetura Completa

### Visão Geral da Plataforma

```
┌────────────────────────────────────────────────────────────────────┐
│                    CLÍNICA AI PLATFORM                             │
│                    "Um Agente, Toda a Clínica"                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   ┌─────────────────────────────────────────────────────────────┐ │
│   │              ORQUESTADOR DE AGENTES CLAUDE                  │ │
│   │   "O Cérebro que gerencia toda a operação da clínica"      │ │
│   └─────────────────────────────────────────────────────────────┘ │
│                              │                                     │
│         ┌────────────────────┼────────────────────┐               │
│         ▼                    ▼                    ▼               │
│   ┌──────────┐        ┌──────────┐        ┌──────────┐          │
│   │ CANAIS   │        │ TAREFAS  │        │ INTELI-  │          │
│   │          │        │          │        │ GÊNCIA   │          │
│   ├──────────┤        ├──────────┤        ├──────────┤          │
│   │WhatsApp  │        │Agendamen.│        │RAG       │          │
│   │Instagram │        │Follow-up │        │Memória   │          │
│   │Telegram  │        │Lembretes │        │Pesquisa  │          │
│   │Email     │        │CRM       │        │Contexto  │          │
│   │SMS       │        │Vendas    │        │          │          │
│   │Telefone  │        │Marketing │        │          │          │
│   └──────────┘        └──────────┘        └──────────┘          │
│                                                                    │
│   ┌─────────────────────────────────────────────────────────────┐ │
│   │                    DASHBOARD DO DONO                        │ │
│   │   "O que meu sistema está fazendo por mim HOJE?"           │ │
│   │   • Agendamentos do dia  • Leads capturados  • Receita     │ │
│   │   • No-show evitados     • Follow-ups feitos  • ROI        │ │
│   └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│   ┌─────────────────────────────────────────────────────────────┐ │
│   │                   CHAT INTERATIVO                           │ │
│   │   Humano: "Agende João para amanhã às 14h"                 │ │
│   │   Agente: "Feito! Confirmei com João via WhatsApp."        │ │
│   └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Módulos Completos do Sistema

#### MÓDULO 1: Atendimento Multicanal 24/7

**Cobertura:**
- WhatsApp (API oficial + Playwright híbrido)
- Instagram DM
- Telegram
- Email
- SMS
- Telefone (call center IA)

**Capacidades:**
- Resposta instantânea a qualquer hora
- Classificação de intenção (agendamento, dúvida, emergência)
- Escalação inteligente para humano quando necessário
- Memória de cada paciente — não precisa repetir informações

#### MÓDULO 2: Gestão de Agendamentos

**Funcionalidades:**
- Agendamento inteligente (verifica disponibilidade em tempo real)
- Confirmação automática 24h antes
- Lembrete 2h antes
- Reagendamento proativo quando paciente cancela
- Lista de espera automática
- Gerenciamento de múltiplos profissionais

**Inteligência:**
- Detecta padrões de no-show por paciente
- Sugere horários baseado em histórico
- Otimiza agenda para minimizar buracos

#### MÓDULO 3: Follow-up e Retenção

**Jornadas Automatizadas:**
- Pós-consulta: "Como foi sua experiência?"
- Pós-procedimento: Orientações personalizadas
- Tratamento incompleto: Lembrete de continuidade
- Paciente inativo 30/60/90 dias: Campanha de reativação
- Aniversário: Mensagem personalizada
- Pós-orçamento: Acompanhamento de conversão

**Recuperação de Receita:**
- Identifica orçamentos não convertidos
- Sequência de follow-up para fechamento
- Lembretes de tratamento pendente
- Aviso de inadimplência

#### MÓDULO 4: CRM Inteligente

**Cadastro Rico:**
- Dados demográficos
- Histórico de atendimentos
- Preferências e observações
- Tratamentos em andamento
- Valor de vida (LTV)
- Score de engajamento

**Ações Inteligentes:**
- Segmentação automática por comportamento
- Tags dinâmicas baseadas em interações
- Alertas de pacientes em risco de churn
- Sugestões de upsell/cross-sell

#### MÓDULO 5: Vendas e Conversão

**Pipeline de Vendas:**
- Captação de leads via canais
- Qualificação automática
- Agendamento de avaliação
- Follow-up pós-orçamento
- Fechamento assistido

**Ferramentas:**
- Templates de proposta
- Calculadora de procedimentos
- Comparativo de opções
- Financiamento/parcelamento

#### MÓDULO 6: Marketing e Redes Sociais

**Automação de Marketing:**
- Campanhas de captação
- Sequências de nutrição
- Postagens automáticas no Instagram
- Google Meu Negócio otimizado
- Tráfego pago (integração Meta Ads)

**Conteúdo:**
- Geração de posts com IA
- Stories automatizados
- Resposta a comentários
- Monitoramento de menções

#### MÓDULO 7: Call Center com IA

**Capacidades:**
- Ligações outbound (lembretes, follow-up, reativação)
- Inbound (triagem, agendamento, dúvidas)
- Transcrição em tempo real
- Análise de sentimento
- Integração com CRM

**Vantagens:**
- 100% das ligações registradas
- Escala infinita
- Custo 90% menor que call center tradicional
- Disponível 24/7

#### MÓDULO 8: Operações Especiais

**Odontologia:**
- Odontograma inteligente
- Proposta de tratamento visual
- Orientações pós-procedimento específicas

**Geral:**
- Preenchimento de formulários
- Integração com sistemas externos (via MCP)
- Relatórios automáticos
- Compliance LGPD

---

## What Makes This Different - Moat Análise

### 1. Moat Técnico: Claude SDK + MCPs

**O que outros não podem copiar facilmente:**

| Nossa Capacidade | Barreira para Copiar |
|------------------|----------------------|
| Agente verdadeiramente inteligente | Requer expertise em LLMs + engenharia de prompts avançada |
| Memória persistente e contextual | Arquitetura complexa de AgentDB + RAG |
| Execução de tarefas externas | Conhecimento de MCPs + integração |
| Playwright + WhatsApp Web híbrido | Engenharia reversa + manutenção constante |

### 2. Moat de Produto: Ecossistema Completo

**Outros resolvem UM problema. Nós resolvemos TODOS.**

```
Concorrente A: WhatsApp bot        → 1 funcionalidade
Concorrente B: Sistema agendamento → 1 funcionalidade
Concorrente C: CRM                 → 1 funcionalidade

NÓS: WhatsApp + Instagram + Telegram + Email + SMS + Telefone
     + Agendamento + CRM + Follow-up + Marketing + Vendas
     + Call Center + RAG + Memória + MCPs + Dashboards
     = 50+ funcionalidades integradas
```

### 3. Moat de Modelo: Serviço Personalizado

**Enquanto SaaS é commodity:**

| SaaS Tradicional | Nosso Modelo |
|------------------|---------------|
| Self-service genérico | Projeto personalizado |
| "Use como está" | "Adaptamos para você" |
| Suporte por ticket | Consultor dedicado |
| Cancelamento fácil | Relação de longo prazo |
| Preço fixo, valor variável | Valor fixo, preço proporcional |

### 4. Moat de Execução: Claude Code + BMAD

**Velocidade de desenvolvimento:**

| Métrica | Tradicional | Com Claude Code + BMAD |
|---------|-------------|------------------------|
| MVP completo | 6 meses | 1 mês |
| Qualidade | Variável | Metodologia estruturada |
| Documentação | Depois (ou nunca) | Paralela ao desenvolvimento |
| Iteração | Lenta | Contínua |

---

## Who This Serves - Persona Detalhada

### Persona Primária: Clínicas Odontológicas de Pequeno/Médio Porte

**Perfil Demográfico:**
- 1-5 dentistas
- 1-2 atendentes (frequentemente só 1)
- 50-200 pacientes ativos
- Faturamento R$30-150k/mês

**Perfil Psicográfico:**
- Dono trabalha na operação (não só gestão)
- Preocupa-se com cada real gasto
- Sente-se sobrecarregado
- Sabe que precisa de tecnologia mas não entende
- Frustrado com sistemas complicados

**Cenário Típico:**

> *"Tenho uma clínica com 3 cadeiras, 2 dentistas e 1 atendente. Minha atendente Maria cuida de tudo: WhatsApp, Instagram, telefone, agendamento, recebimento. Ela é ótima, mas é só uma pessoa. Quando ela adoeceu semana passada, foi um caos. Perdi 3 pacientes que marcaram e eu esqueci de confirmar. Tenho um sistema de agendamento mas é tão complicado que acabo usando caderno também. Sei que estou perdendo dinheiro com pacientes que não voltam, mas não tenho tempo de ligar para todo mundo. Preciso de algo que funcione."*

### Jornada de Compra

**Estágio 1 - Despertar:**
- Agente SDR contato via Instagram/WhatsApp
- Mensagem personalizada: "Vi que sua clínica tem 4.8 estrelas no Google, parabéns! Você já pensou em ter um atendente que funciona 24h e nunca adoece?"

**Estágio 2 - Interesse:**
- Agendamento de reunião
- Curiosidade sobre "agente de IA"

**Estágio 3 - Avaliação:**
- Reunião GPCT (descoberta)
- Demo do agente funcionando
- Métricas de ROI

**Estágio 4 - Decisão:**
- Proposta personalizada
- Referências/cases
- Implementação agendada

---

## Success Criteria - KPIs Detalhados

### KPIs de Impacto no Cliente (30-60 dias)

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Taxa de no-show | 30-40% | <15% | -60% |
| Tempo resposta lead | 4-8h | <5min | -95% |
| Follow-up pós-consulta | 0% | 100% | ∞ |
| Pacientes reativados/mês | 0-2 | 10-30 | +1000% |
| Taxa de confirmação | 50% | 90% | +80% |
| Leads convertidos | 20% | 35% | +75% |

### KPIs Financeiros do Cliente

| Métrica | Cálculo | Meta |
|---------|---------|------|
| ROI mensal | (Receita incremental - Custo plataforma) / Custo plataforma | >300% |
| LTV recuperado | Pacientes inativos × Ticket médio | R$5-15k/mês |
| Economia de pessoal | Horas economizadas × Valor hora | R$2-5k/mês |

### KPIs do Negócio

| Métrica | 6 meses | 12 meses | 24 meses |
|---------|---------|----------|----------|
| Clientes ativos | 15-20 | 50-70 | 150-200 |
| MRR | R$15-30k | R$50-100k | R$150-300k |
| NPS | >50 | >60 | >70 |
| Churn | <15% | <10% | <5% |
| CAC Payback | <3 meses | <2 meses | <1 mês |

---

## Scope - Roadmap Detalhado

### FASE 1: MVP (Sprint 1-4 | 4 semanas)

**Objetivo:** Primeira clínica piloto rodando e validada

**Funcionalidades:**

| Módulo | Feature | Prioridade |
|--------|---------|------------|
| **Atendimento** | WhatsApp Business API | P0 |
| | Instagram DM | P0 |
| | Resposta automática 24/7 | P0 |
| | Memória de conversa | P0 |
| **Agendamento** | Marcar/desmarcar/reagendar | P0 |
| | Verificação disponibilidade | P0 |
| | Confirmação automática (24h) | P0 |
| | Lembrete automático (2h) | P0 |
| **Follow-up** | Sequência pós-consulta | P0 |
| | Recuperação de no-show | P0 |
| **Gestão** | Dashboard básico | P0 |
| | Gerenciamento conversas | P0 |
| | Gerenciamento usuários | P0 |
| | CRM básico (cadastro paciente) | P0 |

**Exclusões:**
- Telegram
- Call center IA
- RAG avançado
- Marketing automation
- Tráfego pago

**Entregável:**
- 1 clínica piloto ativa
- Métricas de validação coletadas
- Cases de uso documentados

### FASE 2: Consolidação (Sprint 5-8 | 4 semanas)

**Objetivo:** 5-10 clínicas ativas, sistema robusto

**Novas Funcionalidades:**

| Feature | Descrição |
|---------|-----------|
| Telegram | Canal adicional |
| RAG básico | Base de conhecimento da clínica |
| Templates | Mensagens personalizáveis |
| Multi-tenant | Arquitetura para múltiplas clínicas |
| Dashboard avançado | Métricas e relatórios |
| Onboarding automatizado | Setup self-service |

### FASE 3: Expansão (Sprint 9-16 | 8 semanas)

**Novas Funcionalidades:**

| Feature | Descrição |
|---------|-----------|
| Call Center IA | Ligações inbound/outbound |
| Marketing automation | Campanhas, sequências |
| Tráfego pago | Integração Meta Ads |
| Email/SMS | Canais adicionais |
| RAG avançado | Histórico completo |
| App mobile | Para donos em movimento |

### FASE 4: Scale (Ongoing)

- Expansão para estética, fisioterapia
- API para parceiros
- Programa de referral
- Franquia branca

---

## Vision - Estratégia de Longo Prazo

### Ano 1: Domínio em Odontologia

**Objetivos:**
- 50+ clínicas odontológicas ativas
- R$50-100k MRR
- NPS > 60
- 3+ cases de sucesso documentados
- Prova de conceito validada

### Ano 2: Expansão Vertical

**Objetivos:**
- Entrada em estética (ticket alto, marketing-driven)
- Entrada em fisioterapia (volume alto, recorrência)
- 150-200 clientes totais
- R$150-300k MRR
- Time de 5-10 pessoas

### Ano 3: Plataforma Horizontal

**Objetivos:**
- "Empresa referência em IA para PMEs"
- Expansão para varejo, serviços, educação
- 500+ clientes
- R$500k-1M MRR
- Programa de referral maduro (30% novos clientes via indicação)

### Visão de 5 Anos

**"Toda pequena empresa no Brasil terá acesso a um agente de IA que gerencia sua operação. E nós seremos quem entrega isso."**

---

## Business Model - Modelo Detalhado

### Estrutura de Receita

```
┌─────────────────────────────────────────────────────────────┐
│                    MODELO HÍBRIDO                          │
├─────────────────────────────────────────────────────────────┤
│                                                            │
│   SETUP FEE (único)                                       │
│   ├── Básico: R$ 3.000 - 5.000                           │
│   ├── Intermediário: R$ 5.000 - 10.000                   │
│   └── Enterprise: R$ 10.000 - 20.000                      │
│                                                            │
│   MENSALIDADE (recorrente)                                 │
│   ├── Starter (1-2 profissionais): R$ 500-800/mês         │
│   ├── Growth (3-5 profissionais): R$ 800-1.500/mês        │
│   └── Scale (6+ profissionais): R$ 1.500-3.000/mês        │
│                                                            │
│   ADD-ONS (opcionais)                                      │
│   ├── Call Center IA: +R$ 300-500/mês                     │
│   ├── Tráfego Pago: +R$ 200-400/mês                       │
│   └── Relatórios Avançados: +R$ 100-200/mês               │
│                                                            │
│   VARIÁVEIS                                                │
│   └── Custo LLM repassado ao cliente (transparência)      │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

### Calculadora de Valor

**Para clínica odontológica média:**

| Item | Valor |
|------|-------|
| No-show reduzido (30% → 10%) | +R$8.000/mês |
| Pacientes reativados (20/mês) | +R$6.000/mês |
| Leads convertidos (+15%) | +R$4.000/mês |
| Economia funcionário (parcial) | +R$1.500/mês |
| **Total benefício** | **R$19.500/mês** |
| Custo plataforma | R$1.000-1.500/mês |
| **ROI** | **1300-1950%** |

### Modelo de Vendas: GPCT

**Reunião 1 - Descoberta (30-45 min)**

```
Goal (Objetivo):
- O que você quer para sua clínica nos próximos 12 meses?
- Se pudesse resolver UM problema hoje, qual seria?

Plans (Planos):
- Como você está tentando resolver isso hoje?
- O que já tentou? O que funcionou/não funcionou?

Challenges (Desafios):
- O que está impedindo de alcançar esse objetivo?
- Quais são as consequências de não resolver?

Timeline (Prazo):
- Quando você gostaria de ver resultados?
- O que aconteceria se não fizesse nada nos próximos 6 meses?
```

**Reunião 2 - Proposta (30-45 min)**

1. Resumo do que entendemos
2. Apresentação do agente funcionando (LIVE)
3. Métricas de ROI para a clínica específica
4. Proposta personalizada
5. Próximos passos

---

## Technical Approach - Arquitetura

### Stack Tecnológica MVP (Supabase-only)

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND                                  │
│   Next.js 15 + App Router + shadcn/ui + Tailwind           │
│   Zustand + TanStack Query                                   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    SUPABASE (TUDO EM UM)                    │
│   ├── PostgreSQL 16+ (com pgvector para RAG)               │
│   ├── Auth (Row-Level Security para multi-tenant)           │
│   ├── Storage (arquivos, áudios)                            │
│   ├── Realtime (subscriptions)                               │
│   └── Edge Functions (serverless)                            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    AGENTE SDK                                │
│   @anthropic-ai/sdk + Claude Agent SDK                       │
│   ├── Router Agent (classifica e delega)                    │
│   └── Assistant Agent (executa tarefas)                     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    INTEGRAÇÕES                               │
│   ├── WhatsApp Web + Playwright (sem custo API)             │
│   ├── Instagram DM API                                       │
│   └── Chat Widget                                            │
└─────────────────────────────────────────────────────────────┘
```

> **Nota:** Stack simplificada para MVP. Versão completa com microservices documentada no Technical Research original.

### Estratégia WhatsApp Híbrida

```
┌─────────────────────────────────────────────────────────────┐
│                 WHATSAPP ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                            │
│   INBOUND (Cliente → Clínica)                              │
│   └── API Oficial Meta Cloud API                           │
│       ├── Conformidade total                               │
│       ├── Sem risco de ban                                 │
│       └── Custo por conversa                               │
│                                                            │
│   OUTBOUND (Clínica → Cliente)                             │
│   ├── Dentro de 24h: API Oficial                           │
│   └── Fora de 24h: Playwright + WhatsApp Web               │
│       ├── Simula comportamento humano                       │
│       ├── Reduz risco de ban                               │
│       ├── Sem custo de API                                 │
│       └── Manutenção contínua necessária                   │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps - Plano de Ação Imediato

### Esta Semana

| # | Ação | Responsável |
|---|------|-------------|
| 1 | Revisar e aprovar Product Brief | Walis |
| 2 | Criar repositório do projeto | Walis |
| 3 | Setup inicial Claude Code | Walis |
| 4 | Criar PRD detalhado | BMAD Master |

### Próximas 4 Semanas (MVP)

| Semana | Objetivo | Entregável |
|--------|----------|------------|
| 1 | Core + WhatsApp básico | Agente respondendo mensagens |
| 2 | Agendamento + Lembretes | Fluxo completo de marcação |
| 3 | Dashboard + Gestão | Interface para o dono |
| 4 | Piloto + Validação | 1 clínica usando |

### Após MVP

| Fase | Duração | Foco |
|------|---------|------|
| Consolidação | 4 semanas | 5-10 clínicas, refinar produto |
| Expansão | 8 semanas | Novos canais, call center, marketing |
| Scale | Contínuo | Crescimento agressivo, novos setores |

---

**Aprovado por:** _________________
**Data:** _________________

---

## Anexos

### A. Pesquisa de Mercado Completa
Ver: `docs/planning/market-research.md`

### B. Pesquisa Técnica Completa
Ver: `docs/planning/technical-research.md`

### C. Sessão de Discovery Completa
Ver: `discovery-session.md`