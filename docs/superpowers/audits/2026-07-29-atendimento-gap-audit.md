# Atendimento e Canais — Gap Audit (REQ-ATD-01 a 06)

**Data:** 2026-07-29

| REQ | Tipo | Status | Evidência |
|---|---|---|---|
| ATD-01 | event-driven | ✅ | `conversations-repository.ts` — dedup por externalMessageId |
| ATD-02 | event-driven | ✅ | `widget/messages/route.ts` — armazena + invoca agente IA (mesmo pipeline WhatsApp) |
| ATD-03 | event-driven | ✅ | `getClinicByInstance` / `getClinicByPhoneNumber` — deriva clínica da credencial |
| ATD-04 | state-driven | ✅ | `send.ts` — fallback Evolution→Playwright, falha visível sem simular |
| ATD-05 | ubiquitous | ✅ | ADR-BASE-09 — Playwright sidecar default off |
| ATD-06 | event-driven | ✅ | `personas.ts` — identifica como IA + oferece takeover proativamente; `escalar-conversa.ts` — ação de escalação |
