# Synkroo

## What This Is

Synkroo é um aplicativo de calendário/kanban com integração WhatsApp para clínicas. Permite gerenciar agendamentos, eventos e comunicação via chatbot. Está evoluindo para uma plataforma completa de gestão de relacionamento (CRM) com foco inicial em clínicas de odontologia.

## Core Value

Clínicas conseguem gerenciar todo o relacionamento com pacientes — do primeiro contato à fidelização — em um único sistema integrado com WhatsApp e calendário.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Calendário com views Month/Week/Day — v0.1.0
- ✓ Drag-and-drop de eventos — v0.1.0
- ✓ Edição de agendamentos via dialog — v0.1.0
- ✓ WhatsApp bot com QR code — v0.1.0
- ✓ Dashboard com charts (cash flow) — v0.1.0
- ✓ Autenticação via Supabase Auth — v0.1.0

### Active

<!-- Current scope. Building toward these. -->

- [ ] CRM completo para clínicas de odontologia
- [ ] Gestão de contatos (leads, ativos, inativos)
- [ ] Pipeline de vendas com funil customizável
- [ ] Prontuário modular com campos customizáveis
- [ ] Histórico de interações (agendamentos, no-shows, WhatsApp)
- [ ] Automações (lembretes WhatsApp, follow-up)
- [ ] Relatórios e oportunidades de negócio
- [ ] Integração WhatsApp (visualizar, enviar, automatizar)
- [ ] Integração com calendário existente

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Integração com Instagram — futura, após CRM estável
- Call center — futura, depende de infra de voz
- Agent SDK (IA) — futura, depende de CRM + dados estruturados
- Multi-tenancy complexo — MVP foca em uma clínica por conta
- Prontuário médico normativo (PEC/CFM) — fora do escopo inicial, requer compliance

## Context

- **Stack:** Next.js 15, React 19, Supabase (PostgreSQL), Tailwind CSS, Radix UI, Zustand, TanStack Query
- **Calendário:** @event-calendar/core (Month/Week/Day views)
- **WhatsApp:** Custom bot com Evolution API (não qrcode-terminal)
- **Auth:** Supabase Auth com middleware
- **Banco:** Supabase com tabelas existentes: events, profiles, patients, leads, lead_activities, dentists, procedures, campaigns, campaign_recipients, conversations, messages, whatsapp_instances, follow_ups, follow_up_configs, appointments, waitlist, multi_agent_queue, knowledge_base
- **UI existente:** Dashboard com páginas para leads, pacientes, campanhas, conversas, lista-espera, dentistas, procedimentos, analytics, agendamentos
- **Dependências relevantes:** jspdf + jspdf-autotable (PDF), cmdk (command palette), @radix-ui/react-tabs, lucide-react, date-fns, recharts 3.x
- **Nicho inicial:** Clínicas de odontologia (diversos portes)
- **Modularidade:** Arquitetura deve permitir migração para outros nichos
- **Futuro:** Instagram, call center, agent SDK — CRM deve ser base para essas features

## Constraints

- **Tech stack:** Next.js 15 + Supabase + Tailwind (manter consistência)
- **Database:** PostgreSQL via Supabase (RLS obrigatório)
- **WhatsApp:** Usar infra existente do Evolution API (já integrado)
- **Modularidade:** Componentes devem ser reutilizáveis por nicho
- **UX:** Interface em português, voltada para profissionais de saúde

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Foco inicial em odontologia | Domínio mais estruturado para validar CRM modular | — Pending |
| Funil customizável | Cada tipo de clínica tem etapas diferentes no pipeline | — Pending |
| Prontuário modular | Campos customizáveis permitem adaptação por especialidade | — Pending |
| Integração profunda com calendário | Agendamentos são core do negócio, não feature separada | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-24 after milestone v0.2.0 started*
