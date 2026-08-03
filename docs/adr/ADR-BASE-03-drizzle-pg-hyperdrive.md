# ADR-BASE-03: PostgreSQL 17 + Drizzle ORM + pg + Hyperdrive

**Status:** ✅ Implementado  
**Data:** 2026-07-28 (canonizado pela spec)

## Decisão

PostgreSQL 17 como banco relacional único, Drizzle ORM para migrations e queries tipadas, `pg` (node-postgres) como driver, Cloudflare Hyperdrive para connection pooling em Workers.

## Evidência

- `src/lib/db/client.ts`: Drizzle com `Pool` do `pg`, Hyperdrive via `setDbConnectionString()`
- `src/lib/db/schema/`: 11 arquivos de schema (agent, appointments, audit, business, conversations, core, crm, enums, index, infra, modules)
- `src/lib/db/config.ts`: configuração de conexão
- `src/lib/db/migrations/`: migrations Drizzle

## Alternativas rejeitadas

- Supabase: removido conforme roadmap
- `postgres.js`: `pg` é mais maduro e compatível com Hyperdrive

## Gap

Nenhum. Stack implementada conforme spec.
