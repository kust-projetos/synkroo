# ADR-BASE-02: Next.js 15 + OpenNext em Cloudflare Workers

**Status:** ✅ Implementado
**Data:** 2026-07-29 (atualizado após auditoria; fila ISR resolvida em 2026-08-02)

## Decisão

Next.js 15 com App Router, deploy via OpenNext em Cloudflare Workers.

## Evidência

- `next.config.ts` com `serverExternalPackages` para compatibilidade Workers
- Webpack externals configurados para `pg`, `playwright`, etc.
- `src/lib/db/client.ts` com `setDbConnectionString()` para Hyperdrive
- `open-next.config.ts` usa o adaptador oficial `doQueue` para revalidação ISR
- `wrangler.toml` expõe `NEXT_CACHE_DO_QUEUE` como `DOQueueHandler` com migração SQLite `v1`

## Gaps remanescentes

- Deploy real em Workers deve continuar sendo verificado por smoke test em cada release
- wrangler configs existem: `wrangler.toml` (app), `wrangler.ia-bridge.jsonc`, `src/workers/ia-agent/wrangler.jsonc`
- Filas de jobs de negócio permanecem separadas no ADR-BASE-13

## Ação

Manter a validação de build OpenNext e `wrangler deploy --dry-run` no gate de Cloudflare.
