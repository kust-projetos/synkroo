# Synkroo

## What This Is

Synkroo é uma plataforma CRM completa para clínicas de odontologia, com integração WhatsApp e calendário. Gerencia todo o relacionamento com pacientes — do primeiro contato à fidelização — em um sistema integrado.

## Core Value

Clínicas conseguem gerenciar todo o relacionamento com pacientes — do primeiro contato à fidelização — em um único sistema integrado com WhatsApp e calendário.

## Requirements

### Validated

<!-- v0.1.0 — Calendar & WhatsApp Foundation -->

- ✓ Calendário com views Month/Week/Day — v0.1.0
- ✓ Drag-and-drop de eventos — v0.1.0
- ✓ Edição de agendamentos via dialog — v0.1.0
- ✓ WhatsApp bot com QR code — v0.1.0
- ✓ Dashboard com charts (cash flow) — v0.1.0
- ✓ Autenticação via Supabase Auth — v0.1.0

<!-- v0.2.0 — CRM Completo -->

- ✓ CRM completo para clínicas de odontologia — v0.2.0
- ✓ Gestão unificada de contatos (leads + pacientes) — v0.2.0
- ✓ Pipeline de vendas com Kanban drag-drop — v0.2.0
- ✓ Lead scoring e conversão lead→paciente — v0.2.0
- ✓ Custom fields por especialidade — v0.2.0
- ✓ Timeline unificada de interações — v0.2.0
- ✓ Consentimento LGPD com audit trail — v0.2.0
- ✓ WhatsApp in-app messaging — v0.2.0
- ✓ Lembretes automáticos de consulta — v0.2.0
- ✓ Campanhas WhatsApp (reativação, follow-up, birthday) — v0.2.0
- ✓ Planos de tratamento multi-sessão — v0.2.0
- ✓ Orçamentos com items e parcelas — v0.2.0
- ✓ Pagamentos e controle financeiro — v0.2.0
- ✓ Relatórios de pipeline e financeiro — v0.2.0
- ✓ Export LGPD e anonimização — v0.2.0

### Active

<!-- Next milestone scope — not yet defined -->

- [ ] v0.3.0 — Not yet defined

### Out of Scope

- Integração com Instagram — futura, após CRM estável
- Call center — futura, depende de infra de voz
- Agent SDK (IA) — futura, depende de CRM + dados estruturados
- Multi-tenancy complexo — MVP foca em uma clínica por conta
- Prontuário médico normativo (PEC/CFM) — fora do escopo, requer compliance

## Context

- **Stack:** Next.js 15, React 19, Supabase (PostgreSQL), Tailwind CSS, Radix UI, Zustand, TanStack Query
- **Calendário:** @event-calendar/core (Month/Week/Day views)
- **WhatsApp:** Evolution API com bot integrado
- **Auth:** Supabase Auth com middleware
- **Banco:** Supabase com tabelas: events, profiles, patients, leads, lead_activities, dentists, procedures, campaigns, campaign_recipients, conversations, messages, whatsapp_instances, follow_ups, follow_up_configs, appointments, waitlist, multi_agent_queue, knowledge_base, pipeline_stages, custom_field_definitions, custom_field_values, consents, clinic_tags, patient_observations, treatment_plans, budgets, budget_items, installments, payments
- **UI:** Dashboard com páginas: contatos, pipeline, campanhas, conversas, lista-espera, analytics, configuracao
- **Dependências:** jspdf + jspdf-autotable, @hello-pangea/dnd, react-resizable-panels, recharts
- **Nicho:** Clínicas de odontologia (diversos portes)
- **LOC:** ~74,719 linhas TypeScript/TSX

## Constraints

- **Tech stack:** Next.js 15 + Supabase + Tailwind (manter consistência)
- **Database:** PostgreSQL via Supabase (RLS obrigatório)
- **WhatsApp:** Evolution API (já integrado)
- **Modularidade:** Componentes reutilizáveis por nicho
- **UX:** Interface em português, profissionais de saúde

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Foco inicial em odontologia | Domínio mais estruturado para validar CRM modular | ✓ Validado em v0.2.0 |
| Funil customizável com Kanban | Odontologia tem etapas bem definidas (Novo→Contatado→Qualificado→Proposta→Negociação→Convertido) | ✓ Validado |
| Prontuário modular (custom fields) | Permite adaptação por especialidade sem refatoração | ✓ Validado |
| LGPD consent desde o início | Requisito legal para营销 e dados de saúde | ✓ Implementado com audit trail |
| WhatsApp in-app em vez de external | Melhora experiência, reduz contexto switching | ✓ Validado |
| PIPE-05 (WhatsApp lead capture) adiado | Requer webhook Evolution API maduro | Deferred to v0.3.0 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-27 after v0.2.0 milestone shipped*
