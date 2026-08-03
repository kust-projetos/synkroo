# Comercial, CRM e Retenção — Gap Audit

**Data:** 2026-07-29

| REQ | Status | Evidência |
|---|---|---|
| COM-01 | ✅ | `capturar-lead.ts`, `qualificar-lead.ts`, `mesclar-leads.ts` — dedup + scoring + pipeline |
| COM-02 | ✅ | `converter-lead.ts`, `lead-conversion-service.ts` — conversão sem duplicar |
| CRM-01 | ✅ | `listar-contatos.ts` — read model unificado, não ownership de pacientes/leads |
| CRM-02 | ✅ | `executar-merge-lead.ts`, `executar-merge-patient.ts` — merge com redirect |
| FUP-01 | ✅ | `executar-followup.ts` + `followup.service.ts` — execução idempotente por feedback existente |
| FUP-02 | ✅ | `campaign.service.ts` — execução agendada real; campanha falha quando nenhum recipient é entregue |

## Verification local

- Focused suites: 40 suites, 335 tests passed, 5 skipped.
- `npx tsc --noEmit` — passou.
- ESLint scoped to commercial/CRM/follow-up — passou.
- Added regression coverage for linked-patient tenant rejection, scheduled campaign execution, and zero-delivery failure.

## Blocker de aceite

J-06/J-07 exigem execução em staging com provider real e evidência de lead→cobrança/campanha consentida. Staging/credenciais não estão disponíveis nesta sessão; aceite externo permanece pendente.
