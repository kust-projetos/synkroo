# ADR-BASE-10: API camelCase com `{ data, meta? }`

**Status:** ✅ Implementado  
**Data:** 2026-07-29 (builders + contract tests criados)

## Decisão

Toda resposta de API segue contrato uniforme:
```ts
type ApiSuccess<T> = { data: T; meta?: { cursor?: string; total?: number } };
type ApiFailure = { error: { code: string; message: string; requestId: string } };
```
JSON e TypeScript usam `camelCase`. IDs são UUID. Datas ISO 8601 UTC.

## Evidência

- `src/lib/api/response.ts`: builders `apiSuccess()`, `apiFailure()`, `apiErrors`, `generateRequestId()`
- `src/__tests__/api/contract/response-format.test.ts`: 17 contract tests validando formato
- `src/lib/api/__tests__/response.test.ts`: unit tests para builders

## Alternativas rejeitadas

- snake_case: adotado camelCase por consistência com TypeScript/JS
- Envelopes ad hoc: contrato uniforme via builders

## Gap

- Migração de rotas existentes para usar builders (gradual)
- Lint rule ou middleware de conformidade (futuro)
