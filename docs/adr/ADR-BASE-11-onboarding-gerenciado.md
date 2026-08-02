# ADR-BASE-11: Onboarding Gerenciado (Sem Signup Público)

**Status:** ✅ Implementado  
**Data:** 2026-07-29 (verificado no middleware)

## Decisão

Onboarding é gerenciado por operador Synkroo. Rotas `/signup` e `/api/auth/signup` retornam 404 em produção. Provisionamento via endpoint administrativo autenticado (REQ-CORE-06).

## Evidência

- `src/middleware.ts`: linhas 35-37 — `if (process.env.NODE_ENV === 'production' && (pathname === '/signup' || pathname.startsWith('/api/auth/signup')))` retorna 404

## Alternativas rejeitadas

- Signup público: aumentaria attack surface e complexidade de onboarding

## Gap

Nenhum. ADR-BASE-11 implementado conforme spec.
