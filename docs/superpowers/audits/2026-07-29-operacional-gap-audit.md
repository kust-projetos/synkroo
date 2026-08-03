# Operação Clínica — Gap Audit (REQ-OPS-01 a 06)

**Data:** 2026-07-29  
**Spec:** `docs/superpowers/specs/2026-07-28-synkroo-canonical-product-architecture.md` §3

## Resumo

| REQ | Tipo | Status | Evidência |
|---|---|---|---|
| OPS-01 | event-driven | ✅ | `patients-repository.ts` — CRUD com clinicId, dedup CPF/phone |
| OPS-02 | event-driven | ✅ | `scheduling-service.ts` — catch 23P01 (exclusion constraint) |
| OPS-03 | event-driven | ✅ | `scheduling-service.ts` — ao cancelar, processa waitlist e notifica candidato |
| OPS-04 | unwanted | ✅ | `treatment-plans/[id]/sessions/route.ts` — `verifyOwnership()` cross-clinic |
| OPS-05 | event-driven | ✅ | `scheduling-service.ts` — wired into confirmar/cancelar/registrarNoShow + migration 0008 |
| OPS-06 | event-driven | ✅ | migration 0008 — unique constraint `treatment_plan_items_plan_session_uniq` |
