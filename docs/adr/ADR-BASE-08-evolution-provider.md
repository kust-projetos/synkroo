# ADR-BASE-08: Evolution API como Provider Principal de WhatsApp

**Status:** ✅ Implementado  
**Data:** 2026-07-28 (canonizado pela spec)

## Decisão

Evolution API v2.3.7 como provider principal de WhatsApp. Sidecar Playwright como fallback isolado.

## Evidência

- `src/modules/atendimento/services/evolution-service.ts`: serviço Evolution
- `src/lib/whatsapp/`: utilitários WhatsApp
- `next.config.ts`: Playwright externalizado como sidecar (ADR-BASE-09)
- Env vars: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`

## Alternativas rejeitadas

- Browser no Worker: incompatível com runtime Workers
- WhatsApp Business API direta: complexidade de infra

## Gap

Nenhum. Evolution implementado conforme spec.
