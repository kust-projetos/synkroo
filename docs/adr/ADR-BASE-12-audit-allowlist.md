# ADR-BASE-12: Audit Allowlist (Minimização LGPD)

**Status:** ✅ Implementado  
**Data:** 2026-07-29 (allowlist implementado)

## Decisão

Auditoria usa allowlist: somente campos explicitamente permitidos são registrados. Isso minimiza PII em logs de auditoria (REQ-LGPD-02). Rejeitado: payload bruto + denylist.

## Evidência

- `src/core/actions/audit-writer.ts`: `allowlistInput(input, allowed)` — filtra input para somente campos permitidos
- `src/core/actions/types.ts`: `ActionDefinition.allowedAuditFields?: string[]`
- `src/core/actions/run.ts`: usa `allowlistInput()` em vez de `redactInput()`
- `src/core/actions/__tests__/audit-writer.test.ts`: 10 testes validando allowlist, zero PII

## Alternativas rejeitadas

- Denylist (redactInput): invertido — esquecer um campo sensível vaza PII
- Payload bruto: viola LGPD

## Gap

- `allowedAuditFields` precisa ser definido em cada ActionDefinition existente (gradual)
- Ações sem allowlist logam `{}` (seguro, mas perde informação de auditoria)
