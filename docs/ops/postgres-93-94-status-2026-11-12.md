# PostgreSQL — Status das issues #93 (conectividade) e #94 (privilégios) — 2026-11-12

**Escopo:** diagnóstico read-only. Nenhuma mutação produtiva foi realizada.
**Autoridade de mutação:** issues #93/#94 permanecem abertas; mudanças irreversíveis exigem autorização específica (A-PAPEIS / A-REDE).

## #93 — Conectividade

### Evidência atual (contabo-prod, container `synkroo-prod-postgres`)

- Container publicado em `0.0.0.0:15433 -> 5432/tcp` (acessível externamente na porta 15433).
- PostgreSQL 17.11 (Debian 17.11-1.pgdg12+2), `max_connections = 100`.
- Extensões instaladas: `plpgsql 1.0`, `btree_gist 1.7`, `vector 0.8.7` (pgvector — coerente com ADR-BASE-04).
- Tabelas no schema `public`: 68.
- Hyperdrive binding em produção (`wrangler.toml`, id `be5a789a003e4f08a94a82dffbb091be`) aponta para o banco via Hyperdrive (origem privada não exposta neste diagnóstico).
- Staging Hyperdrive (`e0033a75f4e2449084b00b41e22e49a6`) separado.

### D3 / gates D4

- D3 (versão/infra base) está presente: PostgreSQL 17 + pgvector operacional, health de DB alcançável.
- Gates D4 ainda pendentes (não executados nesta rodada, exigem autorização):
  - Caminho privado/ACL (A-REDE) e restrição de exposição da porta 15433.
  - Validação de TLS/SCRAM e leitura do ledger por conexão autorizada.
  - Reconciliação de grants/default privileges (ver #94).
- Nenhuma migration produtiva foi aplicada nesta rodada.

### Conclusão #93

Conectividade básica confirmada (porta 15433, PG 17, pgvector). Gates D4 de rede/ACL e ledger seguem pendentes e exigem autorização específica (A-REDE). Nenhuma mutação realizada.

## #94 — Privilégios

### Evidência atual

- Role de runtime efetiva da aplicação: `synkroo` (mesmo nome do `POSTGRES_USER` do container).
- `synkroo` tem `rolsuper = true`, `rolcreatedb = true`, `rolcreaterole = true` → **a aplicação roda como superuser em produção**.
- Roles existentes:
  - `synkroo` — superuser (runtime atual, indevido para runtime).
  - `synkroo_staging` — `rolsuper = false`, `rolcreatedb = true` (staging já parcialmente separado).
  - `synkroo_staging_app` — `rolsuper = false`, `rolcreatedb = false` (staging já tem role de app não-superuser).
- Produção **não** possui role de runtime não-superuser equivalente a `synkroo_staging_app`.

### Conclusão #94

Produção ainda utiliza superuser (`synkroo`) como identidade de runtime — confirmado. Staging já demonstra o padrão desejado (`synkroo_staging_app`). A criação de uma role de runtime não-superuser em produção (com grants mínimos SELECT/INSERT/UPDATE/DELETE nas tabelas do app e USAGE no schema) é a correção necessária, mas exige autorização específica (A-PAPEIS) e janela controlada; não executada nesta rodada.

## Pendências que exigem autorização humana

1. #93: restrição de rede/ACL da porta 15433 e validação TLS/SCRAM (A-REDE).
2. #94: criação da role de runtime não-superuser em produção e rotação de `DATABASE_URL`/Hyperdrive para essa role (A-PAPEIS).
3. Ambas: coordenação com E2b (migrations) e A-RESTORE (backup/restore) conforme `docs/runbooks/2026-10-vnext-e2b-operational-plan.md` §13.

## Não bloqueantes

Correções de código, testes locais e documentação continuam independentes destas pendências (conforme `docs/ops/pending-owner-gates.md`).
