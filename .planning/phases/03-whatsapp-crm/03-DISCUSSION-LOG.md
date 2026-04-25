# Phase 3: WhatsApp CRM - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 03-whatsapp-crm
**Areas discussed:** Messaging Integration, Reminder Configuration, Campaign Creation, Delivery Status Tracking

---

## Area 1: Messaging Integration

| Option | Description | Selected |
|--------|-------------|----------|
| A | Expand conversas/ page — full list with contact filter | |
| B | Integrate into contact profile as tab/section — messages inline with timeline | |
| C | Hybrid — conversaciones page as hub + inline messages in contact profile | ✓ |

**User's choice:** C — Hub de conversas + perfil do contato com mensagens inline

**Notes:** Two-tab approach selected: Timeline tab (all interactions) + WhatsApp tab (messages only)

---

## Area 2: Reminder Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| A | Per-contact toggle + global defaults — reminder on/off per patient, timing defaults | |
| B | Per-appointment toggle — reminder option when confirming/scheduling | |
| C | Template-based with smart defaults — reminder templates by type | ✓ |

**User's choice:** C — Templates de lembrete por tipo de procedimento (check-up → 48h, procedimento → 24h)

**Follow-up: Customizable content?**

| Option | Description | Selected |
|--------|-------------|----------|
| A | Fixed templates per type — clinic defines text standard, no variables | |
| B | Templates with variables — placeholders like {{paciente_nome}}, {{data}}, {{horario}}, {{dentista}} | ✓ |
| C | Templates with variables + AI — placeholders + system suggests text based on history | |

**User's choice:** B — placeholders para customização

---

## Area 3: Campaign Creation

| Option | Description | Selected |
|--------|-------------|----------|
| A | Wizard step-by-step — type → filter audience → select template → schedule → confirm | |
| B | Template-first — select template first, system suggests audience automatically | ✓ |
| C | Calendar-based scheduling — drag campaign onto calendar to schedule | |

**User's choice:** B — Template-first com smart audience filters

**Follow-up: Audience filtering?**

| Option | Description | Selected |
|--------|-------------|----------|
| A | Manual filters — select manually: all patients, inactive, specific tags | |
| B | Smart filters per type — each campaign type suggests pre-configured filters | ✓ |
| C | Saved segments — clinics create reusable segments for campaigns | |

**User's choice:** B — Smart filters automáticos por tipo (aniversário → semanal, reativação → 30+ dias inativo)

---

## Area 4: Delivery Status Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| A | Inline badge on each message — icons (✓ sent, ✓✓ delivered, 👁 read) | |
| B | Summary in campaign view — delivery metrics table with counts | |
| C | Both — inline status + campaign-level metrics dashboard | ✓ |

**User's choice:** C — Ambos. Status inline na conversa + métricas agregadas no nível da campanha

---

## Claude's Discretion

Areas where user deferred to implementation:
- Exact placeholder syntax validation
- Campaign wizard UI layout and step flow
- Badge icon design for status
- Filter threshold values (30 days for reactivation, configurable)

## Deferred Ideas

None — discussion stayed within phase scope.