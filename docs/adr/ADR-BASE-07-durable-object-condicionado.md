# ADR-BASE-07: Durable Object Condicionado a Smoke

**Status:** ⏸️ Deferido  
**Data:** 2026-07-28 (canonizado pela spec)

## Decisão

Durable Objects para estado de conversa só serão adotados se smoke test demonstrar dor real (latência, cold start, consistência). Não migrar preventivamente.

## Evidência

- Nenhum Durable Object implementado
- Estado de conversa atual usa PostgreSQL (tabela `conversations`)

## Gap

Nenhum no momento. Revisitar após smoke test em staging com carga real.

## Trigger de revisão

- Latência de conversa > 500ms p95 em staging
- Cold start de Worker > 2s
- Inconsistência de estado em > 0.1% das conversas
