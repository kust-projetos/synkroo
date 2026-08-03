# Agente IA — Gap Audit (REQ-IA-01 a 07)

**Data:** 2026-07-29

| REQ | Tipo | Status | Evidência |
|---|---|---|---|
| IA-01 | event-driven | ✅ | `tool-policy.ts` — `AGENT_SAFE_ACTIONS` deny-by-default |
| IA-02 | state-driven | ✅ | `security-matrix.ts` — nível `LIVRE` para leitura/comunicação |
| IA-03 | event-driven | ✅ | `security-matrix.ts` — nível `CONFIRMACAO` exige `confirmed` flag |
| IA-04 | unwanted | ✅ | `security-matrix.ts` — `proibido` → `escalate_human` deny-by-default |
| IA-05 | unwanted | ✅ | `bridge-service.ts` — 10 error handlers, fail-closed |
| IA-06 | event-driven | ✅ | `knowledge/search/route.ts` — pgvector com fallback keyword; `test` mock atualizado |
| IA-07 | unwanted | ✅ | `webhook-router.ts` — classificação determinística pré-LLM, emergência escala imediatamente |
