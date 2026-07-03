# Eixo 2 — Módulo Follow-up e Retenção (E-03, Onda 1) — Design

> **Tipo:** Spec de módulo (design). Terceiro módulo da Onda 1 (após E-02 e E-01).
> **Data:** 2026-06-23
> **Status:** Aprovado — derivado do roadmap-mestre, sequenciamento e plano de implementação E-03.
> **Escopo:** apenas planejamento/documentação. Implementação por outro agente, guiado pelo plano derivado (`docs/superpowers/plans/2026-06-23-eixo2-e03-followup-retencao-implementation.md`).
> **Dependências:** Core (Onda 0), Operacional (E-02) e Atendimento (E-01) fechados — template canônico, Action Layer, RBAC, manifesto, gates, route-adapter. E-03 consome `atendimento.enviarMensagem` (action) e lê `appointments.status`/`procedures.durationMonths` do E-02.

## 0. Contexto e objetivo

O **Follow-up e Retenção (E-03)** é o módulo de pós-consulta e engajamento de pacientes da Onda 1: gerencia lembretes de retorno, reativação de inativos, campanhas segmentadas, follow-up de orçamentos pendentes e tratamentos incompletos.

**Situação de entrada (verificada em 2026-06-23):** O sistema já possui lógica de follow-up espalhada em services legados (`services/reminders/`, `services/campaigns/`), rotas cron existentes, e tabelas compartilhadas. E-03 consolida esse backend dentro do template canônico: actions de follow-up, cron jobs gated por `assertModuleForJob`, e seams para o Agente IA (W5) consumir via Action Layer.

**Fonte de verdade superior:** `2026-06-17-...-roadmap-design.md` §5 (Action Layer), §6 (template), §9.1 (modularidade). Sequenciamento: `2026-06-21-eixo2-sequenciamento-design.md` (§4, Onda 1 — E-03 depois de E-02 e E-01). Plano de implementação: `docs/superpowers/plans/2026-06-23-eixo2-e03-followup-retencao-implementation.md`.

---

## 1. Princípio organizador — fases ordenadas (backend-first)

Um único spec/plano, fases **F1–F8**, **backend-first**: portar o backend compartilhado uma vez, limpo, e empilhar o resto.

| Fase | Conteúdo | Razão da posição |
|---|---|---|
| **F1 Schema** | Identificar e extrair tabelas de follow-up dedicadas (`followup_logs`, `campaign_logs`, `inactivity_tracking`) para `src/modules/followup/schema/`; bridge para tabelas de outros módulos | Base de dados do domínio |
| **F2 Module scaffold** | Manifest, permissions, barrel exports, bootstrap registration | Infraestrutura do módulo |
| **F3 Follow-up pós-consulta + retorno** | Actions de follow-up pós-consulta (lembrete de retorno baseado em `procedures.durationMonths`) | Core do domínio de retenção |
| **F4 Inatividade + reativação** | Actions para detectar pacientes inativos e disparar reativação | Engajamento sobre base existente |
| **F5 Campanhas + segmentação** | Actions de campanhas segmentadas, portando `campaign.service.ts` | Marketing sobre pacientes |
| **F6 Orçamento + tratamentos incompletos** | Actions de follow-up de orçamentos pendentes e tratamentos incompletos | Complemento financeiro |
| **F7 Cron jobs + gates + rotas** | Cron jobs gated por `assertModuleForJob`; rotas migradas para adapters com `withModuleRoute` | Infraestrutura de execução |
| **F8 Testes + RBAC backfill** | Testes de integração + seed de permissões do módulo | Qualidade e segurança |

---

## 2. Escopo do módulo

| Domínio | Dono | Nota |
|---|---|---|
| Follow-up pós-consulta (lembrete de retorno) | **E-03** | Baseado em `appointments.status === 'completed'` e `procedures.durationMonths` |
| Reativação de pacientes inativos | **E-03** | Detecta inatividade por período configurável |
| Campanhas segmentadas | **E-03** | Porta `campaign.service.ts` como está; sem nova lógica |
| Follow-up de orçamentos | **E-03** | Orçamentos pendentes com follow-up temporal |
| Tratamentos incompletos | **E-03** | Acompanhamento de tratamento não finalizado |
| Envio de mensagens (canal) | **E-01** | E-03 chama `atendimento.enviarMensagem` via Action Layer |
| Agendamento (consultas) | **E-02** | E-03 lê dados de agendamento, não cria |
| Agente IA W5 | **Passo 4 Onda 1** | Fora; consome Actions de E-03 como tools |

---

## 3. Fronteiras arquiteturais

- **Action Layer apenas:** toda operação exposta via `defineAction`; sem bypass para o agente W5.
- **Cron jobs:** usam `assertModuleForJob` para gate; corpo do cron é adapter fino → action.
- **Sem `getDb()` em actions:** services delegam ao repository do módulo.
- **Envio de mensagem:** delega a `atendimento.enviarMensagem` (action) — não duplica lógica de canal.
- **Leitura de agendamentos:** via schema compartilhado (`@/lib/db/schema`), não por acoplamento direto ao repositório do E-02.

---

## 4. Referências

| Documento | Papel |
|---|---|
| `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` | Roadmap-mestre (fonte de verdade superior) |
| `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md` | Sequenciamento da Onda 1 (§4) |
| `docs/superpowers/specs/2026-06-21-eixo2-core-modulo-design.md` | Template canônico (referência de padrão) |
| `docs/superpowers/specs/2026-06-22-eixo2-operacional-modulo-design.md` | Spec do E-02 (lições de revisão) |
| `docs/superpowers/specs/2026-06-23-eixo2-atendimento-modulo-design.md` | Spec do E-01 (lições de revisão) |
| `docs/superpowers/specs/2026-06-23-eixo2-followup-retencao-modulo-design.md` | **Este documento** |
| `docs/superpowers/plans/2026-06-23-eixo2-e03-followup-retencao-implementation.md` | Plano de implementação (derivado deste spec) |
| `docs/planning/epics.md` | Vocabulário canônico (E-03) |
| `docs/planning/stories/e-03-stories.md` | Histórias de usuário (13 SP, 6 stories) |
