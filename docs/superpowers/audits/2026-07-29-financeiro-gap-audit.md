# Financeiro — Gap Audit (REQ-FIN-01 a 03)

**Data:** 2026-07-29

| REQ | Status | Evidência |
|---|---|---|
| FIN-01 | ✅ | `charge-service.ts:33-42` — cross-verify amount vs `budget.finalValue`, rejeita divergência |
| FIN-02 | ✅ | `charge-service.ts:50-53` — throw Error quando provider ausente (testado) |
| FIN-03 | ✅ | `asaas/webhook.ts` — gateway event, payment charge status e payment persistidos na mesma transaction; FK usa charge local |

## Verification local

- Financial suites: 13 suites, 101 tests passed.
- `npx tsc --noEmit` — passou.
- ESLint scoped to financeiro — passou.
- Regression test covers local charge FK and charge-status transition on settlement.

## Blocker de aceite

J-06 exige staging com Asaas real, webhook autenticado e reconciliação pós-evento. Staging/credenciais não estão disponíveis nesta sessão; aceite externo permanece pendente.
