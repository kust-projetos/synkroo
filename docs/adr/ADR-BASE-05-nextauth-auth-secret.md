# ADR-BASE-05: NextAuth v4 + AUTH_SECRET único ≥32 bytes

**Status:** ✅ Implementado  
**Data:** 2026-07-29 (JWT_SECRET removido, AUTH_SECRET obrigatório)

## Decisão

NextAuth/Auth.js v4 como único sistema de autenticação. `AUTH_SECRET` único, obrigatório, ≥32 bytes. Eliminar `JWT_SECRET` paralelo — NextAuth gerencia JWT internamente.

## Evidência

- `src/lib/env.ts`: `AUTH_SECRET` é `.min(32)` obrigatório (sem `.optional()`)
- `src/app/api/auth/login/route.ts`: usa somente `AUTH_SECRET`, sem fallback para `JWT_SECRET`
- `worker-configuration.d.ts`: `JWT_SECRET` removido do ProcessEnv
- Middleware (`src/middleware.ts`): NextAuth JWT via `getToken()`

## Alternativas rejeitadas

- `JWT_SECRET` paralelo: removido conforme spec

## Gap

Nenhum. ADR-BASE-05 implementado conforme spec.
