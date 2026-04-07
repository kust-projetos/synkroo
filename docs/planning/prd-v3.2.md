---
stepsCompleted: []
inputDocuments:
  - product-brief.md
  - market-research.md
  - technical-research.md
  - domain-research.md
workflowType: prd
version: 3.2
validation: BMAD v6.2.2
---

# Product Requirements Document - Synkroo

**Author:** Walis
**Date:** 2026-03-26
**Version:** 3.4 (BMAD Compliant - Full Traceability)
**Status:** ✅ Validado BMAD
**Based on:** Product Brief v2.1

---

## Executive Summary

**Synkroo** é uma plataforma de automação empresarial com agente IA que atende, agenda e converte pacientes 24/7 para clínicas.

**Diferencial Único:** Agente IA que vê, fala e faz - não só conversa, mas executa tarefas, atende por voz, e opera de forma proativa.

| Aspecto | Valor |
|---------|-------|
| **Módulos MVP** | 6 (Core, WhatsApp, Scheduling, CRM, Dashboard, Follow-up) |
| **Agentes** | Single AgentService with multi-LLM provider factory (MiniMax default, OpenAI, OpenRouter, Groq, Claude-via-proxy) |
| **Canais** | WhatsApp (via Evolution API v2.3.7), Instagram, Chat Widget |
| **MVP Timeline** | 8 semanas |
| **Margem Alvo** | 95%+ |

**Target Users:** Clínicas odontológicas e de estética com 1-10 profissionais, faturamento R$ 50-200k/mês, que perdem pacientes por falta de atendimento 24/7.

---

## 1. Success Criteria (SMART)

| ID | Critério | Métrica | Baseline | Target | Prazo |
|----|----------|---------|----------|--------|-------|
| **SC-01** | Redução de no-show | Taxa de não comparecimento | 20% | <10% | +3 meses |
| **SC-02** | Aumento de agendamentos | Agendamentos/mês via canal automatizado | 0 | +30% | +3 meses |
| **SC-03** | Tempo de resposta | Tempo médio primeira resposta | 4h+ | <30s | +1 mês |
| **SC-04** | Taxa de conversão | Visitante → Agendamento | 5% | 15% | +3 meses |
| **SC-05** | Satisfação NPS | Net Promoter Score | N/A | >50 | +3 meses |
| **SC-06** | Custo por agendamento | Custo operacional/agendamento | R$ 15 | R$ 5 | +2 meses |

### 1.1 Success Criteria → NFR Traceability

| SC ID | NFRs Relacionados | Como o NFR Suporta o SC |
|-------|-------------------|-------------------------|
| **SC-01** | NFR-04, NFR-10 | Lembretes em <10s + 99.9% uptime garantem confirmação |
| **SC-02** | NFR-01, NFR-02, NFR-06 | API <200ms + Agent <5s + 1000 usuários concurrentes |
| **SC-03** | NFR-02 | Agent response time <5s (90º percentil) |
| **SC-04** | NFR-16, NFR-17 | Task completion >80% + Error recovery <3 cliques |
| **SC-05** | NFR-16, NFR-17, NFR-18 | Usability metrics + WCAG 2.1 AA accessibility |
| **SC-06** | NFR-06, NFR-07, NFR-08 | Scalability (100 clinics, 10k msgs/day) reduz custo marginal |

---

## 2. Product Scope

### 2.1 MVP (Semanas 1-8)

| Módulo | Capacidades | Prioridade |
|--------|-------------|------------|
| **Core** | Multi-tenant, auth, RLS, audit | Must Have |
| **WhatsApp** | Conexão, envio/recebimento, QR code | Must Have |
| **Scheduling** | Agendar, cancelar, reagendar, lembretes | Must Have |
| **CRM** | Cadastro pacientes, histórico, busca | Must Have |
| **Dashboard** | KPIs, agenda do dia, alertas | Must Have |
| **Follow-up** | Sequências pós-consulta, pesquisa satisfação | Should Have |

### 2.2 Growth (Semanas 9-16)

- Instagram DM integration
- Voice AI (call center)
- Advanced analytics
- Multi-location support

### 2.3 Vision (Ano 1+)

- Marketplace de clínicas
- White-label para franquias
- AI voice cloning
- Predictive scheduling

### 2.4 Out of Scope (MVP)

- App mobile nativo (PWA responsivo)
- Integração ERP externo
- Pagamentos online
- Prontuário eletrônico

---

## 3. User Journeys

> **Ver detalhes visuais em:** `docs/ux-design.md`

### 3.1 UJ-01: Agendamento via WhatsApp

**Persona:** João Pedro (Paciente Recorrente)
**Cenário:** João quer agendar limpeza dental

| Step | Ação | Sistema | Touchpoint | Pain Point Resolvido |
|------|------|---------|------------|----------------------|
| 1 | Envia "Oi, quero agendar" | Router classifica intenção (confidence 0.92) | WhatsApp | Espera resposta humana |
| 2 | Escolhe procedimento | Scheduler oferece opções | WhatsApp | Não sabe quais procedimentos |
| 3 | Escolhe profissional | Scheduler mostra disponibilidade | WhatsApp | Não sabe horários livres |
| 4 | Confirma agendamento | Sistema cria appointment + lembretes | WhatsApp → DB | Esquece de confirmar |
| 5 | Recebe confirmação | Agente envia resumo + lembretes agendados | WhatsApp | Medo de perder consulta |

**Métricas de Sucesso:**
- Tempo total: <3 minutos (vs 10-15 min ligando)
- Taxa de conclusão: >70%
- Satisfação: >4.5/5

**FRs Relacionados:** FR-01, FR-03, FR-05, FR-07, FR-15

---

### 3.2 UJ-02: Cancelamento/Reagendamento

**Persona:** Bruno (Paciente com histórico de no-show)
**Cenário:** Bruno não pode ir na consulta marcada

| Step | Ação | Sistema | Touchpoint | Pain Point Resolvido |
|------|------|---------|------------|----------------------|
| 1 | Envia "Não vou conseguir ir amanhã" | Router identifica cancelamento (confidence 0.88) | WhatsApp | Vergonha de ligar |
| 2 | Agente oferece reagendamento | Scheduler mostra alternativas | WhatsApp | Perde consulta |
| 3 | Bruno escolhe novo horário | Sistema atualiza appointment | WhatsApp → DB | Perde dinheiro |
| 4 | Recebe confirmação nova data | Lembretes reagendados | WhatsApp | Confusão de datas |

**Métricas de Sucesso:**
- Taxa de reagendamento: >60%
- Redução de no-show: 50%
- Tempo de resposta: <30s

**FRs Relacionados:** FR-04, FR-05, FR-16

---

### 3.3 UJ-03: Primeiro Atendimento (Novo Paciente)

**Persona:** Fernanda (Paciente Novo)
**Cenário:** Fernanda pesquisa clínicas e manda mensagem

| Step | Ação | Sistema | Touchpoint | Pain Point Resolvido |
|------|------|---------|------------|----------------------|
| 1 | Envia "Qual o valor do clareamento?" | Sales agent responde com preços | WhatsApp | Resposta demora |
| 2 | Pergunta horários disponíveis | Scheduler mostra agenda | WhatsApp | Não consegue comparar |
| 3 | Agenda consulta | Sistema cria paciente + appointment | WhatsApp → DB | Processo lento |
| 4 | Recebe lembrete dia anterior | Lembrete automático | WhatsApp | Esquecimento |

**Métricas de Sucesso:**
- Taxa de conversão: >15%
- Tempo até agendamento: <5 min
- First response: <30s

**FRs Relacionados:** FR-01, FR-02, FR-06, FR-08

---

### 3.4 UJ-04: Gerenciamento de Agenda (Admin)

**Persona:** Dra. Marina (Proprietária)
**Cenário:** Marina quer ver agenda do dia e identificar gaps

| Step | Ação | Sistema | Touchpoint | Pain Point Resolvido |
|------|------|---------|------------|----------------------|
| 1 | Acessa dashboard | Auth valida sessão | Web App | Login demorado |
| 2 | Vê agenda do dia | Dashboard mostra appointments | Web App | Agenda desorganizada |
| 3 | Vê alertas de no-show | Sistema destaca pacientes risco | Web App | Não sabe quem faltará |
| 4 | Intervém em conversa | Admin assume chat | Web App → WhatsApp | Perde controle |

**Métricas de Sucesso:**
- Tempo até visão completa: <10s
- Ações por sessão: >3
- Alertas acionáveis: >80%

**FRs Relacionados:** FR-09, FR-10, FR-11, FR-17

---

### 3.5 UJ-05: Setup Inicial (Onboarding)

**Persona:** Dra. Marina (Proprietária)
**Cenário:** Primeiro acesso após contratar Synkroo

| Step | Ação | Sistema | Touchpoint | Pain Point Resolvido |
|------|------|---------|------------|----------------------|
| 1 | Recebe convite email | Auth cria conta | Email → Web | Processo confuso |
| 2 | Cria senha | Auth valida força | Web App | Esquece senha |
| 3 | Configura clínica | Setup wizard coleta dados | Web App | Muita configuração |
| 4 | Conecta WhatsApp | Gera QR code | Web App → WhatsApp | Tecnologia difícil |
| 5 | Treina agente | Knowledge base alimentada | Web App | Agente genérico |
| 6 | Faz teste | Agente responde corretamente | WhatsApp | Incerteza |

**Métricas de Sucesso:**
- Tempo de onboarding: <30 min
- Taxa de conclusão: >90%
- Primeiro valor: <1h

**FRs Relacionados:** FR-18, FR-19, FR-20

---

### 3.6 UJ-06: Intervenção Humana

**Persona:** Carlos (Atendente)
**Cenário:** Agente não consegue resolver e escala para humano

| Step | Ação | Sistema | Touchpoint | Pain Point Resolvido |
|------|------|---------|------------|----------------------|
| 1 | Agente detecta limite | Confidence < 0.7 após 3 tentativas | WhatsApp | Paciente frustrado |
| 2 | Escala para humano | Notificação para atendente | Web App | Perde contexto |
| 3 | Carlos assume conversa | Contexto transferido | Web App → WhatsApp | Repete informações |
| 4 | Resolve problema | Carlos responde manualmente | WhatsApp | Demora resposta |
| 5 | Sistema aprende | Conversa salva para treino | DB | Repete erro |

**Métricas de Sucesso:**
- Taxa de escalação: <15%
- Tempo de transferência: <30s
- Satisfação pós-intervenção: >4/5

**FRs Relacionados:** FR-12, FR-13, FR-14

---

## 4. Domain Requirements

### 4.1 LGPD Compliance (Brasil)

| ID | Requisito | Descrição | Prioridade |
|----|-----------|-----------|------------|
| **DR-01** | Consentimento | Coletar consentimento explícito para dados pessoais | Must Have |
| **DR-02** | Direito ao Esquecimento | Permitir exclusão completa de dados do paciente | Must Have |
| **DR-03** | Portabilidade | Exportar dados do paciente em formato estruturado | Should Have |
| **DR-04** | Audit Trail | Registrar todas as operações com dados pessoais | Must Have |
| **DR-05** | Retenção | Política de retenção e deleção automática | Should Have |

### 4.2 Segurança de Dados de Saúde

| ID | Requisito | Descrição | Prioridade |
|----|-----------|-----------|------------|
| **DR-06** | Criptografia | Dados em repouso e trânsito criptografados (AES-256, TLS 1.3) | Must Have |
| **DR-07** | Isolamento Multi-tenant | Row-Level Security por clinic_id | Must Have |
| **DR-08** | Backup | Backups diários com retenção 30 dias | Must Have |
| **DR-09** | MFA | Autenticação multifator para admin | Should Have |

---

## 5. Functional Requirements

> **Formato BMAD:** Cada FR tem ID único, origem (User Journey), métrica e prioridade MoSCoW.

### 5.1 Comunicação (WhatsApp)

| ID | Requisito | Origem | Métrica | Prioridade |
|----|-----------|--------|---------|------------|
| **FR-01** | Pacientes podem enviar mensagens via WhatsApp e receber resposta automatizada | UJ-01, UJ-03 | Resposta <30s, 24/7 | Must Have |
| **FR-02** | Clínicas podem conectar múltiplos números WhatsApp | UJ-05 | Até 5 números/clínica | Must Have |
| **FR-03** | Sistema classifica intenção da mensagem com confidence score | UJ-01, UJ-02 | Acurácia >85% | Must Have |
| **FR-04** | Sistema detecta quando não consegue resolver e escala para humano | UJ-06 | Taxa <15% | Must Have |
| **FR-05** | Histórico de conversas disponível para consulta | UJ-04, UJ-06 | Últimas 100 mensagens | Must Have |

### 5.2 Agendamento

| ID | Requisito | Origem | Métrica | Prioridade |
|----|-----------|--------|---------|------------|
| **FR-06** | Pacientes podem agendar consultas via conversa natural | UJ-01, UJ-03 | <3 min, <5 turnos | Must Have |
| **FR-07** | Sistema verifica disponibilidade em tempo real | UJ-01 | Latência <1s | Must Have |
| **FR-08** | Sistema confirma agendamento com resumo detalhado | UJ-01, UJ-03 | Confirmação <5s | Must Have |
| **FR-09** | Clínicas podem bloquear horários na agenda | UJ-04 | Bloqueio instantâneo | Must Have |
| **FR-10** | Sistema envia lembretes automáticos (24h e 2h antes) | UJ-01 | Entrega >99% | Must Have |
| **FR-11** | Pacientes podem cancelar agendamentos via WhatsApp | UJ-02 | Cancelamento <1 min | Must Have |
| **FR-12** | Sistema oferece reagendamento automático após cancelamento | UJ-02 | Taxa de reagendamento >60% | Should Have |

### 5.3 Gestão de Pacientes

| ID | Requisito | Origem | Métrica | Prioridade |
|----|-----------|--------|---------|------------|
| **FR-13** | Sistema cria cadastro de paciente automaticamente na primeira interação | UJ-03 | Criação <2s | Must Have |
| **FR-14** | Clínicas podem buscar pacientes por nome, telefone, ou CPF | UJ-04 | Resultado <500ms | Must Have |
| **FR-15** | Sistema mantém histórico de atendimentos por paciente | UJ-01, UJ-04 | Histórico completo | Must Have |
| **FR-16** | Sistema calcula score de risco de no-show por paciente | UJ-04 | Acurácia >70% | Should Have |

### 5.4 Dashboard e Admin

| ID | Requisito | Origem | Métrica | Prioridade |
|----|-----------|--------|---------|------------|
| **FR-17** | Dashboard mostra KPIs em tempo real (agendamentos, no-show, mensagens) | UJ-04 | Atualização <5s | Must Have |
| **FR-18** | Admin pode intervir em qualquer conversa ativa | UJ-04, UJ-06 | Transferência <3s | Must Have |
| **FR-19** | Sistema gera alertas para situações que requerem atenção humana | UJ-04 | Alerta em tempo real | Must Have |
| **FR-20** | Wizard de onboarding guia configuração inicial em <30 min | UJ-05 | Completude >90% | Must Have |

### 5.5 Inteligência e Memória

| ID | Requisito | Origem | Métrica | Prioridade |
|----|-----------|--------|---------|------------|
| **FR-21** | Agente mantém contexto de conversas anteriores | UJ-01 | Recall de contexto >90% | Must Have |
| **FR-22** | Clínicas podem treinar base de conhecimento com FAQs | UJ-05 | Treinamento <5 min | Must Have |
| **FR-23** | Sistema aprende com intervenções humanas | UJ-06 | Melhoria contínua | Should Have |
| **FR-24** | Agente personaliza respostas conforme perfil da clínica | UJ-05 | Personalização 100% | Should Have |

---

## 6. Non-Functional Requirements

> **Formato BMAD:** Cada NFR tem métrica, condição e método de medição.

### 6.1 Performance

| ID | Requisito | Métrica | Condição | Método de Medição |
|----|-----------|---------|----------|-------------------|
| **NFR-01** | API response time | <200ms | 95º percentil, carga normal | APM (New Relic/Datadog) |
| **NFR-02** | Agent response time | <5s | 90º percentil, LLM Provider API | Logging interno |
| **NFR-03** | Dashboard load time | <2s | 95º percentil, primeira carga | Lighthouse CI |
| **NFR-04** | WhatsApp message delivery | <10s | 99º percentil | Webhook timing |
| **NFR-05** | Database query time | <50ms | 99º percentil, queries indexadas | Database monitoring console |

### 6.2 Scalability

| ID | Requisito | Métrica | Condição | Método de Medição |
|----|-----------|---------|----------|-------------------|
| **NFR-06** | Concurrent users | 1,000 | Por clínica, sem degradação | Load testing (k6) |
| **NFR-07** | Clinics per instance | 100 | MVP, sem mudança de arquitetura | Capacity planning |
| **NFR-08** | Messages per day | 10,000 | Por clínica, sem rate limiting | Message queue metrics |

### 6.3 Availability

| ID | Requisito | Métrica | Condição | Método de Medição |
|----|-----------|---------|----------|-------------------|
| **NFR-09** | Uptime | 99.9% | Durante horário comercial (8h-20h) | Cloud provider SLA |
| **NFR-10** | Recovery time | <15 min | Após falha crítica | Runbook testing |
| **NFR-11** | Data durability | 99.999999999% | Zero perda de dados | Cloud provider SLA |

### 6.4 Security

| ID | Requisito | Métrica | Condição | Método de Medição |
|----|-----------|---------|----------|-------------------|
| **NFR-12** | Authentication | JWT + RLS | Todos os endpoints | Managed auth provider |
| **NFR-13** | Data isolation | Zero cross-tenant access | 100% das queries | RLS policy tests |
| **NFR-14** | Encryption at rest | AES-256 | Todos os dados sensíveis | Infrastructure configuration |
| **NFR-15** | Encryption in transit | TLS 1.3 | Todas as conexões | SSL Labs A+ |

### 6.5 Usability

| ID | Requisito | Métrica | Condição | Método de Medição |
|----|-----------|---------|----------|-------------------|
| **NFR-16** | Task completion rate | >80% | Primeiro uso, sem treinamento | Usability testing |
| **NFR-17** | Error recovery | <3 cliques | Para corrigir erros comuns | UX audit |
| **NFR-18** | Accessibility | WCAG 2.1 AA | Todo o dashboard | Axe audit |

---

## 7. Requirements Traceability Matrix

> **BMAD Requirement:** Cada requisito deve rastrear para User Journey e Success Criteria.

| FR ID | User Journey | Success Criteria | Epic (Estimado) |
|-------|--------------|-------------------|-----------------|
| FR-01 | UJ-01, UJ-03 | SC-03 | E01: WhatsApp Integration |
| FR-02 | UJ-05 | SC-06 | E01: WhatsApp Integration |
| FR-03 | UJ-01, UJ-02 | SC-03 | E02: Agent Intelligence |
| FR-04 | UJ-06 | SC-05 | E02: Agent Intelligence |
| FR-05 | UJ-04, UJ-06 | SC-05 | E03: Dashboard |
| FR-06 | UJ-01, UJ-03 | SC-02 | E04: Scheduling |
| FR-07 | UJ-01 | SC-02 | E04: Scheduling |
| FR-08 | UJ-01, UJ-03 | SC-02 | E04: Scheduling |
| FR-09 | UJ-04 | SC-01 | E04: Scheduling |
| FR-10 | UJ-01 | SC-01 | E04: Scheduling |
| FR-11 | UJ-02 | SC-01 | E04: Scheduling |
| FR-12 | UJ-02 | SC-01 | E04: Scheduling |
| FR-13 | UJ-03 | SC-02 | E05: CRM |
| FR-14 | UJ-04 | SC-05 | E05: CRM |
| FR-15 | UJ-01, UJ-04 | SC-05 | E05: CRM |
| FR-16 | UJ-04 | SC-01 | E06: Intelligence |
| FR-17 | UJ-04 | SC-02 | E03: Dashboard |
| FR-18 | UJ-04, UJ-06 | SC-05 | E03: Dashboard |
| FR-19 | UJ-04 | SC-05 | E03: Dashboard |
| FR-20 | UJ-05 | SC-06 | E07: Onboarding |
| FR-21 | UJ-01 | SC-05 | E06: Intelligence |
| FR-22 | UJ-05 | SC-06 | E06: Intelligence |
| FR-23 | UJ-06 | SC-05 | E06: Intelligence |
| FR-24 | UJ-05 | SC-05 | E06: Intelligence |

---

## 8. Innovation Analysis

### 8.1 Competitive Differentiation

| Feature | Synkroo | Concorrente A | Concorrente B | Gap |
|---------|---------|---------------|---------------|-----|
| AI Agent 24/7 | ✅ Proativo | ⚠️ Reativo | ❌ Não tem | Alto |
| Voice AI | ✅ Planejado | ❌ Não tem | ❌ Não tem | Médio |
| Multi-channel | ✅ WA + IG + Chat | ⚠️ WA only | ⚠️ WA only | Médio |
| Implementation | ✅ <1 semana | ⚠️ 2-4 semanas | ⚠️ 1-2 semanas | Alto |
| Pricing | ✅ Setup + Mensal | ⚠️ Alto custo | ⚠️ Por mensagem | Alto |

### 8.2 Technical Moat

1. **4+1 Multi-Agent Architecture** - Roteamento inteligente com lazy activation
   > **Implementation Note:** Simplified to a single `AgentService` with a multi-LLM provider factory pattern (MiniMax M2.7 default, with OpenAI, OpenRouter, Groq, and Claude-via-proxy support). See ADR-002.
2. **5-Layer Memory System** - Contexto persistente e personalizável
3. **MCP Server Integration** - Tool calling estruturado e extensível
4. **Multi-tenant Data Isolation** - Segurança por design (ver Architecture para detalhes técnicos)
5. **Evolution API Integration** - WhatsApp via Evolution API v2.3.7 (Docker, MySQL + Redis). Supports LID addressing mode (remoteJid with @lid suffix) with remoteJidAlt fallback for contact resolution.

---

## 9. Roadmap

### 9.1 Sprint 1-2: Core + Canais (2 semanas)

| Entregável | FRs | Status |
|------------|-----|--------|
| Multi-tenant setup + Auth | FR-02, NFR-12, NFR-13 | Pending |
| Database schema (20 tabelas) | FR-13, FR-15 | Pending |
| WhatsApp integration via Evolution API v2.3.7 | FR-01, FR-02 | Done |
| Router Agent básico (single AgentService + multi-LLM factory) | FR-03 | Done |

**Checkpoints:**
- [ ] Auth funcionando com RLS
- [x] WhatsApp enviando/recebendo via Evolution API v2.3.7
- [x] Agent classificando intenções (multi-LLM provider factory, MiniMax M2.7 default)

> **Note (2026-03-29):** WhatsApp integration uses Evolution API v2.3.7 (Docker) instead of Playwright. Evolution API uses LID format for contacts (`remoteJid` with `@lid` suffix), requiring `remoteJidAlt` fallback for phone number resolution.

---

### 9.2 Sprint 3-4: Agendamento + CRM (2 semanas)

| Entregável | FRs | Status |
|------------|-----|--------|
| CRUD Agendamentos | FR-06, FR-07, FR-08 | Pending |
| Lembretes automáticos | FR-10 | Pending |
| CRUD Pacientes | FR-13, FR-14 | Pending |
| Scheduler Agent | FR-06, FR-07 | Pending |

**Checkpoints:**
- [ ] Agendamento end-to-end
- [ ] Lembretes enviando
- [ ] Dashboard básico

---

### 9.3 Sprint 5-6: Inteligência + Dashboard (2 semanas)

| Entregável | FRs | Status |
|------------|-----|--------|
| Memory system | FR-21 | Pending |
| Knowledge base | FR-22 | Pending |
| Dashboard completo | FR-17, FR-19 | Pending |
| Human escalation | FR-04, FR-18 | Pending |

**Checkpoints:**
- [ ] Agente com memória
- [ ] Dashboard com métricas
- [ ] Escalação funcionando

---

### 9.4 Sprint 7-8: Piloto + Refinamento (2 semanas)

| Entregável | FRs | Status |
|------------|-----|--------|
| Onboarding wizard | FR-20 | Pending |
| Clínica piloto | Todos | Pending |
| Bug fixes | - | Pending |
| Documentação | - | Pending |

**Checkpoints:**
- [ ] 1 clínica ativa
- [ ] ROI documentado
- [ ] NPS > 50

---

## 10. Risks and Mitigations

> **Ver análise completa de 30 riscos em:** `docs/planning/prd-v3.1.md` Seção 5

### 10.1 Top 5 Critical Risks

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| WhatsApp Web mudar estrutura | Alta | Alto | Evolution API v2.37 (Docker) is the primary provider; handles connection stability internally |
| Alucinação em resposta médica | Média | Muito Alto | Disclaimer; não diagnóstico; escalar humano |
| Ban de número por automação | Média | Alto | Rate limiting humano-like; warm-up; pool backup |
| Cliente não pagar setup | Média | Médio | 50% upfront; demo completa antes |
| Scope creep no MVP | Alta | Alto | Freeze após Sprint 1; change request |

---

## 11. Appendices

### 11.1 Related Documents

| Documento | Path | Status |
|-----------|------|--------|
| Product Brief v2.1 | `docs/planning/product-brief.md` | ✅ Aprovado |
| Market Research | `docs/planning/market-research.md` | ✅ Completo |
| Technical Research | `docs/planning/technical-research.md` | ✅ Completo |
| Domain Research | `docs/planning/domain-research.md` | ✅ Completo |
| UX Design v2.0 | `docs/ux-design.md` | ✅ Aprovado |
| Architecture v1.0 | `docs/architecture.md` | ✅ Aprovado |
| BMAD Validation Report | `docs/planning/bmad-validation-report.md` | ✅ Completo |

### 11.2 Glossary

| Termo | Definição |
|-------|-----------|
| **RLS** | Row-Level Security - isolamento de dados por tenant |
| **MCP** | Model Context Protocol - padrão de tool calling |
| **No-show** | Paciente que agenda e não comparece |
| **Confidence Score** | Probabilidade do agente ter classificado corretamente |

### 11.3 Approval

| Role | Nome | Data | Assinatura |
|------|------|------|------------|
| Product Owner | Walis | 2026-03-26 | _____________ |
| Tech Lead | TBD | - | _____________ |
| Stakeholder | TBD | - | _____________ |

---

**Document Status:** ✅ BMAD Compliant
**Next Step:** Architecture v1.1 (ADRs + Performance Targets)
**Generated by:** BMAD Method v6.2.2