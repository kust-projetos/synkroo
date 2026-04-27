# Phase 2: Pipeline & Sales - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 2-Pipeline & Sales
**Areas discussed:** Kanban Layout, Lead Scoring, Source Tracking, Lead Conversion

---

## Kanban Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Colunas na horizontal (Trello-style) | Stages como colunas horizontais (mais espaço p/ cards) | ✓ |
| Grid 2D (stage × priority) | Stages como colunas + sub-colunas por prioridade/idade | |
| Lista vertical por stage | Stages no topo, leads abaixo em lista compacta | |

**User's choice:** Colunas na horizontal (Trello-style)
**Notes:** Prefere o padrão Trello clássico

### Card Content

| Option | Description | Selected |
|--------|-------------|----------|
| Nome + telefone + fonte + score | Compacto | |
| Nome + data último contato + score + tags | Nome + último contato + score + tags | ✓ |
| Claude decides (minimal vs full) | Cliente escolhe | |

**User's choice:** Nome + data último contato + score + tags

---

## Lead Scoring

| Option | Description | Selected |
|--------|-------------|----------|
| Por tipo de interação (WhatsApp > Llamada > Email > Visita) | Score = soma interação recente | |
| Por recência (interações recentes valem mais) | Quanto mais recente, maior o score | |
| Híbrido (tipo + recência) | Score = soma ponderada: recentes pesam mais que antigas | ✓ |

**User's choice:** Híbrido (tipo + recência)

### Score Display

| Option | Description | Selected |
|--------|-------------|----------|
| Número simples | Ex: 8.5 ou 42 | |
| Barra de progresso | Barra visual de 0-100% | ✓ |
| Badge c/ cor (Low/Med/High) | Low/Medium/High ou A/B/C | |

**User's choice:** Barra de progresso

---

## Source Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| WhatsApp + Manual + Referral | Leads criados via chatbot ou manualmente | |
| + Website + Paid Media | Adiciona website + campanhas paid media | ✓ |

**User's choice:** Todas as fontes (WhatsApp, Manual, Referral, Website, Paid Media)

### Tracking Method

| Option | Description | Selected |
|--------|-------------|----------|
| Campo fixo no lead (enum) | source_type TEXT CHECK | |
| Campo livre (text) + sugestões | Mais flexível | |
| Claude decides | WhatsApp auto-detecta, os outros são escolha manual | |

**User's choice:** De forma automática

---

## Lead Conversion

| Option | Description | Selected |
|--------|-------------|----------|
| appointment.confirmed = true | Qualquer appointment confirmado | |
| appointment pago (any payment) | Pago = qualquer payment_received | ✓ |
| Conversion manual + automated | Pessoa escolhe quando converter manualmente | ✓ |

**User's choice:** Conversion manual + automated, com gatilho automático sendo procedure paid

---

## Deferred Ideas

- Lead priority levels (urgent/normal/slow) — could be added as second dimension (grid 2D) — future phase
- Pipeline analytics (conversion rate per stage, avg time in stage) — Phase 5 or later
- Automated reactivation campaigns for stale leads — Phase 3 (WhatsApp CRM)