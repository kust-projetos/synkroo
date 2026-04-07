# Product Requirements Document (PRD)
# Clínica AI Platform

**Versão:** 3.0 - Full Vision Edition
**Data:** 2026-03-23
**Autor:** BMAD Master (com John - PM Agent)
**Status:** ✅ Aprovado - Escopo Completo Definido
**Baseado em:**
- Product Brief v2.0 (Aprovado)
- Market Research v1.0
- Technical Research v1.0
- Domain Research v1.0
- Improvements Proposal v1.0 (Aprovado)

---

## Decisões Estratégicas

| Decisão | Escolha | Impacto |
|---------|---------|---------|
| **MVP Scope** | Completo (voz + BI) | 8 semanas, diferencial forte |
| **Voz/Telefone** | Full (inbound + outbound + clonada) | Único no mercado BR |
| **Canais** | Omnichannel desde dia 1 | WA + IG + Widget + Push |
| **Multi-segmento** | Arquitetura preparada | Escalabilidade futura |
| **Integrações** | Google Calendar no MVP | Interoperabilidade imediata |

---

## Executive Summary

**Clínica AI Platform** é uma plataforma de automação empresarial completa construída sobre agentes SDK Claude que revoluciona como clínicas operam, vendem e escalam.

**Diferencial Único:** Única plataforma no Brasil com agente IA que **vê, fala e faz** - não só conversa, mas executa tarefas, atende por voz com clone da atendente da clínica, e opera de forma proativa.

**Resumo do PRD:**

| Aspecto | Detalhe |
|---------|---------|
| **Módulos** | 14 módulos funcionais (180+ requisitos) |
| **Agentes** | Router + 7 especialistas (Scheduling, Medical, Billing, Triage, Voice, Finance, Insights) |
| **Canais** | WhatsApp, Instagram, Telegram, Chat Widget, Push, Voz, Email |
| **Conformidade** | LGPD Art. 20, CFO-118/2012 |
| **MVP** | 8 semanas, 1 clínica piloto |
| **Meta 12 meses** | 50-70 clínicas, R$50-100k MRR |

**Principais Features:**
- ✅ Atendimento multicanal 24/7 com IA
- ✅ Agendamento inteligente com lembretes
- ✅ Follow-up e retenção automatizados
- ✅ CRM inteligente com memória persistente
- ✅ Pipeline de vendas automatizado
- ✅ Marketing e redes sociais
- ✅ **Call Center IA com voz clonada** ⭐ NOVO
- ✅ **Inteligência Preditiva (no-show, churn)** ⭐ NOVO
- ✅ **Gestão Financeira (PIX, cobranças)** ⭐ NOVO
- ✅ **Business Intelligence & Dashboards** ⭐ NOVO
- ✅ **Chat Widget próprio (owned channel)** ⭐ NOVO
- ✅ Conformidade LGPD completa

---

---

## 1. Informações Gerais

### 1.1 Visão do Produto

**Statement de Visão:**
> "Um agente de IA que gerencia toda a operação da clínica — do primeiro contato à retenção de longo prazo — permitindo que o dono foque no que importa: cuidar de pacientes e crescer o negócio."

**Tagline:** "Um Agente, Toda a Clínica"

### 1.2 Objetivos de Negócio

| Objetivo | Métrica | Meta 12 meses |
|----------|---------|---------------|
| Aquisição de clientes | Clínicas ativas | 50-70 |
| Receita recorrente | MRR | R$50-100k |
| Satisfação | NPS | >60 |
| Retenção | Churn mensal | <10% |
| Eficiência | CAC Payback | <3 meses |

### 1.3 Stakeholders

| Stakeholder | Papel | Interesse Principal |
|-------------|-------|---------------------|
| Walis | Fundador/Desenvolvedor | Sucesso do produto, receita |
| Comercial (1 pessoa) | Vendas | Fechamento de contratos |
| Donos de clínicas | Clientes | ROI, eficiência operacional |
| Atendentes de clínicas | Usuários | Facilidade de uso |
| Pacientes | Usuários finais | Atendimento rápido e eficaz |

### 1.4 Contexto Regulatório

**Regulamentações Brasileiras Aplicáveis:**

| Regulamentação | Requisito | Impacto no Sistema |
|----------------|-----------|-------------------|
| **CFO-118/2012** | Prontuário odontológico | Manter registros completos |
| **CFO-22/2001** | Código de Ética | Consentimento, sigilo |
| **LGPD Art. 11** | Dados sensíveis de saúde | Consentimento explícito obrigatório |
| **LGPD Art. 20** | Decisões automatizadas | Transparência, opção de revisão humana |

**Obrigações LGPD Art. 20 (Crítico para IA):**
```
├── Direito de revisão de decisões por IA
├── Transparência sobre uso de IA
├── Explicação sobre critérios utilizados
├── Opção de solicitar intervenção humana
└── Log de todas as decisões automatizadas
```

### 1.5 Benchmarks de Referência

**KPIs Operacionais do Mercado:**

| Métrica | Benchmark Brasil | Meta com Clínica AI |
|---------|------------------|---------------------|
| Taxa de no-show | 20-30% | <15% |
| Tempo resposta lead | 4-8h | <5min |
| Taxa de confirmação | 50-60% | >85% |
| Pacientes reativados/mês | 0-2 | 10-30 |
| NPS | 30-50 | >60 |

**KPIs Financeiros do Cliente:**

| Métrica | Cálculo | Referência |
|---------|---------|------------|
| Ticket médio | Receita / Consultas | R$150-400 |
| LTV paciente | Receita total do paciente | R$2.000-10.000 |
| Receita perdida no-show | Consultas não comparecidas × Ticket | R$5-15k/mês |

---

## 2. Personas

### 2.1 Persona Primária: Dr. Roberto - Dono de Clínica Odontológica

**Dados Demográficos:**
- Idade: 38-52 anos
- Escolaridade: Graduação em Odontologia + especializações
- Localização: Cidades médias e grandes (interior e capital)
- Faturamento: R$30-150k/mês
- Estrutura: 1-5 dentistas, 1-2 atendentes

**Perfil Profissional:**
- Trabalha na operação (não só gestão)
- Preocupa-se com cada real gasto
- Sente-se sobrecarregado
- Sabe que precisa de tecnologia mas não entende bem
- Frustrado com sistemas complicados

**Dores:**
- Atendente adoece = caos
- No-show de 30-40% das consultas
- Pacientes que abandonam tratamento
- Leads não convertidos
- Falta de tempo para gestão

**Objetivos:**
- Reduzir no-show pela metade
- Ter mais tempo para atender pacientes
- Aumentar receita sem aumentar custos
- Não depender de uma única pessoa

**Citação:**
> "Tenho uma clínica com 3 cadeiras, 2 dentistas e 1 atendente. Quando ela adoeceu semana passada, foi um caos. Perdi 3 pacientes que marcaram e eu esqueci de confirmar."

### 2.2 Persona Secundária: Maria - Atendente de Clínica

**Dados Demográficos:**
- Idade: 22-35 anos
- Escolaridade: Ensino médio ou superior incompleto
- Experiência: 1-5 anos em atendimento

**Responsabilidades:**
- Responder WhatsApp e Instagram
- Atender telefone
- Agendar consultas
- Receber pacientes
- Cobrar inadimplentes

**Dores:**
- Sobrecarga de funções
- Precisa fazer tudo ao mesmo tempo
- Não consegue dar atenção adequada a cada paciente
- Erros por falta de tempo
- Salário baixo para responsabilidade

**Objetivos:**
- Reduzir trabalho repetitivo
- Ter mais tempo para atendimento humanizado
- Aprender a usar ferramentas digitais

### 2.3 Persona Terciária: João - Paciente da Clínica

**Dados Demográficos:**
- Idade: 25-55 anos
- Renda: Classe B/C

**Comportamento:**
- Prefere WhatsApp para comunicação
- Responde rápido a mensagens
- Esquece de confirmações
- Procura conveniência

**Dores:**
- Demora para conseguir agendar
- Precisa ligar em horário comercial
- Esquece de consultas marcadas
- Não recebe follow-up pós-procedimento

**Objetivos:**
- Agendar rapidamente
- Ser lembrado das consultas
- Receber orientações claras

---

## 3. Jornadas do Usuário

### 3.1 Jornada de Onboarding (Dono de Clínica)

```
┌─────────────────────────────────────────────────────────────────┐
│ JORNADA DE ONBOARDING - DR. ROBERTO                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. DESCOBERTA                                                  │
│    ├── Agente SDR contata via Instagram/WhatsApp              │
│    ├── Mensagem personalizada sobre atendente IA              │
│    └── Interesse despertado                                    │
│                                                                 │
│ 2. AVALIAÇÃO                                                   │
│    ├── Reunião GPCT (30-45 min)                               │
│    │   ├── Goal: O que quer para clínica?                     │
│    │   ├── Plans: Como tenta resolver hoje?                   │
│    │   ├── Challenges: O que impede?                          │
│    │   └── Timeline: Quando quer resultados?                  │
│    └── Demo do agente funcionando (LIVE)                      │
│                                                                 │
│ 3. DECISÃO                                                     │
│    ├── Proposta personalizada                                  │
│    ├── Calculadora de ROI para sua clínica                    │
│    └── Referências de outras clínicas                         │
│                                                                 │
│ 4. IMPLEMENTAÇÃO                                               │
│    ├── Setup da conta (1-2 dias)                              │
│    ├── Integração WhatsApp Business API                       │
│    ├── Importação de pacientes                                 │
│    ├── Configuração de horários                                │
│    └── Treinamento da equipe (1 hora)                         │
│                                                                 │
│ 5. PRIMEIROS RESULTADOS                                        │
│    ├── 7 dias: Primeiros agendamentos via agente              │
│    ├── 14 dias: Redução de no-show visível                    │
│    └── 30 dias: ROI calculado e apresentado                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Jornada de Atendimento (Paciente)

```
┌─────────────────────────────────────────────────────────────────┐
│ JORNADA DO PACIENTE - JOÃO                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. PRIMEIRO CONTATO                                            │
│    João manda WhatsApp às 22h:                                 │
│    "Quero marcar uma limpeza"                                  │
│                                                                 │
│ 2. RESPOSTA INSTANTÂNEA                                        │
│    Agente responde em <30 segundos:                            │
│    "Oi João! Tudo bem? Vou te ajudar a agendar..."             │
│                                                                 │
│ 3. COLETA DE INFORMAÇÕES                                       │
│    ├── Verifica se é paciente novo ou existente                │
│    ├── Pergunta preferência de dia/hora                        │
│    └── Consulta disponibilidade em tempo real                  │
│                                                                 │
│ 4. CONFIRMAÇÃO                                                 │
│    "Tenho quarta às 14h ou quinta às 10h. Qual prefere?"       │
│    João: "Quinta 10h"                                          │
│    "Perfeito! Agendei você com Dra. Ana, quinta 10h."         │
│                                                                 │
│ 5. LEMBRETES                                                   │
│    ├── 24h antes: "João, confirmado para amanhã 10h?"         │
│    ├── 2h antes: "João, te esperamos em 2h!"                  │
│                                                                 │
│ 6. PÓS-CONSULTA                                                │
│    ├── 2h depois: "Como foi sua experiência?"                 │
│    ├── 7 dias: Lembrete de retorno (se necessário)            │
│    └── Follow-up de tratamento (se houver)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Jornada de Vendas (Dono de Clínica usando para vender)

```
┌─────────────────────────────────────────────────────────────────┐
│ JORNADA DE VENDAS - CAPTAÇÃO DE LEAD                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. LEAD CHEGA                                                  │
│    Lead via Instagram: "Qual o valor do implante?"            │
│                                                                 │
│ 2. QUALIFICAÇÃO                                                │
│    Agente:                                                      │
│    ├── Identifica intenção (alto valor)                        │
│    ├── Coleta informações básicas                               │
│    └── Oferece agendamento de avaliação                        │
│                                                                 │
│ 3. AGENDAMENTO                                                 │
│    "Para te passar um valor preciso, preciso ver seu caso.    │
│     Que tal uma avaliação gratuita?"                           │
│                                                                 │
│ 4. FOLLOW-UP PÓS-ORÇAMENTO                                     │
│    ├── Se aprovado: Parabeniza e agenda                        │
│    ├── Se não responde: Sequência de 3 toques                  │
│    └── Se recusado: Oferece alternativas                       │
│                                                                 │
│ 5. CONVERSÃO                                                   │
│    Agente acompanha até fechamento                              │
│    Notifica dono quando precisa intervir                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Jornadas por Especialidade (Domain-Specific)

#### Ortodontia (Tratamento Longo)

```
┌─────────────────────────────────────────────────────────────────┐
│ JORNADA ORTODONTIA - ACOMPANHAMENTO 1-3 ANOS                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Características:                                                │
│ ├── Tratamento de longa duração (1-3 anos)                    │
│ ├── Visitas frequentes (mensais)                               │
│ ├── Alto ticket médio (R$5-15k)                               │
│ └── Recall crítico (não comparecer = atraso tratamento)       │
│                                                                 │
│ Jornada do Agente:                                              │
│                                                                 │
│ 1. LEMBRETE MENSAL                                             │
│    "João, está na hora do seu ajuste! Quando pode?"           │
│                                                                 │
│ 2. FOLLOW-UP ELÁSTICOS/APARELHO                                │
│    7 dias pós-ajuste: "Como estão os elásticos? Lembrou de    │
│    usar?"                                                       │
│                                                                 │
│ 3. ALERTA DE NÃO COMPARECIMENTO                                │
│    Se paciente faltou: "Vi que não conseguiu vir. Precisa    │
│    remarcar? O tratamento pode atrasar..."                    │
│                                                                 │
│ 4. CAMPANHA FINALIZAÇÃO                                        │
│    80% tratamento: "Estamos quase lá! Já pensou no            │
│    aparelho de contenção?"                                      │
│                                                                 │
│ 5. REATIVAÇÃO (se abandonou)                                   │
│    60 dias sem comparecer: "Senti sua falta! Vamos            │
│    continuar seu tratamento?"                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Implantodontia (Procedimento de Alto Valor)

```
┌─────────────────────────────────────────────────────────────────┐
│ JORNADA IMPLANTODONTIA - MÚLTIPLAS ETAPAS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Características:                                                │
│ ├── Procedimentos de alto valor (R$3-10k por implante)       │
│ ├── Múltiplas etapas (avaliação, cirurgia, prótese)          │
│ └── Follow-up pós-cirúrgico crítico                           │
│                                                                 │
│ Jornada do Agente:                                              │
│                                                                 │
│ 1. PÓS-CIRURGIA (D1-D7)                                        │
│    D1: "Como está se sentindo? Lembrou dos medicamentos?"    │
│    D3: "Still good? Algum inchaço ou dor?"                    │
│    D7: "Volta para revisão amanhã! Está confirmado?"         │
│                                                                 │
│ 2. OSSEOINTEGRAÇÃO (4-6 meses)                                 │
│    Mensal: "Tudo bem? Lembre-se: não carregar o implante"    │
│                                                                 │
│ 3. PRÓTESE                                                     │
│    "Está na hora de colocar a coroa! Vamos agendar?"         │
│                                                                 │
│ 4. MANUTENÇÃO                                                  │
│    6 meses: "Retorno de controle. Como está o implante?"     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Requisitos Funcionais

### 4.1 Módulo 1: Atendimento Multicanal

#### RF-1.1 Integração WhatsApp

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-1.1.1 | Sistema deve integrar com WhatsApp Business API (Meta Cloud API) | P0 | 1 |
| RF-1.1.2 | Sistema deve receber mensagens inbound via webhook | P0 | 1 |
| RF-1.1.3 | Sistema deve enviar mensagens outbound via API | P0 | 1 |
| RF-1.1.4 | Sistema deve responder automaticamente em <5 segundos | P0 | 1 |
| RF-1.1.5 | Sistema deve manter contexto de conversa (memória de curto prazo) | P0 | 1 |
| RF-1.1.6 | Sistema deve enviar mensagens fora da janela de 24h via Playwright/WhatsApp Web | P1 | 3 |
| RF-1.1.7 | Sistema deve detectar e tratar erros de entrega | P1 | 2 |
| RF-1.1.8 | Sistema deve suportar envio de imagens e documentos | P2 | 4 |

**Critérios de Aceitação RF-1.1.1:**
```gherkin
Dado que o sistema está configurado
Quando uma mensagem é recebida no WhatsApp da clínica
Então o sistema deve processar a mensagem em menos de 5 segundos
E o sistema deve gerar uma resposta apropriada
E a resposta deve ser enviada via WhatsApp Business API
```

#### RF-1.2 Integração Instagram

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-1.2.1 | Sistema deve integrar com Instagram Graph API | P0 | 1 |
| RF-1.2.2 | Sistema deve receber DMs e comentários | P0 | 1 |
| RF-1.2.3 | Sistema deve responder automaticamente a DMs | P0 | 1 |
| RF-1.2.4 | Sistema deve responder a comentários públicos | P1 | 3 |
| RF-1.2.5 | Sistema deve respeitar janela de 24h do Instagram | P0 | 2 |

#### RF-1.3 Integração Telegram

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-1.3.1 | Sistema deve integrar com Telegram Bot API | P1 | 5 |
| RF-1.3.2 | Sistema deve receber e enviar mensagens | P1 | 5 |

#### RF-1.4 Processamento de Mensagens

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-1.4.1 | Sistema deve classificar intenção da mensagem (agendamento, dúvida, emergência, outros) | P0 | 1 |
| RF-1.4.2 | Sistema deve extrair entidades (data, hora, nome, procedimento) | P0 | 1 |
| RF-1.4.3 | Sistema deve detectar quando escalar para humano | P0 | 2 |
| RF-1.4.4 | Sistema deve suportar múltiplos idiomas (PT-BR prioritário) | P2 | 6 |

### 4.2 Módulo 2: Gestão de Agendamentos

#### RF-2.1 Agendamento Inteligente

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-2.1.1 | Sistema deve permitir agendar consultas via conversa natural | P0 | 2 |
| RF-2.1.2 | Sistema deve verificar disponibilidade em tempo real | P0 | 2 |
| RF-2.1.3 | Sistema deve suportar múltiplos profissionais/agendas | P0 | 2 |
| RF-2.1.4 | Sistema deve permitir reagendamento via conversa | P0 | 2 |
| RF-2.1.5 | Sistema deve permitir cancelamento via conversa | P0 | 2 |
| RF-2.1.6 | Sistema deve sugerir horários alternativos quando o desejado está indisponível | P1 | 3 |
| RF-2.1.7 | Sistema deve gerenciar lista de espera automática | P2 | 4 |
| RF-2.1.8 | Sistema deve detectar e prevenir overbooking | P0 | 2 |

**Critérios de Aceitação RF-2.1.1:**
```gherkin
Dado que um paciente envia "Quero marcar para quinta"
Quando o sistema processa a mensagem
Então deve verificar disponibilidade na quinta
E deve apresentar opções de horários disponíveis
E deve permitir confirmação em uma única interação adicional
```

#### RF-2.2 Lembretes e Confirmações

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-2.2.1 | Sistema deve enviar confirmação automática 24h antes da consulta | P0 | 2 |
| RF-2.2.2 | Sistema deve enviar lembrete 2h antes da consulta | P0 | 2 |
| RF-2.2.3 | Sistema deve processar resposta de confirmação automaticamente | P0 | 2 |
| RF-2.2.4 | Sistema deve tentar reagendamento automático quando paciente cancela | P1 | 3 |
| RF-2.2.5 | Sistema deve notificar clínica quando paciente não confirma | P1 | 3 |
| RF-2.2.6 | Sistema deve personalizar lembretes com nome e procedimento | P1 | 3 |

#### RF-2.3 Gestão de No-Show

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-2.3.1 | Sistema deve registrar automaticamente no-shows | P0 | 3 |
| RF-2.3.2 | Sistema deve identificar pacientes com padrão de no-show | P1 | 4 |
| RF-2.3.3 | Sistema deve aplicar regras diferenciadas para pacientes reincidentes | P2 | 5 |
| RF-2.3.4 | Sistema deve gerar relatório de no-show por período | P1 | 4 |

### 4.3 Módulo 3: Follow-up e Retenção

#### RF-3.1 Sequências de Follow-up

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-3.1.1 | Sistema deve enviar follow-up automático pós-consulta (2h depois) | P0 | 3 |
| RF-3.1.2 | Sistema deve enviar orientações pós-procedimento personalizadas | P1 | 4 |
| RF-3.1.3 | Sistema deve enviar lembrete de retorno baseado em regras | P1 | 4 |
| RF-3.1.4 | Sistema deve identificar pacientes inativos (30/60/90 dias) | P1 | 4 |
| RF-3.1.5 | Sistema deve enviar campanhas de reativação automáticas | P1 | 5 |
| RF-3.1.6 | Sistema deve enviar mensagem de aniversário | P2 | 5 |

#### RF-3.2 Recuperação de Receita

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-3.2.1 | Sistema deve identificar orçamentos não convertidos | P1 | 5 |
| RF-3.2.2 | Sistema deve enviar sequência de follow-up para orçamentos pendentes | P1 | 5 |
| RF-3.2.3 | Sistema deve alertar sobre tratamentos incompletos | P1 | 5 |
| RF-3.2.4 | Sistema deve notificar inadimplência automaticamente | P2 | 6 |

### 4.4 Módulo 4: CRM Inteligente

#### RF-4.1 Cadastro de Pacientes

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-4.1.1 | Sistema deve manter cadastro completo de pacientes | P0 | 2 |
| RF-4.1.2 | Sistema deve permitir cadastro via conversa (extração automática) | P0 | 2 |
| RF-4.1.3 | Sistema deve manter histórico de atendimentos | P0 | 2 |
| RF-4.1.4 | Sistema deve registrar preferências e observações | P1 | 3 |
| RF-4.1.5 | Sistema deve calcular LTV (Lifetime Value) por paciente | P2 | 6 |
| RF-4.1.6 | Sistema deve atribuir score de engajamento | P2 | 6 |

#### RF-4.2 Segmentação e Tags

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-4.2.1 | Sistema deve permitir tags manuais em pacientes | P1 | 4 |
| RF-4.2.2 | Sistema deve aplicar tags automáticas baseadas em comportamento | P2 | 5 |
| RF-4.2.3 | Sistema deve permitir segmentação para campanhas | P1 | 5 |
| RF-4.2.4 | Sistema deve identificar pacientes em risco de churn | P2 | 6 |

### 4.5 Módulo 5: Vendas e Conversão

#### RF-5.1 Pipeline de Vendas

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-5.1.1 | Sistema deve capturar leads de todos os canais | P0 | 3 |
| RF-5.1.2 | Sistema deve qualificar leads automaticamente | P1 | 4 |
| RF-5.1.3 | Sistema deve agendar avaliações automaticamente | P0 | 3 |
| RF-5.1.4 | Sistema deve fazer follow-up pós-orçamento | P1 | 5 |
| RF-5.1.5 | Sistema deve notificar dono sobre leads quentes | P1 | 4 |

#### RF-5.2 Ferramentas de Vendas

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-5.2.1 | Sistema deve permitir templates de propostas | P2 | 6 |
| RF-5.2.2 | Sistema deve permitir calculadora de procedimentos | P2 | 7 |
| RF-5.2.3 | Sistema deve integrar com opções de financiamento | P2 | 8 |

### 4.6 Módulo 6: Marketing e Redes Sociais

#### RF-6.1 Automação de Marketing

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-6.1.1 | Sistema deve permitir criação de campanhas de captação | P2 | 7 |
| RF-6.1.2 | Sistema deve automatizar postagens no Instagram | P2 | 7 |
| RF-6.1.3 | Sistema deve gerar conteúdo com IA | P2 | 8 |
| RF-6.1.4 | Sistema deve responder comentários automaticamente | P2 | 7 |
| RF-6.1.5 | Sistema deve integrar com Meta Ads | P3 | 9 |

### 4.7 Módulo 7: Call Center com IA

#### RF-7.1 Ligações Outbound

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-7.1.1 | Sistema deve fazer ligações automáticas para lembretes | P2 | 9 |
| RF-7.1.2 | Sistema deve fazer ligações de follow-up | P2 | 9 |
| RF-7.1.3 | Sistema deve fazer ligações de reativação | P2 | 9 |
| RF-7.1.4 | Sistema deve transcrever ligações em tempo real | P2 | 9 |
| RF-7.1.5 | Sistema deve analisar sentimento da chamada | P3 | 10 |

#### RF-7.2 Ligações Inbound

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-7.2.1 | Sistema deve receber ligações e atender com IA | P2 | 10 |
| RF-7.2.2 | Sistema deve fazer triagem de chamadas | P2 | 10 |
| RF-7.2.3 | Sistema deve transferir para humano quando necessário | P2 | 10 |

### 4.8 Módulo 8: Dashboard e Gestão

#### RF-8.1 Dashboard Principal

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-8.1.1 | Sistema deve exibir agenda do dia | P0 | 3 |
| RF-8.1.2 | Sistema deve exibir métricas de atendimento (conversas, tempo de resposta) | P0 | 3 |
| RF-8.1.3 | Sistema deve exibir leads capturados | P0 | 3 |
| RF-8.1.4 | Sistema deve exibir no-shows evitados | P1 | 4 |
| RF-8.1.5 | Sistema deve exibir ROI da plataforma | P1 | 5 |
| RF-8.1.6 | Sistema deve exibir alertas e notificações | P0 | 3 |

#### RF-8.2 Gestão de Conversas

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-8.2.1 | Sistema deve listar todas as conversas ativas | P0 | 2 |
| RF-8.2.2 | Sistema deve permitir intervenção humana em qualquer conversa | P0 | 2 |
| RF-8.2.3 | Sistema deve permitir assumir conversa como humano | P0 | 2 |
| RF-8.2.4 | Sistema deve manter histórico de todas as conversas | P0 | 2 |
| RF-8.2.5 | Sistema deve permitir busca em conversas | P1 | 4 |

#### RF-8.3 Gerenciamento de Configurações

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-8.3.1 | Sistema deve permitir configurar horários de funcionamento | P0 | 2 |
| RF-8.3.2 | Sistema deve permitir configurar profissionais e agendas | P0 | 2 |
| RF-8.3.3 | Sistema deve permitir configurar mensagens padrão | P1 | 3 |
| RF-8.3.4 | Sistema deve permitir configurar regras de follow-up | P1 | 4 |
| RF-8.3.5 | Sistema deve permitir configurar integrações | P0 | 2 |

#### RF-8.4 Chat Interativo Humano-Agente

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-8.4.1 | Sistema deve permitir que humano dê comandos ao agente via chat | P1 | 4 |
| RF-8.4.2 | Sistema deve executar tarefas complexas a partir de comando natural | P1 | 4 |
| RF-8.4.3 | Sistema deve confirmar execução de tarefas | P1 | 4 |

### 4.9 Módulo 9: Conformidade e Auditoria (LGPD Art. 20)

#### RF-9.1 Transparência e Consentimento

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-9.1.1 | Sistema deve exibir aviso de atendimento por IA no primeiro contato | P0 | 1 |
| RF-9.1.2 | Sistema deve informar que paciente pode solicitar falar com humano | P0 | 1 |
| RF-9.1.3 | Sistema deve coletar consentimento explícito para dados de saúde | P0 | 2 |
| RF-9.1.4 | Sistema deve permitir que paciente solicite exclusão de dados | P0 | 3 |

**Mensagem de Transparência (Obrigatória):**
```
Este atendimento é realizado por assistente virtual com inteligência artificial.
Você pode solicitar falar com uma pessoa humana a qualquer momento respondendo
"FALAR COM ATENDENTE".
```

#### RF-9.2 Log de Decisões Automatizadas

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-9.2.1 | Sistema deve registrar todas as decisões da IA (intenção, ação, confiança) | P0 | 2 |
| RF-9.2.2 | Sistema deve permitir revisão de decisões por humano | P0 | 3 |
| RF-9.2.3 | Sistema deve manter log de decisões por 24 meses | P0 | 2 |
| RF-9.2.4 | Sistema deve permitir exportação de logs por paciente | P1 | 4 |

**Estrutura do Log de Decisão:**
```typescript
interface AIDecisionLog {
  id: string;
  clinic_id: string;
  patient_id: string;
  conversation_id: string;
  timestamp: Date;
  intent: string;           // "agendamento", "orcamento", "reagendamento"
  action_taken: string;     // O que a IA fez
  confidence: number;       // 0-1
  escalated_to_human: boolean;
  human_review_requested: boolean;
  human_review_result?: 'confirmed' | 'corrected' | 'rejected';
  notes?: string;
}
```

#### RF-9.3 Direitos do Paciente

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-9.3.1 | Sistema deve permitir paciente acessar seus dados via solicitação | P0 | 3 |
| RF-9.3.2 | Sistema deve processar solicitação de exclusão em até 15 dias | P0 | 3 |
| RF-9.3.3 | Sistema deve permitir correção de dados incorretos | P0 | 3 |
| RF-9.3.4 | Sistema deve notificar paciente sobre uso de seus dados | P1 | 4 |

### 4.10 MÓDULO NOVO: Call Center IA com Voz Clonada

**O Diferencial Mais Forte:** Único sistema no Brasil com voz clonada da atendente da própria clínica.

#### RF-10.1 Voz Clonada (TTS Custom)

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-10.1.1 | Sistema deve permitir gravação de amostras de voz da atendente | P0 | 5 |
| RF-10.1.2 | Sistema deve gerar modelo de voz customizado em <24h | P0 | 5 |
| RF-10.1.3 | Sistema deve usar voz clonada em todas as ligações | P0 | 5 |
| RF-10.1.4 | Sistema deve suportar múltiplas vozes por clínica | P1 | 6 |

**Fluxo de Clone de Voz:**
```
1. Atendente grava 30 frases (script fornecido)
2. Upload via dashboard
3. Processamento (ElevenLabs/Resemble AI)
4. Modelo pronto em 6-24h
5. Validação pela clínica
6. Ativação em produção
```

#### RF-10.2 Ligações Outbound

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-10.2.1 | Sistema deve fazer ligações automáticas para lembretes 24h | P0 | 5 |
| RF-10.2.2 | Sistema deve fazer ligações de follow-up pós-consulta | P0 | 5 |
| RF-10.2.3 | Sistema deve fazer ligações de reativação de pacientes inativos | P0 | 5 |
| RF-10.2.4 | Sistema deve fazer ligações de recuperação de inadimplência | P1 | 6 |
| RF-10.2.5 | Sistema deve agendar ligações em horários configuráveis | P0 | 5 |

#### RF-10.3 Ligações Inbound

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-10.3.1 | Sistema deve receber ligações e atender com IA | P0 | 6 |
| RF-10.3.2 | Sistema deve fazer triagem de chamadas (agendamento, dúvida, emergência) | P0 | 6 |
| RF-10.3.3 | Sistema deve transferir para humano quando necessário | P0 | 6 |
| RF-10.3.4 | Sistema deve identificar paciente por telefone | P1 | 6 |

#### RF-10.4 Transcrição e Análise

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-10.4.1 | Sistema deve transcrever todas as ligações em tempo real | P0 | 5 |
| RF-10.4.2 | Sistema deve analisar sentimento durante a chamada | P1 | 6 |
| RF-10.4.3 | Sistema deve detectar palavras-chave críticas ("dor", "urgente") | P1 | 6 |
| RF-10.4.4 | Sistema deve gerar resumo automático no CRM do paciente | P0 | 5 |
| RF-10.4.5 | Sistema deve armazenar gravações por 12 meses | P0 | 5 |

**Stack de Voz:**

| Componente | Tecnologia | Custo |
|------------|------------|-------|
| STT (Speech-to-Text) | Deepgram / Whisper | $0.0043/min |
| TTS (Text-to-Speech) | ElevenLabs / Resemble AI | $0.30/1000 chars |
| Telephony | Twilio / Vonage | $0.013/min |
| Voz Clonada | ElevenLabs Professional | $22/mês |

### 4.11 MÓDULO NOVO: Inteligência Preditiva

**Sistema proativo que prevê necessidades antes de acontecerem.**

#### RF-11.1 Previsão de No-Show

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-11.1.1 | Sistema deve calcular probabilidade de no-show para cada agendamento | P0 | 7 |
| RF-11.1.2 | Sistema deve considerar histórico, horário, dia da semana, profissional | P0 | 7 |
| RF-11.1.3 | Sistema deve alertar para agendamentos de alto risco (>60%) | P0 | 7 |
| RF-11.1.4 | Sistema deve sugerir ações preventivas (confirmação extra, superbooking) | P1 | 7 |

**Modelo de Previsão:**
```python
# Features do modelo
features = [
    'historico_no_show_paciente',      # Taxa histórica
    'dia_semana',                       # Sexta = mais no-show
    'horario',                          # Início da manhã = mais faltas
    'profissional',                     # Alguns têm mais no-show
    'tempo_desde_agendamento',          # Quanto antes agenda, mais falta
    'confirmou_24h',                    # Confirmou? Reduz risco
    'procedimento_tipo',                # Alguns têm mais desistência
    'distancia_clinica',                # Longe = mais falta
]
```

#### RF-11.2 Churn Prediction

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-11.2.1 | Sistema deve identificar pacientes em risco de abandono | P1 | 7 |
| RF-11.2.2 | Sistema deve calcular score de engajamento por paciente | P1 | 7 |
| RF-11.2.3 | Sistema deve triggerar campanhas de retenção automáticas | P1 | 8 |

**Indicadores de Churn:**
- Não visita há >90 dias
- Redução na frequência
- Não responde mensagens
- Cancelou últimas 2 consultas
- Tratamento incompleto

#### RF-11.3 Oportunidades de Upsell

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-11.3.1 | Sistema deve sugerir procedimentos complementares | P2 | 8 |
| RF-11.3.2 | Sistema deve identificar pacientes elegíveis para novos serviços | P2 | 8 |
| RF-11.3.3 | Sistema deve apresentar oportunidades no dashboard | P2 | 8 |

### 4.12 MÓDULO NOVO: Gestão Financeira

**Fecha o ciclo: do agendamento ao pagamento.**

#### RF-12.1 Contas a Receber

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-12.1.1 | Sistema deve gerar cobrança automática após procedimento | P0 | 4 |
| RF-12.1.2 | Sistema deve suportar parcelamento de procedimentos | P0 | 4 |
| RF-12.1.3 | Sistema deve enviar link de pagamento via WhatsApp | P0 | 4 |
| RF-12.1.4 | Sistema deve confirmar pagamento automaticamente | P0 | 4 |
| RF-12.1.5 | Sistema deve emitir recibos automáticos | P1 | 5 |

#### RF-12.2 Integração PIX e Gateway

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-12.2.1 | Sistema deve gerar QR Code PIX para pagamentos | P0 | 4 |
| RF-12.2.2 | Sistema deve integrar com ASAAS para cobranças | P0 | 4 |
| RF-12.2.3 | Sistema deve suportar cartão de crédito via link | P1 | 5 |
| RF-12.2.4 | Sistema deve conciliar pagamentos automaticamente | P0 | 4 |

#### RF-12.3 Gestão de Inadimplência

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-12.3.1 | Sistema deve identificar pagamentos vencidos | P0 | 5 |
| RF-12.3.2 | Sistema deve enviar lembretes automáticos de vencimento | P0 | 5 |
| RF-12.3.3 | Sistema deve iniciar sequência de recuperação após 7 dias | P1 | 6 |
| RF-12.3.4 | Sistema deve suspender novos agendamentos para inadimplentes (opcional) | P2 | 6 |

#### RF-12.4 Relatórios Financeiros

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-12.4.1 | Sistema deve exibir fluxo de caixa diário/semanal/mensal | P0 | 5 |
| RF-12.4.2 | Sistema deve calcular receita por profissional | P0 | 5 |
| RF-12.4.3 | Sistema deve mostrar taxa de inadimplência | P0 | 5 |
| RF-12.4.4 | Sistema deve gerar relatório para contador | P1 | 6 |

### 4.13 MÓDULO NOVO: Business Intelligence

**Dashboards executivos com insights acionáveis.**

#### RF-13.1 Dashboard Operacional

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-13.1.1 | Sistema deve exibir consultas do dia em tempo real | P0 | 3 |
| RF-13.1.2 | Sistema deve mostrar taxa de ocupação da agenda | P0 | 3 |
| RF-13.1.3 | Sistema deve exibir tempo médio de resposta | P0 | 3 |
| RF-13.1.4 | Sistema deve mostrar conversas ativas por canal | P0 | 3 |

#### RF-13.2 Dashboard Financeiro

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-13.2.1 | Sistema deve exibir receita do dia/semana/mês | P0 | 5 |
| RF-13.2.2 | Sistema deve calcular ticket médio | P0 | 5 |
| RF-13.2.3 | Sistema deve mostrar receita perdida por no-show | P0 | 5 |
| RF-13.2.4 | Sistema deve exibir projeção de receita | P1 | 7 |

#### RF-13.3 Dashboard de Pacientes

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-13.3.1 | Sistema deve mostrar novos pacientes por período | P0 | 4 |
| RF-13.3.2 | Sistema deve exibir pacientes ativos vs inativos | P0 | 4 |
| RF-13.3.3 | Sistema deve mostrar pacientes reativados | P0 | 4 |
| RF-13.3.4 | Sistema deve calcular LTV médio | P1 | 7 |

#### RF-13.4 Alertas Inteligentes

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-13.4.1 | Sistema deve alertar sobre aumento de no-show | P0 | 7 |
| RF-13.4.2 | Sistema deve notificar quedas em métricas críticas | P0 | 7 |
| RF-13.4.3 | Sistema deve sugerir ações baseadas em dados | P1 | 8 |

**Exemplo de Alerta:**
```
📊 ALERTA: Taxa de no-show aumentou de 15% para 22% este mês

📉 Principal causa: Pacientes de quinta à tarde

💡 Sugestão: Implementar confirmação dupla para esse horário

[Aplicar Sugestão] [Ver Detalhes] [Dispensar]
```

### 4.14 MÓDULO NOVO: Chat Widget (Owned Channel)

**Canal próprio sem limitações de WhatsApp.**

#### RF-14.1 Widget de Chat

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-14.1.1 | Sistema deve fornecer widget embeddável para site da clínica | P0 | 2 |
| RF-14.1.2 | Widget deve suportar conversação com mesmo agente IA | P0 | 2 |
| RF-14.1.3 | Widget deve manter histórico sincronizado com WhatsApp | P0 | 2 |
| RF-14.1.4 | Widget deve ser personalizável (cores, logo) | P1 | 3 |

#### RF-14.2 Push Notifications

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-14.2.1 | Sistema deve enviar push notifications para lembretes | P0 | 3 |
| RF-14.2.2 | Sistema deve solicitar permissão de notificação no primeiro acesso | P0 | 3 |
| RF-14.2.3 | Sistema deve permitir agendamento de notificações | P1 | 4 |

#### RF-14.3 PWA (Progressive Web App)

| ID | Requisito | Prioridade | Sprint |
|----|-----------|------------|--------|
| RF-14.3.1 | Sistema deve funcionar offline (agenda básica) | P2 | 8 |
| RF-14.3.2 | Sistema deve sincronizar quando voltar online | P2 | 8 |
| RF-14.3.3 | Sistema deve ser instalável como app | P2 | 8 |

---

## 5. Requisitos Não-Funcionais

### 5.1 Performance

| ID | Requisito | Métrica | Prioridade |
|----|-----------|---------|------------|
| RNF-5.1.1 | Tempo de resposta do agente | <5 segundos para 95% das mensagens | P0 |
| RNF-5.1.2 | Latência de API | <200ms para endpoints críticos | P0 |
| RNF-5.1.3 | Disponibilidade do sistema | 99.9% uptime | P0 |
| RNF-5.1.4 | Capacidade de mensagens | 1000 mensagens/hora por clínica | P1 |
| RNF-5.1.5 | Tempo de carregamento do dashboard | <2 segundos | P1 |

### 5.2 Escalabilidade

| ID | Requisito | Métrica | Prioridade |
|----|-----------|---------|------------|
| RNF-5.2.1 | Multi-tenancy | Suportar 100+ clínicas simultâneas | P1 |
| RNF-5.2.2 | Escala horizontal | Auto-scaling baseado em carga | P2 |
| RNF-5.2.3 | Banco de dados | Suportar 1M+ registros por tenant | P1 |

### 5.3 Segurança

| ID | Requisito | Descrição | Prioridade |
|----|-----------|-----------|------------|
| RNF-5.3.1 | Criptografia em trânsito | TLS 1.3 para todas as comunicações | P0 |
| RNF-5.3.2 | Criptografia em repouso | AES-256 para dados sensíveis | P0 |
| RNF-5.3.3 | Autenticação | MFA obrigatório para usuários admin | P0 |
| RNF-5.3.4 | Autorização | RBAC (Role-Based Access Control) | P0 |
| RNF-5.3.5 | Isolamento de dados | Row-Level Security para multi-tenancy | P0 |
| RNF-5.3.6 | Audit logging | Log de todas as operações sensíveis | P0 |
| RNF-5.3.7 | Backup | Backup diário automático com retenção de 30 dias | P0 |

### 5.4 LGPD Compliance

| ID | Requisito | Artigo LGPD | Prioridade |
|----|-----------|-------------|------------|
| RNF-5.4.1 | Consentimento explícito para dados sensíveis | Art. 11 | P0 |
| RNF-5.4.2 | Direito de acesso e informação | Art. 13 | P0 |
| RNF-5.4.3 | Direito de eliminação dos dados | Art. 18 | P0 |
| RNF-5.4.4 | Revisão de decisões automatizadas | Art. 20 | P1 |
| RNF-5.4.5 | Transparência sobre uso de IA | Art. 20 | P0 |
| RNF-5.4.6 | Opção de falar com humano | Art. 20 | P0 |
| RNF-5.4.7 | Data residency | Dados no Brasil (AWS sa-east-1) | P0 |

### 5.5 Usabilidade

| ID | Requisito | Métrica | Prioridade |
|----|-----------|---------|------------|
| RNF-5.5.1 | Facilidade de uso | Usuário consegue operar sem treinamento formal | P0 |
| RNF-5.5.2 | Tempo de onboarding | <30 minutos para primeira configuração | P1 |
| RNF-5.5.3 | Responsividade | Interface responsiva para mobile e desktop | P0 |
| RNF-5.5.4 | Acessibilidade | WCAG 2.1 Level AA | P2 |

### 5.6 Confiabilidade

| ID | Requisito | Métrica | Prioridade |
|----|-----------|---------|------------|
| RNF-5.6.1 | Recuperação de desastre | RTO < 4 horas, RPO < 1 hora | P1 |
| RNF-5.6.2 | Failover automático | <30 segundos para recuperação | P1 |
| RNF-5.6.3 | Graceful degradation | Sistema parcial funciona se componentes falharem | P1 |

---

## 6. Arquitetura de Agentes

### 6.1 Hierarquia de Agentes (v3.0 - Completa)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ROUTER AGENT                                        │
│                    (Orquestrador Principal)                                  │
│                                                                              │
│  Responsabilidades:                                                          │
│  • Classificar intenção da mensagem                                         │
│  • Delegar para agente especialista apropriado                              │
│  • Manter contexto da conversa                                               │
│  • Escalar para humano quando necessário                                    │
│  • Gerenciar memória (curto e longo prazo)                                  │
│  • Roteamento de canal (WhatsApp, Instagram, Voz, Chat Widget)              │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
    ┌────────────────────────────┼────────────────────────────┬────────────────┐
    │                            │                            │                │
    ▼                            ▼                            ▼                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  SCHEDULING     │    │  MEDICAL INFO   │    │    BILLING      │    │    TRIAGE       │
│    AGENT        │    │    AGENT        │    │    AGENT        │    │    AGENT        │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Agendar       │    │ • FAQs médicas  │    │ • Preços        │    │ • Classificar   │
│ • Reagendar     │    │ • Orientações   │    │ • Convênios     │    │   urgência      │
│ • Cancelar      │    │   pós-proc      │    │ • PIX/Cobrança  │    │ • Emergências   │
│ • Lembretes     │    │ • Protocolos    │    │ • Parcelamento  │    │ • Escalação     │
│ • Disponibilidade│   │ • RAG docs      │    │ • Inadimplência │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
                                 │
    ┌────────────────────────────┼────────────────────────────┐
    │                            │                            │
    ▼                            ▼                            ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   VOICE AGENT   │    │ FINANCE AGENT   │    │   INSIGHTS      │
│    (NOVO)       │    │    (NOVO)       │    │    AGENT        │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Ligações      │    │ • Cobranças     │    │ • Previsões     │
│   inbound       │    │ • PIX/Links     │    │   no-show       │
│ • Ligações      │    │ • Conciliação   │    │ • Churn alert   │
│   outbound      │    │ • Relatórios $$ │    │ • Upsell sug.   │
│ • Transcrição   │    │                 │    │ • Alertas       │
│ • Clone voz     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      MCP SERVERS        │
                    │     (Ferramentas)       │
                    ├─────────────────────────┤
                    │ • postgres-mcp          │
                    │ • calendar-mcp          │
                    │ • filesystem-mcp        │
                    │ • brave-search-mcp      │
                    │ • whatsapp-mcp          │
                    │ • elevenlabs-mcp (voz)  │
                    │ • asaas-mcp (pagtos)    │
                    │ • twilio-mcp (tel)      │
                    └─────────────────────────┘
```

### 6.2 Especificações dos Agentes

#### Router Agent (Orquestrador)

| Atributo | Valor |
|----------|-------|
| **Modelo** | Claude Sonnet 4 (claude-sonnet-4-20250514) |
| **Contexto** | Últimas 20 mensagens + perfil do paciente + config da clínica |
| **Ferramentas** | classify_intent, delegate_to_agent, escalate_to_human, get_patient_history, search_knowledge_base, route_to_voice |
| **Memória Curto Prazo** | Redis (24h TTL, acesso <10ms) |
| **Memória Longo Prazo** | PostgreSQL + pgvector (HNSW, acesso <50ms) |
| **Memória Episódica** | ReflexionMemory (aprendizado contínuo) |

```typescript
interface RouterAgentConfig {
  model: "claude-sonnet-4-20250514";
  context: {
    lastMessages: 20;
    patientProfile: PatientProfile;
    clinicConfig: ClinicConfig;
    activeChannels: ('whatsapp' | 'instagram' | 'voice' | 'chat_widget')[];
  };
  tools: [
    "classify_intent",
    "delegate_to_agent",
    "escalate_to_human",
    "get_patient_history",
    "search_knowledge_base",
    "route_to_voice"
  ];
  memory: {
    shortTerm: "Redis (24h TTL)",
    longTerm: "PostgreSQL + pgvector + HNSW",
    episodic: "ReflexionMemory"
  };
}
```

#### Scheduling Agent

| Atributo | Valor |
|----------|-------|
| **Modelo** | Claude Sonnet 4 |
| **Contexto** | Agenda do profissional + preferências do paciente |
| **Ferramentas** | check_availability, book_appointment, cancel_appointment, reschedule_appointment, send_reminder, get_professional_schedule, add_to_waitlist, sync_google_calendar |
| **Restrições** | Não agendar fora do horário, evitar overbooking, buffer de 15min |

```typescript
interface SchedulingAgentConfig {
  model: "claude-sonnet-4-20250514";
  tools: [
    "check_availability",
    "book_appointment",
    "cancel_appointment",
    "reschedule_appointment",
    "send_reminder",
    "get_professional_schedule",
    "add_to_waitlist",
    "sync_google_calendar"
  ];
  constraints: {
    workingHours: TimeRange[];
    maxOverbooking: 0;
    bufferMinutes: 15;
  };
}
```

#### Voice Agent (NOVO - Diferencial Principal)

| Atributo | Valor |
|----------|-------|
| **Modelo** | Claude Sonnet 4 |
| **STT** | Deepgram (real-time streaming) |
| **TTS** | ElevenLabs (voz clonada da clínica) |
| **Ferramentas** | make_call, transcribe_call, analyze_sentiment, detect_keywords, transfer_to_human, log_call_summary |
| **Latência Alvo** | <800ms (turno de conversa) |

```typescript
interface VoiceAgentConfig {
  model: "claude-sonnet-4-20250514";
  stt: {
    provider: "deepgram";
    model: "nova-2";
    language: "pt-BR";
    streaming: true;
  };
  tts: {
    provider: "elevenlabs";
    voice_id: string;  // ID da voz clonada da clínica
    model: "eleven_multilingual_v2";
  };
  tools: [
    "make_call",
    "transcribe_call",
    "analyze_sentiment",
    "detect_keywords",
    "transfer_to_human",
    "log_call_summary"
  ];
  latencyTarget: 800; // ms
}
```

#### Finance Agent (NOVO)

| Atributo | Valor |
|----------|-------|
| **Modelo** | Claude Sonnet 4 |
| **Ferramentas** | create_charge, generate_pix, send_payment_link, check_payment_status, create_installment, send_dunning_sequence |
| **Integrações** | ASAAS, MercadoPago |

```typescript
interface FinanceAgentConfig {
  model: "claude-sonnet-4-20250514";
  tools: [
    "create_charge",
    "generate_pix",
    "send_payment_link",
    "check_payment_status",
    "create_installment",
    "send_dunning_sequence"
  ];
  integrations: {
    asaas: ASAASConfig;
    mercadopago?: MercadoPagoConfig;
  };
}
```

#### Insights Agent (NOVO - ML/Preditivo)

| Atributo | Valor |
|----------|-------|
| **Modelo** | Claude Sonnet 4 |
| **ML Pipeline** | Python + scikit-learn (no-show prediction) |
| **Ferramentas** | predict_no_show, identify_churn_risk, suggest_upsell, generate_alert, analyze_trends |

```typescript
interface InsightsAgentConfig {
  model: "claude-sonnet-4-20250514";
  mlPipeline: {
    noShowModel: "sklearn.RandomForestClassifier";
    churnModel: "sklearn.GradientBoostingClassifier";
    features: string[];
  };
  tools: [
    "predict_no_show",
    "identify_churn_risk",
    "suggest_upsell",
    "generate_alert",
    "analyze_trends"
  ];
}
```

#### Medical Info Agent

| Atributo | Valor |
|----------|-------|
| **Modelo** | Claude Sonnet 4 |
| **Contexto** | Base de conhecimento RAG da clínica |
| **Ferramentas** | search_knowledge_base, get_post_proc_instructions, search_medical_info |
| **RAG Sources** | Protocolos, FAQs, orientações pós-procedimento |
| **Retrieval** | Hybrid (Vector similarity + BM25) |

---

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEMORY ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SHORT-TERM MEMORY (Redis - Upstash)                            │
│  ├── TTL: 24 horas                                              │
│  ├── Uso: Contexto de conversa ativa                            │
│  ├── Estrutura: {session_id, messages[], context}               │
│  ├── Acesso: <10ms                                              │
│  └── Rate Limit: 10.000 requests/dia (free tier)               │
│                                                                  │
│  LONG-TERM MEMORY (PostgreSQL + pgvector + HNSW)                │
│  ├── TTL: Permanente                                            │
│  ├── Uso: Histórico do paciente, preferências                   │
│  ├── Indexação: HNSW para busca semântica (150x mais rápido)   │
│  ├── Acesso: <50ms                                              │
│  └── Embeddings: text-embedding-3-small (OpenAI)               │
│                                                                  │
│  EPISODIC MEMORY (ReflexionMemory)                              │
│  ├── TTL: Permanente                                            │
│  ├── Uso: Aprendizado com interações passadas                   │
│  ├── Funcionalidade: Melhoria contínua do agente                │
│  └── Consolidação: Nightly via SONA learning                    │
│                                                                  │
│  RAG KNOWLEDGE BASE (pgvector)                                  │
│  ├── Documentos: Protocolos, FAQs, preços, orientações         │
│  ├── Embeddings: text-embedding-3-small (1536 dimensões)       │
│  ├── Retrieval: Hybrid (vector similarity + BM25)              │
│  ├── Chunking: 512 tokens, 50 overlap                           │
│  └── Re-ranking: Opcional via Cohere Rerank                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 MCP Servers Necessários

| MCP Server | Uso | Prioridade | Status |
|------------|-----|------------|--------|
| **postgres-mcp** | Consultas ao banco, RAG queries | P0 | Existente |
| **filesystem-mcp** | Acesso a documentos da clínica | P1 | Existente |
| **brave-search-mcp** | Busca de informações médicas externas | P2 | Existente |
| **calendar-mcp** | Gerenciamento de agendamentos + Google Calendar | P0 | Custom - A desenvolver |
| **whatsapp-mcp** | Envio de mensagens WhatsApp (Cloud API) | P0 | Custom - A desenvolver |
| **elevenlabs-mcp** | TTS e voz clonada para ligações | P0 | Custom - A desenvolver |
| **asaas-mcp** | Gateway de pagamentos PIX/Boleto | P0 | Custom - A desenvolver |
| **twilio-mcp** | Telefonia inbound/outbound | P0 | Custom - A desenvolver |
| **push-mcp** | Push notifications (Web Push API) | P1 | Custom - A desenvolver |
| **deepgram-mcp** | STT streaming em tempo real | P0 | Custom - A desenvolver |

#### MCP Server: calendar-mcp

```typescript
// calendar-mcp/server.ts
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
    // Sync with Google Calendar
    // Trigger confirmation flow
    return { appointment_id: "...", confirmed: true };
  }
});

server.tool("sync_google_calendar", {
  description: "Sincroniza com Google Calendar do profissional",
  parameters: {
    professional_id: { type: "string" },
    action: { type: "string", enum: ["create", "update", "delete"] }
  },
  handler: async (params) => {
    // Google Calendar API sync
    return { synced: true };
  }
});
```

#### MCP Server: elevenlabs-mcp (Voz)

```typescript
// elevenlabs-mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk";

const server = new McpServer({
  name: "elevenlabs-voice",
  version: "1.0.0"
});

server.tool("synthesize_speech", {
  description: "Converte texto em áudio com voz clonada",
  parameters: {
    text: { type: "string" },
    voice_id: { type: "string" },
    model: { type: "string", default: "eleven_multilingual_v2" }
  },
  handler: async (params) => {
    // Call ElevenLabs API
    return { audio_url: "...", duration_ms: 1500 };
  }
});

server.tool("clone_voice", {
  description: "Clona voz a partir de amostras",
  parameters: {
    name: { type: "string" },
    audio_samples: { type: "array", items: { type: "string" } }
  },
  handler: async (params) => {
    // Create cloned voice
    return { voice_id: "...", status: "processing" };
  }
});

server.tool("get_voice_status", {
  description: "Verifica status do clone de voz",
  parameters: {
    voice_id: { type: "string" }
  },
  handler: async (params) => {
    return { status: "ready", samples_count: 30 };
  }
});
```

#### MCP Server: asaas-mcp (Pagamentos)

```typescript
// asaas-mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk";

const server = new McpServer({
  name: "asaas-payments",
  version: "1.0.0"
});

server.tool("create_charge", {
  description: "Cria uma cobrança PIX/Boleto",
  parameters: {
    customer_id: { type: "string" },
    value: { type: "number" },
    billing_type: { type: "string", enum: ["PIX", "BOLETO", "CREDIT_CARD"] },
    due_date: { type: "string" },
    installments: { type: "number", default: 1 }
  },
  handler: async (params) => {
    // ASAAS API call
    return {
      charge_id: "...",
      pix_code: "...",
      pix_qrcode: "...",
      payment_link: "..."
    };
  }
});

server.tool("check_payment_status", {
  description: "Verifica status de pagamento",
  parameters: {
    charge_id: { type: "string" }
  },
  handler: async (params) => {
    return { status: "RECEIVED", paid_at: "..." };
  }
});

server.tool("create_customer", {
  description: "Cria cliente no gateway",
  parameters: {
    name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    cpf_cnpj: { type: "string" }
  },
  handler: async (params) => {
    return { customer_id: "..." };
  }
});
```

#### MCP Server: twilio-mcp (Telefonia)

```typescript
// twilio-mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk";

const server = new McpServer({
  name: "twilio-telephony",
  version: "1.0.0"
});

server.tool("make_call", {
  description: "Faz uma ligação outbound",
  parameters: {
    to: { type: "string" },
    from: { type: "string" },
    voice_id: { type: "string" },
    message: { type: "string" },
    webhook_url: { type: "string" }
  },
  handler: async (params) => {
    // Twilio API call
    return { call_sid: "...", status: "initiated" };
  }
});

server.tool("hangup_call", {
  description: "Encerra ligação ativa",
  parameters: {
    call_sid: { type: "string" }
  },
  handler: async (params) => {
    return { status: "completed" };
  }
});

server.tool("transfer_call", {
  description: "Transfere ligação para humano",
  parameters: {
    call_sid: { type: "string" },
    transfer_to: { type: "string" }
  },
  handler: async (params) => {
    return { status: "transferred" };
  }
});

server.tool("start_recording", {
  description: "Inicia gravação da ligação",
  parameters: {
    call_sid: { type: "string" }
  },
  handler: async (params) => {
    return { recording_sid: "...", status: "in-progress" };
  }
});
```

#### MCP Server: deepgram-mcp (STT)

```typescript
// deepgram-mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk";

const server = new McpServer({
  name: "deepgram-stt",
  version: "1.0.0"
});

server.tool("start_transcription", {
  description: "Inicia transcrição em tempo real",
  parameters: {
    language: { type: "string", default: "pt-BR" },
    model: { type: "string", default: "nova-2" },
    interim_results: { type: "boolean", default: true }
  },
  handler: async (params) => {
    return { session_id: "...", websocket_url: "..." };
  }
});

server.tool("transcribe_audio", {
  description: "Transcreve arquivo de áudio",
  parameters: {
    audio_url: { type: "string" },
    language: { type: "string", default: "pt-BR" }
  },
  handler: async (params) => {
    return { transcript: "...", confidence: 0.95 };
  }
});
```

---

## 7. Modelo de Dados

### 7.1 Diagrama ER Simplificado

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     CLINIC      │       │    PATIENT      │       │  APPOINTMENT    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │───┐   │ id (PK)         │───┐   │ id (PK)         │
│ name            │   │   │ clinic_id (FK)  │   │   │ clinic_id (FK)  │
│ slug            │   │   │ name            │   │   │ patient_id (FK) │
│ settings (JSON) │   │   │ phone           │   │   │ professional_id │
│ created_at      │   │   │ email           │   │   │ datetime        │
│ updated_at      │   │   │ whatsapp_id     │   │   │ status          │
└─────────────────┘   │   │ instagram_id    │   │   │ notes           │
                      │   │ tags (JSON)     │   │   │ confirmed       │
                      │   │ created_at      │   │   │ created_at      │
                      │   └─────────────────┘   │   └─────────────────┘
                      │                         │
                      │   ┌─────────────────┐   │   ┌─────────────────┐
                      │   │  PROFESSIONAL   │   │   │  CONVERSATION   │
                      │   ├─────────────────┤   │   ├─────────────────┤
                      └──►│ id (PK)         │   └──►│ id (PK)         │
                          │ clinic_id (FK)  │       │ clinic_id (FK)  │
                          │ name            │       │ patient_id (FK) │
                          │ specialty       │       │ channel         │
                          │ schedule (JSON) │       │ status          │
                          │ active          │       │ created_at      │
                          └─────────────────┘       └─────────────────┘
                                                          │
                                                          ▼
                                                    ┌─────────────────┐
                                                    │     MESSAGE     │
                                                    ├─────────────────┤
                                                    │ id (PK)         │
                                                    │ conversation_id │
                                                    │ direction       │
                                                    │ content         │
                                                    │ metadata (JSON) │
                                                    │ created_at      │
                                                    └─────────────────┘
```

### 7.2 Principais Tabelas

#### clinics
```sql
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  branding JSONB DEFAULT '{}',
  integrations JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### patients
```sql
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  whatsapp_id VARCHAR(100),
  instagram_id VARCHAR(100),
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_clinic ON patients(clinic_id);
CREATE INDEX idx_patients_whatsapp ON patients(whatsapp_id);
```

#### appointments
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID REFERENCES patients(id),
  professional_id UUID REFERENCES professionals(id),
  datetime TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status VARCHAR(20) DEFAULT 'scheduled',
  notes TEXT,
  confirmed BOOLEAN DEFAULT FALSE,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_clinic ON appointments(clinic_id);
CREATE INDEX idx_appointments_datetime ON appointments(datetime);
CREATE INDEX idx_appointments_status ON appointments(status);
```

### 7.3 Row-Level Security (Multi-tenancy)

```sql
-- Habilitar RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por clínica
CREATE POLICY clinic_isolation ON patients
  USING (clinic_id = current_setting('app.current_clinic')::uuid);

CREATE POLICY clinic_isolation ON appointments
  USING (clinic_id = current_setting('app.current_clinic')::uuid);

CREATE POLICY clinic_isolation ON conversations
  USING (clinic_id = current_setting('app.current_clinic')::uuid);
```

### 7.4 Tabelas de Conformidade (LGPD Art. 20)

```sql
-- Log de decisões automatizadas
CREATE TABLE ai_decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID REFERENCES patients(id),
  conversation_id UUID REFERENCES conversations(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Decisão
  intent VARCHAR(100) NOT NULL,
  action_taken TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,

  -- Escalação
  escalated_to_human BOOLEAN DEFAULT FALSE,
  human_review_requested BOOLEAN DEFAULT FALSE,
  human_review_result VARCHAR(20),
  human_review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,

  -- Retenção
  retention_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 months')
);

CREATE INDEX idx_decision_logs_clinic ON ai_decision_logs(clinic_id);
CREATE INDEX idx_decision_logs_patient ON ai_decision_logs(patient_id);
CREATE INDEX idx_decision_logs_timestamp ON ai_decision_logs(timestamp);

-- Consentimentos
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),

  consent_type VARCHAR(50) NOT NULL,  -- 'data_processing', 'health_data', 'ai_interaction'
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip_address VARCHAR(45),
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Solicitações de direitos do paciente
CREATE TABLE data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),

  request_type VARCHAR(50) NOT NULL,  -- 'access', 'deletion', 'correction', 'portability'
  status VARCHAR(20) DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  notes TEXT
);
```

### 7.5 Tabelas de Voz (NOVO - Módulo 10)

```sql
-- Ligações realizadas/recebidas
CREATE TABLE voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID REFERENCES patients(id),
  conversation_id UUID REFERENCES conversations(id),

  -- Identificação
  call_sid VARCHAR(100),  -- Twilio call SID
  direction VARCHAR(20) NOT NULL,  -- 'inbound' | 'outbound'
  phone_number VARCHAR(20) NOT NULL,

  -- Status
  status VARCHAR(30) NOT NULL,  -- 'initiated', 'ringing', 'in_progress', 'completed', 'failed'
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Transcrição e Análise
  transcription TEXT,
  sentiment VARCHAR(20),  -- 'positive', 'neutral', 'negative', 'frustrated'
  keywords_detected JSONB DEFAULT '[]',
  summary TEXT,

  -- Voz
  voice_id VARCHAR(100),  -- ID da voz clonada usada
  recording_url TEXT,
  recording_storage_path TEXT,

  -- Resultado
  outcome VARCHAR(50),  -- 'appointment_scheduled', 'confirmed', 'no_answer', 'voicemail', 'transferred'
  appointment_id UUID REFERENCES appointments(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_calls_clinic ON voice_calls(clinic_id);
CREATE INDEX idx_voice_calls_patient ON voice_calls(patient_id);
CREATE INDEX idx_voice_calls_status ON voice_calls(status);
CREATE INDEX idx_voice_calls_datetime ON voice_calls(started_at);

-- Vozes clonadas da clínica
CREATE TABLE cloned_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),

  -- Identificação
  name VARCHAR(100) NOT NULL,  -- "Atendente Principal", "Dra. Ana"
  voice_provider VARCHAR(50) NOT NULL,  -- 'elevenlabs', 'resemble'
  voice_provider_id VARCHAR(100) NOT NULL,  -- ID no provider

  -- Status
  status VARCHAR(20) DEFAULT 'processing',  -- 'processing', 'ready', 'failed'
  samples_count INTEGER DEFAULT 0,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,

  -- Configuração
  is_default BOOLEAN DEFAULT FALSE,
  language VARCHAR(10) DEFAULT 'pt-BR',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.6 Tabelas Financeiras (NOVO - Módulo 12)

```sql
-- Cobranças
CREATE TABLE charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),

  -- Identificação
  external_id VARCHAR(100),  -- ID no gateway (ASAAS)
  charge_type VARCHAR(30) NOT NULL,  -- 'appointment', 'procedure', 'package'

  -- Valores
  amount DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,

  -- Parcelamento
  installments INTEGER DEFAULT 1,
  current_installment INTEGER DEFAULT 1,

  -- Status
  status VARCHAR(30) NOT NULL,  -- 'pending', 'paid', 'overdue', 'cancelled', 'refunded'
  due_date DATE,
  paid_at TIMESTAMPTZ,

  -- Pagamento
  payment_method VARCHAR(30),  -- 'pix', 'credit_card', 'boleto'
  payment_link TEXT,
  pix_code TEXT,
  pix_qrcode TEXT,

  -- Gateway
  gateway VARCHAR(50) NOT NULL,  -- 'asaas', 'mercadopago'
  gateway_response JSONB DEFAULT '{}',

  -- Lembretes
  reminder_sent BOOLEAN DEFAULT FALSE,
  dunning_step INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_charges_clinic ON charges(clinic_id);
CREATE INDEX idx_charges_patient ON charges(patient_id);
CREATE INDEX idx_charges_status ON charges(status);
CREATE INDEX idx_charges_due_date ON charges(due_date);

-- Histórico de pagamentos
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id UUID NOT NULL REFERENCES charges(id),
  clinic_id UUID NOT NULL REFERENCES clinics(id),

  -- Transação
  transaction_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL,

  -- Status
  status VARCHAR(30) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadados
  gateway_response JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.7 Tabelas de Inteligência Preditiva (NOVO - Módulo 11)

```sql
-- Previsões de no-show
CREATE TABLE no_show_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  patient_id UUID NOT NULL REFERENCES patients(id),

  -- Predição
  probability DECIMAL(3,2) NOT NULL,  -- 0.00 a 1.00
  risk_level VARCHAR(20) NOT NULL,  -- 'low', 'medium', 'high', 'critical'
  confidence DECIMAL(3,2) NOT NULL,

  -- Features usadas
  features JSONB DEFAULT '{}',

  -- Ações
  action_suggested VARCHAR(100),
  action_taken VARCHAR(100),
  action_taken_at TIMESTAMPTZ,

  -- Resultado real
  actual_outcome VARCHAR(20),  -- 'showed', 'no_show', 'cancelled'
  actual_outcome_at TIMESTAMPTZ,

  predicted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_noshow_clinic ON no_show_predictions(clinic_id);
CREATE INDEX idx_noshow_appointment ON no_show_predictions(appointment_id);
CREATE INDEX idx_noshow_probability ON no_show_predictions(probability);

-- Churn risk
CREATE TABLE churn_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),

  -- Predição
  churn_probability DECIMAL(3,2) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  contributing_factors JSONB DEFAULT '[]',

  -- Ações
  campaign_triggered VARCHAR(100),
  action_taken VARCHAR(100),

  -- Resultado
  actual_churn BOOLEAN,
  churned_at TIMESTAMPTZ,
  reactivated_at TIMESTAMPTZ,

  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- Upsell opportunities
CREATE TABLE upsell_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),

  -- Oportunidade
  procedure_suggested VARCHAR(200) NOT NULL,
  reason VARCHAR(500),
  estimated_value DECIMAL(10,2),
  confidence DECIMAL(3,2),

  -- Status
  status VARCHAR(30) DEFAULT 'suggested',  -- 'suggested', 'presented', 'accepted', 'rejected', 'expired'
  presented_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.8 Tabelas de Notificações Push (NOVO - Módulo 14)

```sql
-- Dispositivos do paciente
CREATE TABLE patient_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),

  -- Dispositivo
  device_token VARCHAR(500) NOT NULL,
  platform VARCHAR(20) NOT NULL,  -- 'web', 'android', 'ios'
  user_agent TEXT,

  -- Permissões
  push_enabled BOOLEAN DEFAULT TRUE,
  notification_preferences JSONB DEFAULT '{}',

  -- Última atividade
  last_active_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_patient ON patient_devices(patient_id);
CREATE INDEX idx_devices_token ON patient_devices(device_token);

-- Notificações enviadas
CREATE TABLE push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID REFERENCES patients(id),
  device_id UUID REFERENCES patient_devices(id),

  -- Notificação
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',

  -- Status
  status VARCHAR(30) NOT NULL,  -- 'pending', 'sent', 'delivered', 'failed'
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,

  -- Erro
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Integrações

### 8.1 WhatsApp Business API - Estratégia Híbrida

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHATSAPP ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INBOUND (Paciente → Clínica)                                   │
│  └── API Oficial Meta Cloud API                                 │
│      ├── Conformidade total com termos                          │
│      ├── Sem risco de banimento                                 │
│      └── Custo: Conversa iniciada pelo usuário = GRÁTIS (24h)  │
│                                                                  │
│  OUTBOUND (Clínica → Paciente)                                  │
│  ├── Dentro de 24h window: API Oficial                          │
│  │   └── Resposta livre (incluída na conversa iniciada)        │
│  │                                                               │
│  └── Fora de 24h window: Playwright + WhatsApp Web             │
│      ├── Simula comportamento humano                            │
│      ├── Reduz risco de banimento                               │
│      ├── Sem custo de API                                       │
│      └── Requer manutenção contínua                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| Aspecto | Detalhe |
|---------|---------|
| **Provider** | Meta Cloud API (direto) ou Twilio/360dialog |
| **Webhook** | `/webhooks/whatsapp` |
| **Formato** | JSON conforme especificação Meta |
| **Autenticação** | Bearer token + Webhook verification |
| **Rate Limit** | 80 mensagens/segundo por número |

**Custos Meta Cloud API:**

| Categoria | Custo | Janela |
|-----------|-------|--------|
| Authentication | USD 0.0135 | - |
| Marketing | USD 0.0250 | - |
| Utility | USD 0.0080 | - |
| Service | USD 0.0035 | - |
| **Conversa iniciada pelo usuário** | **Grátis** | 24h |

**Fluxo de Mensagem:**
```
1. Paciente envia mensagem
2. Meta dispara webhook
3. Sistema processa e classifica intenção
4. Agente gera resposta
5. Sistema envia via API (dentro de 24h) ou Playwright (fora)
```

### 8.2 Instagram Graph API

| Aspecto | Detalhe |
|---------|---------|
| **Endpoint** | Graph API v18.0+ |
| **Escopos** | `instagram_basic`, `instagram_manage_messages` |
| **Webhook** | `/webhooks/instagram` |
| **Limite** | Janela de 24h para resposta livre |

### 8.3 Telegram Bot API

| Aspecto | Detalhe |
|---------|---------|
| **Endpoint** | `api.telegram.org/bot<token>` |
| **Webhook** | `/webhooks/telegram` |
| **Custo** | Gratuito |
| **Limite** | 30 mensagens/segundo |

### 8.4 MCP Servers Customizados

#### calendar-mcp (A desenvolver)

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

## 9. Roadmap de Implementação

### 9.1 FASE 1: MVP Completo (Sprint 1-8 | 8 semanas)

**Objetivo:** Plataforma completa com todos os diferenciais únicos funcionando.

#### Sprint 1-2: Core + Canais (Semana 1-2)

| Feature | Sprint | Prioridade |
|---------|--------|------------|
| Setup projeto (Next.js 15 + Hono) | 1 | P0 |
| PostgreSQL + RLS + pgvector | 1 | P0 |
| Redis para sessões | 1 | P0 |
| WhatsApp Business API integration | 1 | P0 |
| Instagram DM integration | 2 | P0 |
| **Chat Widget embeddable** | 2 | P0 |
| Router Agent básico | 1 | P0 |
| Sistema de memória (curto prazo) | 1 | P0 |
| LGPD: Aviso de IA + consentimento | 1 | P0 |

#### Sprint 3-4: Agendamento + Financeiro (Semana 3-4)

| Feature | Sprint | Prioridade |
|---------|--------|------------|
| Scheduling Agent completo | 3 | P0 |
| Sistema de lembretes (24h, 2h) | 3 | P0 |
| Follow-up pós-consulta | 3 | P0 |
| Dashboard básico | 3 | P0 |
| CRM básico (cadastro paciente) | 3 | P0 |
| **Integração Google Calendar** | 4 | P0 |
| **PIX + Gateway (ASAAS)** | 4 | P0 |
| **Geração de cobranças** | 4 | P0 |
| **Push Notifications** | 4 | P0 |

#### Sprint 5-6: Voz + BI (Semana 5-6)

| Feature | Sprint | Prioridade |
|---------|--------|------------|
| **Clone de voz (setup)** | 5 | P0 |
| **Ligações outbound (lembretes)** | 5 | P0 |
| **Transcrição em tempo real** | 5 | P0 |
| **Resumo automático no CRM** | 5 | P0 |
| **Ligações inbound** | 6 | P0 |
| **Transferência para humano** | 6 | P0 |
| **Análise de sentimento** | 6 | P1 |
| Dashboard financeiro | 5 | P0 |
| Dashboard de pacientes | 6 | P0 |
| Relatórios básicos | 6 | P1 |

#### Sprint 7-8: Inteligência + Piloto (Semana 7-8)

| Feature | Sprint | Prioridade |
|---------|--------|------------|
| **Previsão de no-show (ML)** | 7 | P0 |
| **Churn prediction básico** | 7 | P1 |
| RAG com pgvector | 7 | P0 |
| Templates personalizáveis | 7 | P1 |
| Multi-tenant robusto | 8 | P0 |
| Dashboard avançado | 8 | P1 |
| **Alertas inteligentes** | 8 | P0 |
| **PILOTO COM CLÍNICA REAL** | 8 | P0 |
| Documentação | 8 | P1 |

### 9.2 FASE 2: Consolidação (Sprint 9-12 | 4 semanas)

| Feature | Sprint | Status |
|---------|--------|--------|
| Telegram integration | 9 | Planejado |
| Voz clonada multi-usuário | 9 | Planejado |
| Sequências de recuperação inadimplência | 10 | Planejado |
| Upsell suggestions | 10 | Planejado |
| Dashboard mobile responsivo | 11 | Planejado |
| Onboarding self-service | 11 | Planejado |
| API pública v1 | 12 | Planejado |
| **META: 5-10 clínicas ativas** | 12 | Planejado |

### 9.3 FASE 3: Expansão (Sprint 13-20 | 8 semanas)

| Feature | Sprint | Status |
|---------|--------|--------|
| PWA offline-first | 13 | Planejado |
| Integração Meta Ads | 14 | Planejado |
| Integração Doctoralia | 15 | Planejado |
| Segmento Estética (templates) | 16-17 | Planejado |
| App mobile nativo | 18-19 | Planejado |
| White-label básico | 20 | Planejado |
| **META: 30-50 clínicas ativas** | 20 | Planejado |

### 9.4 FASE 4: Scale (Ongoing)

- Multi-region (EU, USA)
- Segmento Fisioterapia
- API pública v2
- Programa de parceiros
- White-label completo

---

## 10. Critérios de Aceitação

### 10.1 MVP (Sprint 4)

| Critério | Métrica | Meta |
|----------|---------|------|
| Funcionalidade | Agendamento via WhatsApp funcionando | 100% |
| Performance | Tempo de resposta | <5s (95%) |
| Confiabilidade | Uptime | >99% |
| Usabilidade | Clínica piloto operando sem ajuda | Sim |
| ROI | Redução de no-show | >30% |

### 10.2 Consolidação (Sprint 8)

| Critério | Métrica | Meta |
|----------|---------|------|
| Escala | Clínicas ativas | 5-10 |
| Satisfação | NPS | >50 |
| Retenção | Churn mensal | <15% |
| Performance | Latência API | <200ms |

---

## 11. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Banimento de WhatsApp | Média | Alto | Estratégia híbrida API + Playwright |
| Alta dependência de Claude API | Média | Alto | Fallback para modelos alternativos |
| Dificuldade de adoção | Média | Médio | Onboarding guiado, suporte próximo |
| Concorrência de grandes players | Baixa | Alto | Foco em serviço personalizado, nicho |
| Custos de LLM altos | Média | Médio | Otimização de prompts, caching, modelo híbrido |

### 11.1 Análise de Custos

**Custos por Clínica (mensal estimado):**

| Porte | Conversas/dia | Claude API | Canais | Infra | Total |
|-------|---------------|------------|--------|-------|-------|
| **Pequena** (1-2 prof) | 50 | $15-25 | $30 | $50 | **~$100/mês** |
| **Média** (3-5 prof) | 200 | $60-100 | $120 | $100 | **~$350/mês** |
| **Grande** (6+ prof) | 1000 | $300-500 | $600 | $200 | **~$1.350/mês** |

**Claude API Pricing:**

| Modelo | Input | Output | Uso Recomendado |
|--------|-------|--------|-----------------|
| **Claude Sonnet 4** | $3/MTok | $15/MTok | Padrão (95% dos casos) |
| **Claude Opus 4** | $15/MTok | $75/MTok | Casos complexos |
| **Claude Haiku** | $0.25/MTok | $1.25/MTok | Classificação simples |

**Estratégia de Otimização de Custos:**
1. Usar Haiku para classificação de intenção simples
2. Cache de respostas frequentes (Redis)
3. Contexto otimizado (apenas mensagens relevantes)
4. RAG para evitar re-processamento de informações

---

## 12. Glossário

| Termo | Definição |
|-------|-----------|
| **Agente** | Instância de IA que executa tarefas específicas |
| **Router Agent** | Agente que classifica e delega mensagens |
| **RAG** | Retrieval-Augmented Generation - busca em base de conhecimento |
| **MCP** | Model Context Protocol - protocolo para integração de ferramentas |
| **RLS** | Row-Level Security - isolamento de dados por tenant |
| **No-show** | Paciente que não comparece à consulta agendada |
| **Follow-up** | Acompanhamento pós-interação |
| **GPCT** | Goal, Plans, Challenges, Timeline - metodologia de vendas |
| **LTV** | Lifetime Value - valor total do cliente ao longo do tempo |

---

## 13. Aprovações

| Papel | Nome | Assinatura | Data |
|-------|------|------------|------|
| Fundador | Walis | ____________ | __/__/____ |

---

## 14. Anexos

### A. Documentos de Pesquisa

| Documento | Localização | Status |
|-----------|-------------|--------|
| Product Brief | `docs/planning/product-brief.md` | ✅ Aprovado |
| Market Research | `docs/planning/market-research.md` | ✅ Completo |
| Technical Research | `docs/planning/technical-research.md` | ✅ Completo |
| Domain Research | `docs/planning/domain-research.md` | ✅ Completo |

### B. Stack Tecnológica Completa

| Camada | Tecnologia | Versão | Uso |
|--------|------------|--------|-----|
| **Frontend** | Next.js | 15.x | Dashboard + Chat Widget |
| | React | 19.x | UI Framework |
| | shadcn/ui | Latest | Componentes |
| | Tailwind CSS | 3.x | Styling |
| | Zustand | 4.x | State Management |
| | TanStack Query | 5.x | Data Fetching |
| **Backend** | Node.js | 22 LTS | Runtime |
| | Hono.js | 4.x | API Framework |
| | @anthropic-ai/sdk | Latest | Claude Integration |
| | claude-agent-sdk | Latest | Agent Orchestration |
| | BullMQ | 5.x | Job Queue |
| **Database** | PostgreSQL | 16+ | Primary Database |
| | pgvector | Latest | Vector Search (RAG) |
| | HNSW Index | - | Semantic Search |
| | Redis (Upstash) | - | Cache + Sessions |
| **Voice** | Deepgram | nova-2 | Speech-to-Text |
| | ElevenLabs | Multilingual v2 | Text-to-Speech |
| | Twilio | - | Telephony |
| **Payments** | ASAAS | API v3 | PIX/Boleto/Cartão |
| | MercadoPago | - | Checkout (opcional) |
| **Infrastructure** | Vercel | - | Hosting + Edge |
| | Cloudflare R2 | - | File Storage |
| | Sentry | - | Error Tracking |
| | LogSnag | - | Event Tracking |
| **Integrações** | Meta Cloud API | v18.0+ | WhatsApp |
| | Instagram Graph API | v18.0+ | DMs |
| | Telegram Bot API | - | Mensagens |
| | Google Calendar API | v3 | Agendamentos |

### B.2 Stack por Módulo

| Módulo | Stack Principal | Dependências |
|--------|-----------------|--------------|
| **1. Router Agent** | Claude Sonnet 4 + Agent SDK | Redis, PostgreSQL |
| **2. Scheduling** | Claude Sonnet 4 + calendar-mcp | Google Calendar API |
| **3. WhatsApp** | Meta Cloud API + Playwright | Redis |
| **4. Instagram** | Graph API | - |
| **5. Telegram** | Bot API | - |
| **6. Memory** | pgvector + HNSW | OpenAI Embeddings |
| **7. CRM** | PostgreSQL + RLS | - |
| **8. Follow-up** | BullMQ + Redis | - |
| **9. Dashboard** | Next.js + shadcn/ui | TanStack Query |
| **10. Voice** | Deepgram + ElevenLabs + Twilio | WebSocket |
| **11. Intelligence** | Python + scikit-learn | PostgreSQL |
| **12. Finance** | ASAAS API | Webhooks |
| **13. BI** | Next.js + Recharts | PostgreSQL |
| **14. Chat Widget** | React + PWA | Service Worker |

### B.3 APIs e SDKs Externos

| Serviço | API | Rate Limit | Custo |
|---------|-----|------------|-------|
| **Claude API** | claude-sonnet-4-20250514 | 1000 req/min | $3/$15 MTok |
| **Claude Haiku** | claude-haiku-4-5-20251001 | 1000 req/min | $0.25/$1.25 MTok |
| **Deepgram STT** | nova-2 | 100 req/min | $0.0043/min |
| **ElevenLabs TTS** | eleven_multilingual_v2 | 100 req/min | $0.30/1K chars |
| **Twilio Voice** | Programmable Voice | 100 req/min | $0.013/min |
| **ASAAS** | API v3 | 120 req/min | ~2% transação |
| **Meta Cloud API** | v18.0 | 80 msg/s | $0.0035-0.025/msg |
| **Google Calendar** | v3 | 1M req/day | Gratuito |
| **OpenAI Embeddings** | text-embedding-3-small | 3000 req/min | $0.02/1M tokens |

### C. Procedimentos por Especialidade

| Especialidade | Procedimentos | Duração | Recall |
|---------------|---------------|---------|--------|
| **Prevenção** | Limpeza, flúor | 30-60 min | 6 meses |
| **Restauradora** | Obturação | 30-90 min | - |
| **Endodontia** | Canal | 60-120 min | 1 ano |
| **Ortodontia** | Aparelho, manutenção | 30-60 min | 1-2 meses |
| **Implantodontia** | Implante, coroa | 60-180 min | 6 meses |
| **Cirurgia** | Extração | 30-90 min | 7 dias |
| **Clareamento** | Consulta + moldeira | 30-60 min | - |

### D. Regulamentações Aplicáveis

| Regulamentação | Artigos Relevantes | Link |
|----------------|-------------------|------|
| LGPD | Art. 11, 13, 18, 20 | [Planalto](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) |
| CFO-118/2012 | Prontuário odontológico | [CFO](https://cfo.org.br) |
| CFO-22/2001 | Código de Ética | [CFO](https://cfo.org.br) |
| CFO-196/2020 | Teleodontologia | [CFO](https://cfo.org.br) |

### E. Custos Detalhados por Módulo (v3.0)

#### E.1 Custos de Voz (Módulo 10)

| Componente | Provider | Custo | Volume Estimado* |
|------------|----------|-------|------------------|
| **STT (Speech-to-Text)** | Deepgram | $0.0043/min | 500 min/mês = $2.15 |
| **TTS (Text-to-Speech)** | ElevenLabs | $0.30/1K chars | 50K chars/mês = $15 |
| **Telefonia Inbound** | Twilio | $0.013/min | 300 min/mês = $3.90 |
| **Telefonia Outbound** | Twilio | $0.013/min | 700 min/mês = $9.10 |
| **Voz Clonada** | ElevenLabs Professional | $22/mês | - |
| **Gravações** | Cloudflare R2 | $0.015/GB | 5 GB/mês = $0.08 |
| **Total Voz** | - | - | **~$52/mês** |

*Volume estimado para clínica média (3-5 profissionais)

#### E.2 Custos Financeiros (Módulo 12)

| Componente | Provider | Custo |
|------------|----------|-------|
| **Taxa PIX** | ASAAS | 0.99% |
| **Taxa Boleto** | ASAAS | R$ 3,49/boleto |
| **Taxa Cartão** | ASAAS | 3.99% - 5.99% |
| **Webhook** | ASAAS | Grátis |
| **Setup** | ASAAS | Grátis |

#### E.3 Custos Totais por Porte (Mensal)

| Componente | Pequena (1-2 prof) | Média (3-5 prof) | Grande (6+ prof) |
|------------|--------------------|------------------|-------------------|
| **Claude API** | $15-25 | $60-100 | $300-500 |
| **Voz (STT+TTS+Twilio)** | $30 | $52 | $150 |
| **WhatsApp API** | $20 | $50 | $200 |
| **Infraestrutura** | $50 | $100 | $200 |
| **Gateway PIX** | ~2% transação | ~2% transação | ~2% transação |
| **Total Fixo** | **~$115/mês** | **~$260/mês** | **~$850/mês** |
| **Variável** | + 2% receita | + 2% receita | + 2% receita |

#### E.4 Modelo de Pricing Sugerido

```
MODELO HÍBRIDO - SERVIÇO PERSONALIZADO
├── SETUP FEE (único)
│   ├── Starter (1-2 prof): R$ 3.000 - 5.000
│   ├── Growth (3-5 prof): R$ 5.000 - 10.000
│   └── Scale (6+ prof): R$ 10.000 - 20.000
│
├── MENSALIDADE (recorrente)
│   ├── Starter: R$ 500-800/mês
│   ├── Growth: R$ 800-1.500/mês
│   └── Scale: R$ 1.500-3.000/mês
│
├── ADD-ONS (opcionais)
│   ├── Call Center IA: +R$ 300-500/mês
│   ├── Voz Clonada: +R$ 150-200/mês
│   ├── Marketing Automação: +R$ 200-400/mês
│   └── Relatórios Avançados: +R$ 100-200/mês
│
└── VARIÁVEL
    └── Custo LLM/Voz repassado (transparência total)
```

### F. Roadmap Visual

```
FASE 1: MVP COMPLETO (8 semanas)
├── Sprint 1-2: Core + Canais
│   ├── WhatsApp API ✅
│   ├── Instagram DM ✅
│   ├── Chat Widget ✅
│   └── Router Agent ✅
│
├── Sprint 3-4: Agendamento + Financeiro
│   ├── Scheduling Agent ✅
│   ├── Lembretes automáticos ✅
│   ├── Google Calendar sync ✅
│   ├── PIX + ASAAS ✅
│   └── Push Notifications ✅
│
├── Sprint 5-6: Voz + BI
│   ├── Clone de voz ✅
│   ├── Ligações outbound ✅
│   ├── Transcrição real-time ✅
│   ├── Ligações inbound ✅
│   └── Dashboards ✅
│
└── Sprint 7-8: Inteligência + Piloto
    ├── No-show prediction ✅
    ├── Churn prediction ✅
    ├── RAG + pgvector ✅
    └── PILOTO REAL ✅

FASE 2: CONSOLidação (4 semanas)
FASE 3: Expansão (8 semanas)
FASE 4: Scale (Ongoing)
```

### G. Diagrama de Arquitetura Completa

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLÍNICA AI PLATFORM - ARCHITECTURE v3.0               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        CANAIS DE ENTRADA                             │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │    │
│  │  │WhatsApp │ │Instagram│ │Telegram │ │  Voz    │ │  Chat   │       │    │
│  │  │  API    │ │  Graph  │ │   Bot   │ │ Twilio  │ │ Widget  │       │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │    │
│  └───────┼──────────┼──────────┼──────────┼──────────┼─────────────────┘    │
│          │          │          │          │          │                      │
│          └──────────┴──────────┼──────────┴──────────┘                      │
│                                │                                             │
│  ┌─────────────────────────────▼─────────────────────────────────────────┐  │
│  │                      ROUTER AGENT (Orchestrator)                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Claude Sonnet 4 + claude-agent-sdk                              │  │  │
│  │  │  • Classificação de intenção                                     │  │  │
│  │  │  • Delegação para especialistas                                  │  │  │
│  │  │  • Gerenciamento de memória                                      │  │  │
│  │  │  • Escalação para humano                                         │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────┬───────────────────────────────────────────┘  │
│                                │                                              │
│  ┌─────────────────────────────▼─────────────────────────────────────────┐   │
│  │                     AGENTES ESPECIALISTAS                              │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐             │   │
│  │  │Scheduling │ │  Medical  │ │  Billing  │ │  Triage   │             │   │
│  │  │  Agent    │ │Info Agent │ │  Agent    │ │  Agent    │             │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘             │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                          │   │
│  │  │  Voice    │ │  Finance  │ │  Insights │                          │   │
│  │  │  Agent    │ │  Agent    │ │  Agent    │                          │   │
│  │  └───────────┘ └───────────┘ └───────────┘                          │   │
│  └─────────────────────────────┬─────────────────────────────────────────┘   │
│                                │                                              │
│  ┌─────────────────────────────▼─────────────────────────────────────────┐   │
│  │                        MCP SERVERS                                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ postgres │ │ calendar │ │elevenlabs│ │  asaas   │ │  twilio  │   │   │
│  │  │   mcp    │ │   mcp    │ │   mcp    │ │   mcp    │ │   mcp    │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────────┬─────────────────────────────────────────┘   │
│                                │                                              │
│  ┌─────────────────────────────▼─────────────────────────────────────────┐   │
│  │                      DATA LAYER                                        │   │
│  │  ┌───────────────────────┐  ┌───────────────────────┐                 │   │
│  │  │   PostgreSQL 16+      │  │    Redis (Upstash)    │                 │   │
│  │  │   • pgvector (RAG)    │  │    • Session cache    │                 │   │
│  │  │   • HNSW (search)     │  │    • Rate limiting    │                 │   │
│  │  │   • RLS (multi-tenant)│  │    • Job queues       │                 │   │
│  │  └───────────────────────┘  └───────────────────────┘                 │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │                    EXTERNAL SERVICES                                   │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │   │
│  │  │ Google  │ │  ASAAS  │ │Twilio   │ │ElevenLabs│ │Deepgram │         │   │
│  │  │Calendar │ │ (PIX)   │ │ (Voice) │ │ (TTS)   │ │ (STT)   │         │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘         │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**Documento criado seguindo metodologia BMAD - Fase 2: Planning**

**Status:** ✅ PRD v3.0 Finalizado - Aguardando Aprovação

**Próximo passo após aprovação:**
1. **UX Design** - Criar wireframes e fluxos de usuário (`bmad-create-ux-design`)
2. **Arquitetura Técnica** - Detalhar implementação (`bmad-create-architecture`)
3. **Epics e Stories** - Decompor em tarefas de desenvolvimento (`bmad-create-epics-and-stories`)

**Decisões Tomadas:**
- ✅ MVP Completo em 8 semanas (Sprint 1-8)
- ✅ Voz full com clonagem desde Sprint 5
- ✅ Omnichannel desde dia 1 (WA + IG + Widget + Voz)
- ✅ Multi-segmento preparado (Odonto MVP, Estética Fase 3)
- ✅ Google Calendar integration no MVP

**Resumo de Custos MVP:**
- Setup: R$ 5.000 - 10.000 (único)
- Mensalidade: R$ 800 - 1.500/mês
- Custos variáveis: ~$100-350/mês (LLM + Voz + Infra)