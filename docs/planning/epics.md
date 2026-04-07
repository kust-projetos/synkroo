# Synkroo - Epics

---
project_name: Synkroo
created_date: 2026-03-27
updated_date: 2026-03-27
methodology: BMAD v6.2.2
status: REVIEWED
total_epics: 8
mvp_epics: 6
total_story_points: 131
mvp_story_points: 97
---

## Visão Geral

Este documento define os Epics do projeto Synkroo, derivados dos requisitos funcionais do PRD v3.4 e alinhados com a arquitetura v1.1.

### Priorização MVP

| Epic | Nome | Prioridade | Sprint | MVP | SP |
|------|------|------------|--------|-----|-----|
| E-01 | Atendimento Multicanal | P0 | 1-2 | ✅ | 34 |
| E-02 | Gestão de Agendamentos | P0 | 2-3 | ✅ | 21 |
| E-04 | CRM Inteligente | P0 | 2-3 | ✅ | 13 |
| E-03 | Follow-up e Retenção | P0 | 3-4 | ✅ | 13 |
| E-08 | Dashboard e Gestão | P1 | 3-4 | ✅ | 8 |
| E-05 | Vendas e Conversão | P1 | 3-5 | ✅ | 8 |
| E-06 | Marketing e Redes Sociais | P2 | 7-8 | ❌ | 13 |
| E-07 | Call Center com IA | P2 | 9-10 | ❌ | 21 |

### NFR Traceability Matrix

| Epic | NFRs Impactados | Rationale |
|------|-----------------|-----------|
| E-01 | NFR-01, NFR-02, NFR-04, NFR-10 | Latência de API, tempo de resposta do agente, uptime, disponibilidade |
| E-02 | NFR-01, NFR-02, NFR-06 | Latência, tempo de resposta, escalabilidade |
| E-03 | NFR-04, NFR-10 | Disponibilidade, uptime para campanhas automatizadas |
| E-04 | NFR-07, NFR-14, NFR-15, NFR-18 | Segurança de dados, LGPD, criptografia, backup |
| E-05 | NFR-02, NFR-06 | Tempo de resposta, escalabilidade |
| E-06 | NFR-04, NFR-06 | Disponibilidade, escalabilidade |
| E-07 | NFR-02, NFR-04, NFR-12 | Tempo de resposta, disponibilidade, qualidade de voz |
| E-08 | NFR-01, NFR-13 | Latência de dashboard, real-time updates |

### ADR Cross-Reference

| Epic | ADRs Aplicáveis |
|------|-----------------|
| E-01 | ADR-002 (Multi-LLM Provider Factory), ADR-004 (Multi-tenant) |
| E-02 | ADR-001 (Event-Driven), ADR-003 (Caching Strategy) |
| E-03 | ADR-001 (Event-Driven), ADR-005 (Background Jobs) |
| E-04 | ADR-004 (Multi-tenant com RLS) |
| E-05 | ADR-002 (Multi-LLM Provider Factory), ADR-003 (Caching) |
| E-06 | ADR-005 (Background Jobs) |
| E-07 | ADR-002 (Multi-LLM Provider Factory) |
| E-08 | ADR-003 (Caching Strategy) |

---

## Epic E-01: Atendimento Multicanal

### Visão do Epic

**Como** clínica odontológica
**Quero** um sistema de atendimento automatizado multicanal
**Para que** meus pacientes possam ser atendidos 24/7 via WhatsApp, Instagram e outros canais

### Objetivos de Negócio

- Reduzir tempo de resposta para <5 segundos
- Automatizar 80% das interações de primeiro contato
- Eliminar gargalos de atendimento em horários de pico
- Manter histórico unificado de conversas

### Escopo

#### Incluído (In Scope)
- Integração WhatsApp via Evolution API v2.3.7 (Docker, primary provider)
- Integração Instagram Graph API
- Processamento de mensagens com IA
- Classificação de intenção
- Extração de entidades
- Escalação para humano
- Histórico de conversas
- Contexto de conversa (memória de curto prazo)

#### Não Incluído (Out of Scope - MVP)
- Integração Telegram (P1 - Sprint 5)
- Envio de imagens/documentos (P2 - Sprint 4)
- Resposta a comentários públicos Instagram (P1 - Sprint 3)
- Múltiplos idiomas (P2 - Sprint 6)

### Requisitos Funcionais Relacionados

| RF ID | Descrição | Prioridade |
|-------|-----------|------------|
| RF-1.1.1 | Integração WhatsApp via Evolution API v2.3.7 | P0 |
| RF-1.1.2 | Receber mensagens inbound via webhook | P0 |
| RF-1.1.3 | Enviar mensagens outbound via API | P0 |
| RF-1.1.4 | Resposta automática em <5 segundos | P0 |
| RF-1.1.5 | Manter contexto de conversa | P0 |
| RF-1.1.7 | Detectar e tratar erros de entrega | P1 |
| RF-1.2.1 | Integração Instagram Graph API | P0 |
| RF-1.2.2 | Receber DMs e comentários | P0 |
| RF-1.2.3 | Responder automaticamente a DMs | P0 |
| RF-1.2.5 | Respeitar janela de 24h do Instagram | P0 |
| RF-1.4.1 | Classificar intenção da mensagem | P0 |
| RF-1.4.2 | Extrair entidades (data, hora, nome, procedimento) | P0 |
| RF-1.4.3 | Detectar quando escalar para humano | P0 |

### User Journeys Atendidas

| UJ ID | Nome | Cobertura |
|-------|------|-----------|
| UJ-01 | Primeiro Contato - WhatsApp | 100% |
| UJ-02 | Agendamento via WhatsApp | Parcial (com E-02) |

### Critérios de Aceitação

```gherkin
Scenario: Receber mensagem no WhatsApp
  Given o sistema está conectado ao WhatsApp via Evolution API v2.3.7
  When um paciente envia "Quero marcar uma consulta"
  Then o sistema deve classificar a intenção como "agendamento"
  And o sistema deve extrair entidades relevantes
  And o sistema deve responder em menos de 5 segundos
  And a conversa deve ser armazenada no histórico

Scenario: Escalação para humano
  Given o agente está processando uma conversa
  When a intenção detectada é "reclamação" ou "urgente"
  Then o sistema deve identificar necessidade de escalação
  And o sistema deve notificar o atendente responsável
  And o sistema deve transferir contexto da conversa

Scenario: Manutenção de contexto
  Given um paciente está em conversa ativa
  When o paciente envia "e para quinta?"
  Then o sistema deve recuperar contexto anterior
  And o sistema deve interpretar "quinta" no contexto da conversa
```

### Dependências

| Depêndencia | Tipo | Status |
|-------------|------|--------|
| WhatsApp Business API (via Evolution API v2.3.7) | Externa | Configurado (Docker) |
| Instagram Graph API | Externa | A configurar |
| Claude Agent SDK | Técnica | Definido na Arquitetura |

> **Note (2026-03-29):** LLM provider is a multi-provider factory (MiniMax default, OpenAI, OpenRouter, Groq, Claude-via-proxy), not Claude Agent SDK alone. See ADR-002.

> **Note (2026-03-29):** Evolution API v2.3.7 uses LID addressing mode where `remoteJid` may contain `@lid` suffix. The webhook handler supports `remoteJidAlt` fallback to resolve actual phone numbers when LID format is detected.
| Supabase (banco de dados) | Técnica | Definido na Arquitetura |

### Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| API do WhatsApp instável | Média | Alto | Implementar retry com backoff exponencial |
| Limite de mensagens Meta | Alta | Médio | Respeitar rate limits, usar templates aprovados |
| Janela de 24h Meta | Alta | Médio | Evolution API handles reconnection; rate limiting humano-like |

### Estimativa

- **Story Points**: 34
- **Sprints**: 2 (Sprint 1-2)
- **Time**: 2 Backend + 1 AI Engineer

### KPIs / Success Metrics

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Tempo de resposta médio | <5s (P90) | Logs do agente |
| Taxa de classificação correta | >85% | Análise manual de amostra |
| Taxa de escalação apropriada | >90% | Feedback do atendente |
| Uptime WhatsApp | >99.5% | Monitoramento de webhook |
| Cobertura de intentos | 100% dos 6 tipos | Dashboard de intents |

### Definition of Ready (DoR)

- [x] WhatsApp via Evolution API v2.3.7 configurada e testada
- [ ] Instagram Graph API configurada e testada
- [ ] Conta Supabase provisionada
- [x] Multi-LLM provider factory integrado (MiniMax M2.7 default)
- [ ] Prompts de classificação definidos
- [ ] Ambiente de staging disponível

### Definition of Done (DoD)

- [ ] Integrações WhatsApp/Instagram funcionais em staging
- [ ] Classificação de intenção com >85% de acurácia
- [ ] Tempo de resposta <5s em 90% dos casos
- [ ] Histórico de conversas persistido corretamente
- [ ] Escalação para humano funcionando
- [ ] Testes automatizados (unit + integration)
- [ ] Documentação de API atualizada
- [ ] Code review aprovado

---

## Epic E-02: Gestão de Agendamentos

### Visão do Epic

**Como** clínica odontológica
**Quero** um sistema de agendamento automatizado inteligente
**Para que** meus pacientes possam agendar, confirmar e cancelar consultas sem intervenção humana

### Objetivos de Negócio

- Reduzir no-show rate em 30%
- Automatizar 90% dos agendamentos
- Eliminar conflitos de horário
- Otimizar ocupação da agenda

### Escopo

#### Incluído (In Scope)
- Agendamento via conversa natural
- Verificação de disponibilidade em tempo real
- Múltiplos profissionais/agendas
- Reagendamento via conversa
- Cancelamento via conversa
- Sugestão de horários alternativos
- Detecção de overbooking
- Confirmação automática 24h antes
- Lembrete 2h antes
- Processamento de resposta de confirmação
- Registro automático de no-shows

#### Não Incluído (Out of Scope - MVP)
- Lista de espera automática (P2 - Sprint 4)
- Reagendamento automático pós-cancelamento (P1 - Sprint 3)
- Regras diferenciadas para pacientes reincidentes (P2 - Sprint 5)

### Requisitos Funcionais Relacionados

| RF ID | Descrição | Prioridade |
|-------|-----------|------------|
| RF-2.1.1 | Agendar consultas via conversa natural | P0 |
| RF-2.1.2 | Verificar disponibilidade em tempo real | P0 |
| RF-2.1.3 | Suportar múltiplos profissionais/agendas | P0 |
| RF-2.1.4 | Permitir reagendamento via conversa | P0 |
| RF-2.1.5 | Permitir cancelamento via conversa | P0 |
| RF-2.1.6 | Sugerir horários alternativos | P1 |
| RF-2.1.8 | Detectar e prevenir overbooking | P0 |
| RF-2.2.1 | Enviar confirmação automática 24h antes | P0 |
| RF-2.2.2 | Enviar lembrete 2h antes | P0 |
| RF-2.2.3 | Processar resposta de confirmação automaticamente | P0 |
| RF-2.2.5 | Notificar clínica quando paciente não confirma | P1 |
| RF-2.3.1 | Registrar automaticamente no-shows | P0 |

### User Journeys Atendidas

| UJ ID | Nome | Cobertura |
|-------|------|-----------|
| UJ-02 | Agendamento via WhatsApp | 100% |
| UJ-03 | Confirmação de Consulta | 100% |
| UJ-04 | Reagendamento | 100% |

### Critérios de Aceitação

```gherkin
Scenario: Agendar consulta via conversa
  Given um paciente envia "Quero marcar para quinta"
  When o sistema processa a mensagem
  Then deve verificar disponibilidade na quinta
  And deve apresentar opções de horários disponíveis
  And deve permitir confirmação em uma única interação adicional

Scenario: Previnir overbooking
  Given um horário tem 1 vaga disponível
  When dois pacientes tentam agendar simultaneamente
  Then apenas um deve conseguir confirmar
  And o outro deve receber sugestão de horário alternativo

Scenario: Confirmação automática
  Given uma consulta está agendada para amanhã
  When faltam 24 horas para a consulta
  Then o sistema deve enviar mensagem de confirmação
  And o sistema deve processar a resposta automaticamente
  And o sistema deve atualizar o status do agendamento
```

### Dependências

| Depêndencia | Tipo | Status |
|-------------|------|--------|
| E-01: Atendimento Multicanal | Funcional | Em desenvolvimento |
| Supabase (banco de dados) | Técnica | Definido na Arquitetura |
| Sistema de notificações | Técnica | A implementar |

### Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Conflito de horários | Alta | Alto | Lock otimista no banco, validação dupla |
| Falha no envio de lembretes | Média | Médio | Sistema de retry + fallback para outros canais |
| Interpretação incorreta de datas | Média | Médio | Validação com confirmação explícita |

### Estimativa

- **Story Points**: 21
- **Sprints**: 2 (Sprint 2-3)
- **Time**: 1 Backend + 1 AI Engineer

### KPIs / Success Metrics

| Métrica | Target | Como Medir |
|---------|--------|------------|
| No-show rate | <10% (redução de 30%) | Dashboard de agendamentos |
| Taxa de agendamento automático | >90% | Logs de agendamentos |
| Conflitos de horário | 0 | Monitoramento de overbooking |
| Taxa de confirmação | >85% | Status de confirmações |
| Tempo para agendar | <2 min conversa | Análise de transcripts |

### Definition of Ready (DoR)

- [ ] E-01 com funcionalidades básicas de mensagem
- [ ] Schema de agendamentos criado no banco
- [ ] Regras de disponibilidade definidas
- [ ] Templates de confirmação/lembrete aprovados
- [ ] Job scheduler configurado (cron/queue)

### Definition of Done (DoD)

- [ ] Agendamento via conversa natural funcionando
- [ ] Verificação de disponibilidade em tempo real
- [ ] Prevenção de overbooking testada
- [ ] Confirmação automática 24h funcionando
- [ ] Lembretes 2h funcionando
- [ ] Registro de no-shows automático
- [ ] Testes de concorrência passando
- [ ] Documentação de fluxos de agendamento

---

## Epic E-03: Follow-up e Retenção

### Visão do Epic

**Como** clínica odontológica
**Quero** um sistema de follow-up automatizado
**Para que** meus pacientes retornem regularmente e a receita seja maximizada

### Objetivos de Negócio

- Aumentar taxa de retorno em 25%
- Recuperar 20% de pacientes inativos
- Automatizar comunicação pós-consulta
- Identificar oportunidades de revenuta

### Escopo

#### Incluído (In Scope)
- Follow-up automático pós-consulta (2h depois)
- Orientações pós-procedimento personalizadas
- Lembretes de retorno baseados em regras
- Identificação de pacientes inativos (30/60/90 dias)
- Campanhas de reativação automáticas
- Identificação de orçamentos não convertidos
- Sequência de follow-up para orçamentos pendentes
- Alertas sobre tratamentos incompletos

#### Não Incluído (Out of Scope - MVP)
- Mensagem de aniversário (P2 - Sprint 5)
- Notificação de inadimplência (P2 - Sprint 6)
- Tags automáticas baseadas em comportamento (P2 - Sprint 5)

### Requisitos Funcionais Relacionados

| RF ID | Descrição | Prioridade |
|-------|-----------|------------|
| RF-3.1.1 | Enviar follow-up automático pós-consulta | P0 |
| RF-3.1.2 | Enviar orientações pós-procedimento personalizadas | P1 |
| RF-3.1.3 | Enviar lembrete de retorno baseado em regras | P1 |
| RF-3.1.4 | Identificar pacientes inativos | P1 |
| RF-3.1.5 | Enviar campanhas de reativação automáticas | P1 |
| RF-3.2.1 | Identificar orçamentos não convertidos | P1 |
| RF-3.2.2 | Enviar sequência de follow-up para orçamentos pendentes | P1 |
| RF-3.2.3 | Alertar sobre tratamentos incompletos | P1 |

### User Journeys Atendidas

| UJ ID | Nome | Cobertura |
|-------|------|-----------|
| UJ-05 | Pós-Atendimento | 100% |
| UJ-06 | Reativação de Paciente Inativo | 100% |

### Critérios de Aceitação

```gherkin
Scenario: Follow-up pós-consulta
  Given um paciente acabou de ser atendido
  When passam 2 horas após o horário da consulta
  Then o sistema deve enviar mensagem de follow-up
  And a mensagem deve incluir orientações do procedimento realizado
  And a mensagem deve solicitar feedback

Scenario: Identificação de paciente inativo
  Given um paciente não retorna há 60 dias
  When o sistema executa verificação diária
  Then o paciente deve ser marcado como "Inativo 60 dias"
  And uma campanha de reativação deve ser agendada
  And a mensagem deve incluir oferta personalizada

Scenario: Recuperação de orçamento
  Given um paciente recebeu um orçamento há 7 dias
  When o orçamento não foi convertido
  Then o sistema deve enviar follow-up
  And o sistema deve oferecer facilidades de pagamento
  And o sistema deve notificar o vendedor responsável
```

### Dependências

| Depêndencia | Tipo | Status |
|-------------|------|--------|
| E-02: Gestão de Agendamentos | Funcional | Planejado Sprint 2 |
| E-04: CRM Inteligente | Funcional | Planejado Sprint 2 |
| Sistema de campanhas | Técnica | A implementar |

### Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Mensagens percebidas como spam | Média | Alto | Personalização, opt-out claro, limitar frequência |
| Timing inadequado | Baixa | Médio | Configurável por paciente, horários preferenciais |
| Falha na identificação de inativos | Baixa | Médio | Job diário robusto, logs de auditoria |

### Estimativa

- **Story Points**: 13
- **Sprints**: 2 (Sprint 3-4)
- **Time**: 1 Backend + 1 AI Engineer (parcial)

### KPIs / Success Metrics

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Taxa de retorno | +25% vs baseline | Cohort analysis |
| Pacientes inativos recuperados | 20% | Dashboard de reativação |
| Taxa de conversão orçamentos | +15% | Pipeline de vendas |
| Engajamento pós-consulta | >60% respostas | Taxa de resposta follow-up |

### Definition of Ready (DoR)

- [ ] E-02 com agendamentos funcionando
- [ ] E-04 com cadastro de pacientes
- [ ] Templates de follow-up definidos
- [ ] Regras de timing configuráveis
- [ ] Sistema de campanhas básico

### Definition of Done (DoD)

- [ ] Follow-up pós-consulta automatizado
- [ ] Identificação de pacientes inativos
- [ ] Campanhas de reativação funcionando
- [ ] Recuperação de orçamentos pendentes
- [ ] Alertas de tratamentos incompletos
- [ ] Opt-out funcionando corretamente
- [ ] Logs de consentimento LGPD

---

## Epic E-04: CRM Inteligente

### Visão do Epic

**Como** clínica odontológica
**Quero** um CRM centralizado com dados de pacientes
**Para que** eu possa conhecer meus pacientes e personalizar o atendimento

### Objetivos de Negócio

- Centralizar informações de pacientes
- Automatizar cadastro via conversa
- Manter histórico completo de atendimentos
- Permitir segmentação para campanhas

### Escopo

#### Incluído (In Scope)
- Cadastro completo de pacientes
- Cadastro via conversa (extração automática)
- Histórico de atendimentos
- Registro de preferências e observações
- Tags manuais em pacientes
- Segmentação para campanhas

#### Não Incluído (Out of Scope - MVP)
- Cálculo de LTV (Lifetime Value) (P2 - Sprint 6)
- Score de engajamento (P2 - Sprint 6)
- Tags automáticas baseadas em comportamento (P2 - Sprint 5)
- Identificação de pacientes em risco de churn (P2 - Sprint 6)

### Requisitos Funcionais Relacionados

| RF ID | Descrição | Prioridade |
|-------|-----------|------------|
| RF-4.1.1 | Manter cadastro completo de pacientes | P0 |
| RF-4.1.2 | Permitir cadastro via conversa | P0 |
| RF-4.1.3 | Manter histórico de atendimentos | P0 |
| RF-4.1.4 | Registrar preferências e observações | P1 |
| RF-4.2.1 | Permitir tags manuais em pacientes | P1 |
| RF-4.2.3 | Permitir segmentação para campanhas | P1 |

### User Journeys Atendidas

| UJ ID | Nome | Cobertura |
|-------|------|-----------|
| UJ-01 | Primeiro Contato - WhatsApp | Parcial (cadastro) |

### Critérios de Aceitação

```gherkin
Scenario: Cadastro via conversa
  Given um novo paciente envia mensagem
  When o sistema detecta que é um paciente novo
  Then o sistema deve solicitar informações básicas
  And o sistema deve extrair dados automaticamente da conversa
  And o sistema deve criar o cadastro do paciente

Scenario: Histórico de atendimentos
  Given um paciente tem histórico de consultas
  When o dentista acessa o perfil do paciente
  Then deve visualizar todas as consultas anteriores
  And deve visualizar procedimentos realizados
  And deve visualizar observações registradas

Scenario: Segmentação para campanhas
  Given o administrador quer criar uma campanha
  When seleciona critérios de segmentação
  Then o sistema deve listar pacientes que atendem aos critérios
  And deve permitir preview da lista
  And deve permitir exportar para campanha
```

### Dependências

| Depêndencia | Tipo | Status |
|-------------|------|--------|
| E-01: Atendimento Multicanal | Funcional | Em desenvolvimento |
| Supabase (banco de dados) | Técnica | Definido na Arquitetura |

### Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Dados incorretos extraídos da conversa | Média | Médio | Validação com confirmação, edição manual |
| LGPD - consentimento | Alta | Alto | Opt-in explícito, logs de consentimento |
| Duplicação de pacientes | Média | Médio | Deduplicação por CPF/telefone |

### Estimativa

- **Story Points**: 13
- **Sprints**: 2 (Sprint 2-3)
- **Time**: 1 Backend + 1 Frontend (parcial)

### KPIs / Success Metrics

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Cadastros via conversa | >70% | Taxa de cadastros automatizados |
| Completude de cadastro | >90% campos preenchidos | Análise de registros |
| Duplicação de pacientes | <5% | Rate de duplicatas detectadas |
| Tempo para cadastro completo | <3 min conversa | Análise de transcripts |

### Definition of Ready (DoR)

- [ ] E-01 com processamento de mensagens
- [ ] Schema de pacientes criado
- [ ] Campos obrigatórios definidos
- [ ] RLS (Row-Level Security) configurado
- [ ] Política LGPD definida

### Definition of Done (DoD)

- [ ] Cadastro completo de pacientes
- [ ] Extração automática de dados via conversa
- [ ] Histórico de atendimentos
- [ ] Tags manuais funcionando
- [ ] Segmentação para campanhas
- [ ] Consentimento LGPD registrado
- [ ] Testes de RLS passando

---

## Epic E-05: Vendas e Conversão

### Visão do Epic

**Como** clínica odontológica
**Quero** ferramentas de vendas automatizadas
**Para que** eu possa converter mais leads em pacientes pagantes

### Objetivos de Negócio

- Capturar leads de todos os canais
- Qualificar leads automaticamente
- Agendar avaliações automaticamente
- Aumentar taxa de conversão em 20%

### Escopo

#### Incluído (In Scope)
- Captura de leads de todos os canais
- Qualificação automática de leads
- Agendamento automático de avaliações
- Follow-up pós-orçamento
- Notificação sobre leads quentes

#### Não Incluído (Out of Scope - MVP)
- Templates de propostas (P2 - Sprint 6)
- Calculadora de procedimentos (P2 - Sprint 7)
- Integração com opções de financiamento (P2 - Sprint 8)

### Requisitos Funcionais Relacionados

| RF ID | Descrição | Prioridade |
|-------|-----------|------------|
| RF-5.1.1 | Capturar leads de todos os canais | P0 |
| RF-5.1.2 | Qualificar leads automaticamente | P1 |
| RF-5.1.3 | Agendar avaliações automaticamente | P0 |
| RF-5.1.4 | Fazer follow-up pós-orçamento | P1 |
| RF-5.1.5 | Notificar dono sobre leads quentes | P1 |

### User Journeys Atendidas

| UJ ID | Nome | Cobertura |
|-------|------|-----------|
| - | Conversão de Lead | Novo |

### Critérios de Aceitação

```gherkin
Scenario: Captura de lead
  Given um visitante envia mensagem no Instagram
  When demonstra interesse em procedimento
  Then o sistema deve criar um lead
  And deve classificar a fonte (Instagram)
  And deve iniciar fluxo de qualificação

Scenario: Qualificação automática
  Given um lead foi criado
  When o sistema executa qualificação
  Then deve aplicar scoring baseado em respostas
  And deve categorizar (quente/morno/frio)
  And deve rotear para ação apropriada

Scenario: Lead quente
  Given um lead é classificado como "quente"
  When o scoring é calculado
  Then o sistema deve notificar o responsável
  And deve priorizar agendamento
  And deve registrar no pipeline de vendas
```

### Dependências

| Depêndencia | Tipo | Status |
|-------------|------|--------|
| E-01: Atendimento Multicanal | Funcional | Em desenvolvimento |
| E-04: CRM Inteligente | Funcional | Planejado Sprint 2 |

### Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Qualificação incorreta | Média | Médio | Ajuste contínuo de scoring, override manual |
| Perda de leads | Baixa | Alto | Backup de leads, alertas de não-atendidos |

### Estimativa

- **Story Points**: 8
- **Sprints**: 2 (Sprint 3-5)
- **Time**: 1 Backend (50% alocação)

### KPIs / Success Metrics

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Taxa de conversão de leads | +20% | Pipeline de vendas |
| Leads qualificados automaticamente | >80% | Taxa de qualificação |
| Tempo para agendar avaliação | <10 min | Logs de agendamento |
| Follow-up pós-orçamento | 100% em 24h | Monitoramento de sequências |

### Definition of Ready (DoR)

- [ ] E-01 com atendimento multicanal
- [ ] E-04 com cadastro de pacientes
- [ ] Critérios de qualificação definidos
- [ ] Scoring model aprovado

### Definition of Done (DoD)

- [ ] Captura de leads de todos os canais
- [ ] Qualificação automática funcionando
- [ ] Agendamento de avaliações
- [ ] Notificações de leads quentes
- [ ] Pipeline de vendas visível
- [ ] Métricas de conversão no dashboard

---

## Epic E-06: Marketing e Redes Sociais

### Visão do Epic

**Como** clínica odontológica
**Quero** ferramentas de marketing automatizado
**Para que** eu possa atrair novos pacientes sem dedicar tempo manual

### Objetivos de Negócio

- Automatizar postagens no Instagram
- Responder comentários automaticamente
- Gerar conteúdo com IA
- Integrar com Meta Ads

### Escopo

#### Incluído (In Scope)
- Criação de campanhas de captação
- Automação de postagens no Instagram
- Geração de conteúdo com IA
- Resposta automática a comentários
- Integração com Meta Ads

#### Não Incluído (Out of Scope)
- N/A (Epics não-MVP podem ter escopo completo definido)

### Requisitos Funcionais Relacionados

| RF ID | Descrição | Prioridade |
|-------|-----------|------------|
| RF-6.1.1 | Permitir criação de campanhas de captação | P2 |
| RF-6.1.2 | Automatizar postagens no Instagram | P2 |
| RF-6.1.3 | Gerar conteúdo com IA | P2 |
| RF-6.1.4 | Responder comentários automaticamente | P2 |
| RF-6.1.5 | Integrar com Meta Ads | P3 |

### User Journeys Atendidas

| UJ ID | Nome | Cobertura |
|-------|------|-----------|
| - | Atração via Redes Sociais | Novo |

### Critérios de Aceitação

```gherkin
Scenario: Postagem automática no Instagram
  Given uma campanha está configurada
  When chega o horário agendado
  Then o sistema deve publicar o conteúdo
  And deve registrar métricas de engajamento
  And deve responder comentários automaticamente

Scenario: Geração de conteúdo com IA
  Given o usuário solicita conteúdo para Instagram
  When o sistema gera o conteúdo
  Then deve sugerir imagem + legenda
  And deve permitir edição antes de publicar
  And deve manter tom de voz da clínica
```

### Dependências

| Depêndencia | Tipo | Status |
|-------------|------|--------|
| E-01: Atendimento Multicanal | Funcional | MVP |
| Instagram Graph API (publish) | Externa | A configurar |
| Meta Business Suite | Externa | A configurar |

### Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Rejeição de conteúdo pela Meta | Média | Médio | Pré-moderação, guidelines claros |
| API changes do Instagram | Alta | Médio | Abstração de API, monitoramento |
| Conteúdo inadequado gerado | Baixa | Alto | Revisão humana antes de publicar |

### Estimativa

- **Story Points**: 13
- **Sprints**: 2 (Sprint 7-8)
- **Time**: 1 Backend + 1 AI Engineer

### KPIs / Success Metrics

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Engajamento em posts | +30% vs manual | Instagram Insights |
| Leads via Instagram | 20% do total | Attribution tracking |
| Tempo poupado em gestão social | 5h/semana | Time tracking |

### Definition of Ready (DoR)

- [ ] E-01 com Instagram DM funcionando
- [ ] Perfil Business do Instagram conectado
- [ ] Política de conteúdo definida
- [ ] Templates de campanha aprovados

### Definition of Done (DoD)

- [ ] Postagens automáticas funcionando
- [ ] Geração de conteúdo com IA
- [ ] Resposta a comentários
- [ ] Métricas de engajamento
- [ ] Integração Meta Ads básica
- [ ] Documentação de uso

**Status**: Não-MVP (Pós-MVP)

---

## Epic E-07: Call Center com IA

### Visão do Epic

**Como** clínica odontológica
**Quero** um sistema de call center automatizado com IA
**Para que** eu possa fazer e receber ligações automaticamente

### Objetivos de Negócio

- Fazer ligações automáticas de lembrete
- Fazer follow-up via voz
- Receber ligações com atendimento IA
- Transcrever chamadas em tempo real

### Escopo

#### Incluído (In Scope)
- Ligações automáticas para lembretes
- Ligações de follow-up
- Ligações de reativação
- Transcrição em tempo real
- Análise de sentimento
- Atendimento IA inbound
- Triagem de chamadas
- Transferência para humano

### Requisitos Funcionais Relacionados

| RF ID | Descrição | Prioridade |
|-------|-----------|------------|
| RF-7.1.1 | Fazer ligações automáticas para lembretes | P2 |
| RF-7.1.2 | Fazer ligações de follow-up | P2 |
| RF-7.1.3 | Fazer ligações de reativação | P2 |
| RF-7.1.4 | Transcrever ligações em tempo real | P2 |
| RF-7.1.5 | Analisar sentimento da chamada | P3 |
| RF-7.2.1 | Receber ligações e atender com IA | P2 |
| RF-7.2.2 | Fazer triagem de chamadas | P2 |
| RF-7.2.3 | Transferir para humano quando necessário | P2 |

### User Journeys Atendidas

| UJ ID | Nome | Cobertura |
|-------|------|-----------|
| - | Atendimento via Voz | Novo |

### Critérios de Aceitação

```gherkin
Scenario: Ligação de lembrete
  Given um paciente tem consulta amanhã
  When o sistema faz a ligação automática
  Then deve identificar o paciente por telefone
  And deve confirmar a consulta via voz
  And deve processar a resposta do paciente
  And deve atualizar o status do agendamento

Scenario: Atendimento inbound com IA
  Given uma ligação é recebida
  When o sistema atende com IA
  Then deve cumprimentar o paciente
  And deve identificar a intenção da chamada
  And deve transferir para humano se necessário

Scenario: Transcrição em tempo real
  Given uma chamada está em andamento
  When o paciente fala
  Then o sistema deve transcrever em <2s
  And deve exibir na interface do atendente
  And deve armazenar para análise posterior
```

### Dependências

| Depêndencia | Tipo | Status |
|-------------|------|--------|
| E-02: Gestão de Agendamentos | Funcional | MVP |
| E-03: Follow-up e Retenção | Funcional | MVP |
| Twilio/Vonage API | Externa | A configurar |
| Text-to-Speech provider | Externa | A configurar |
| Speech-to-Text provider | Externa | A configurar |

### Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Qualidade de voz insuficiente | Média | Alto | Testar múltiplos providers, fallback |
| Latência de resposta alta | Alta | Alto | Edge processing, otimização de áudio |
| Custo elevado de minutos | Média | Médio | Threshold de duração, retry logic |
| Não reconhecimento de fala | Média | Médio | Múltiplos modelos, confirmação explícita |

### Estimativa

- **Story Points**: 21
- **Sprints**: 2 (Sprint 9-10)
- **Time**: 2 Backend + 1 AI Engineer

### KPIs / Success Metrics

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Taxa de confirmação via voz | >80% | Dashboard de ligações |
| Tempo médio de ligação | <60s | Logs de chamadas |
| Satisfação do paciente | >4.0/5.0 | Survey pós-chamada |
| Taxa de transferência humana | <20% | Analytics de chamadas |

### Definition of Ready (DoR)

- [ ] E-02 e E-03 estáveis em produção
- [ ] Conta Twilio/Vonage provisionada
- [ ] Números de telefone adquiridos
- [ ] Modelos de voz testados
- [ ] Compliance LGPD para gravações

### Definition of Done (DoD)

- [ ] Ligações outbound funcionando
- [ ] Ligações inbound funcionando
- [ ] Transcrição em tempo real
- [ ] Análise de sentimento básica
- [ ] Transferência para humano
- [ ] Logs de chamadas completos
- [ ] Documentação de uso e compliance

**Status**: Não-MVP (Pós-MVP)

---

## Epic E-08: Dashboard e Gestão

### Visão do Epic

**Como** gestor da clínica
**Quero** um dashboard com métricas e relatórios
**Para que** eu possa tomar decisões baseadas em dados

### Objetivos de Negócio

- Visualizar métricas-chave em tempo real
- Acompanhar performance do agente IA
- Calcular ROI da plataforma
- Exportar relatórios

### Escopo

#### Incluído (In Scope)
- Dashboard com métricas principais
- Relatório de agendamentos
- Relatório de pacientes
- Métricas do WhatsApp
- ROI - Retorno sobre Investimento
- Relatórios de performance do agente IA
- Exportação PDF/CSV

#### Não Incluído (Out of Scope - MVP)
- Analytics avançado (P2)
- Previsões com ML (P3)

### Requisitos Funcionais Relacionados

| RF ID | Descrição | Prioridade |
|-------|-----------|------------|
| RF-8.1.* | Dashboard Principal | P1 |
| RF-8.2.* | Relatórios e Analytics | P1 |

### User Journeys Atendidas

| UJ ID | Nome | Cobertura |
|-------|------|-----------|
| - | Gestão e Análise | Novo |

### Critérios de Aceitação

```gherkin
Scenario: Dashboard principal
  Given o gestor acessa o dashboard
  When a página carrega
  Then deve visualizar métricas do dia
  And deve visualizar comparativo com período anterior
  And deve visualizar alertas de atenção

Scenario: Cálculo de ROI
  Given o sistema tem dados de uso
  When o gestor acessa a seção de ROI
  Then deve visualizar valor economizado (horas de atendente)
  And deve visualizar receita gerada (agendamentos)
  And deve visualizar comparativo mensal
```

### Estimativa

- **Story Points**: 8
- **Sprints**: 2 (Sprint 3-4)
- **Time**: 1 Frontend (100%) + 1 Backend (30% alocação)

### KPIs / Success Metrics

| Métrica | Target | Como Medir |
|---------|--------|------------|
| ROI calculado automaticamente | 100% das clínicas | Dashboard de ROI |
| Tempo para carregar dashboard | <2s | Performance monitoring |
| Adoção do dashboard | >80% dos gestores | Logs de acesso |
| Exportações de relatórios | >10/mês/clínica | Contagem de exports |

### Definition of Ready (DoR)

- [ ] Dados de agendamentos disponíveis (E-02)
- [ ] Dados de pacientes disponíveis (E-04)
- [ ] Dados de mensagens disponíveis (E-01)
- [ ] Definição de métricas de ROI
- [ ] Design do dashboard aprovado

### Definition of Done (DoD)

- [ ] Dashboard com métricas principais
- [ ] Relatórios de agendamentos
- [ ] Relatórios de pacientes
- [ ] Cálculo de ROI funcional
- [ ] Exportação PDF/CSV
- [ ] Filtros por período
- [ ] Responsivo para mobile
- [ ] Testes de performance passando

---

## Resumo MVP

### Epics MVP (6 Epics)

| Ordem | Epic | Story Points | Sprint | Prioridade | Dependências |
|-------|------|--------------|--------|------------|--------------|
| 1 | E-01: Atendimento Multicanal | 34 | 1-2 | P0 | Nenhuma |
| 2 | E-04: CRM Inteligente | 13 | 2-3 | P0 | E-01 |
| 3 | E-02: Gestão de Agendamentos | 21 | 2-3 | P0 | E-01, E-04 |
| 4 | E-03: Follow-up e Retenção | 13 | 3-4 | P0 | E-02, E-04 |
| 5 | E-08: Dashboard e Gestão | 8 | 3-4 | P1 | E-01, E-02, E-04 |
| 6 | E-05: Vendas e Conversão | 8 | 3-5 | P1 | E-01, E-04 |
| | **Total MVP** | **97** | **5 Sprints** | | |

### Timeline MVP (5 Sprints)

```
Sprint 1     Sprint 2     Sprint 3     Sprint 4     Sprint 5
├────────────┼────────────┼────────────┼────────────┼────────────┤
│ E-01 (34)  │ E-01       │ E-02 (21)  │ E-03 (13)  │ E-05 (8)   │
│            │ E-04 (13)  │ E-04       │ E-08 (8)   │            │
│            │ E-02 (início)│           │            │            │
└────────────┴────────────┴────────────┴────────────┴────────────┘
```

### Epics Pós-MVP (2 Epics)

| Epic | Story Points | Sprint | Prioridade | Pré-requisitos |
|------|--------------|--------|------------|----------------|
| E-06: Marketing e Redes Sociais | 13 | 7-8 | P2 | MVP completo |
| E-07: Call Center com IA | 21 | 9-10 | P2 | MVP + E-06 |
| **Total Pós-MVP** | **34** | **4 Sprints** | | |

### Total do Projeto

| Métrica | Valor |
|---------|-------|
| Total de Epics | 8 |
| Total de Story Points | 131 |
| Duração Total | 10 Sprints |
| Epics MVP | 6 (97 SP) |
| Epics Pós-MVP | 2 (34 SP) |

---

## Próximos Passos

1. **Validar Epics** com stakeholder
2. **Criar Stories** para cada Epic (usar `bmad-create-story`)
3. **Priorizar Stories** dentro de cada Epic
4. **Estimar Stories** em Story Points
5. **Planejar Sprint 1** com E-01

---

**Documento criado por:** BMAD Method v6.2.2
**Data:** 2026-03-27
**Atualizado em:** 2026-03-27
**Status:** ✅ Epics Revisados e Melhorados - Aguardando Stories