# ADR-BASE-09: Playwright Sidecar Entregue, Default Off

**Status:** ✅ Implementado  
**Data:** 2026-07-28 (canonizado pela spec)

## Decisão

Playwright como sidecar isolado em processo Node separado. Entregue no deploy mas desabilitado por padrão. Ativado somente por operador autorizado.

## Evidência

- `next.config.ts`: `serverExternalPackages: ['playwright', 'playwright-core', 'chromium-bidi']`
- Webpack externals isolam Playwright do bundle principal
- REQ-ATD-05: sidecar isolado, desabilitado por default, ativado por operador

## Alternativas rejeitadas

- Bundle Playwright no OpenNext: incompatível, binário nativo
- Browser externo gerenciado: custo operacional

## Gap

Nenhum. Sidecar configurado conforme spec.
