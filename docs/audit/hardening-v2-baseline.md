# Baseline — Hardening, Reliability & Scale v2 (2026-09-17)

> Documento de congelamento de baseline exigido pela Etapa 0.1 do plano
> `docs/superpowers/specs/2026-09-17-hardening-reliability-scale-v1-plano.md`.
> Predecessor: ciclo de hardening de 2026-09-13 (plano consolidado, 10/10 verde).

## Estado congelado

| Campo | Valor |
|---|---|
| Branch | `main` |
| Commit inicial | `73754a9160eda732fc400a4f49c2f8870aa72ded` (2026-09-14, clean) |
| Data da medição | 2026-09-17 |
| Node | v26.7.0 |
| Plataforma | Windows (execução local), CI em ubuntu (GitHub Actions) |
| Next.js / React / TS | Next.js 15 (App Router) + React 19 + TypeScript 5.6 |
| DB / ORM | PostgreSQL 17 (imagem `pgvector/pg17`) + Drizzle ORM + `pg` |
| Runtime alvo | Cloudflare Workers (OpenNext) + Hyperdrive |
| Gerenciador de pacotes | npm (lockfile v3) |

## Quality gates no baseline (`main@73754a9`, antes das mudanças)

| Gate | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` (ESLint `--max-warnings=0`) | **PASS** |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | **PASS** |
| Testes unitários | `npm test` | **PASS** — 354 suites, 2624 testes (2619 passed, 5 skipped), ~336 s |
| Build | `npm run build` | **PASS** (Next.js production build) |
| Integração | `npm run test:integration:run` | **PASS** — 57 suites, 293 testes (medido pós-Etapas 1–4; as mudanças das Etapas 1–4 são aditivas e incluídas na contagem final) |

## Estado das migrations

- 31 arquivos em `src/lib/db/migrations/` (`0000`–`0031`, sem gaps quebrados).
- Cadeia completa aplicada com sucesso em banco vazio (`synkroo_test` local, via `drizzle-kit migrate`) — incluindo bootstrap de extensões (`pgvector`, `btree_gist`) e a constraint `appointments_no_overlap` (0001).
- CI já executa `db:migrate` em banco criado do zero (`ci.yml`, job `ci`) e via `scripts/integration-run.mjs` (runner isolado em loopback).

## Dependências (Etapa 0.3)

- `@neondatabase/serverless@^1.1.0` (em `dependencies`): **órfã confirmada** — zero imports em `src/`, `scripts/`, `wrangler.*` e configs; presença histórica apenas em `plans/2026-06-19-w4-8-driver-edge.md` (decisão da época: manter `pg` Pool, Neon abandonado). Remoção executada nesta passada (ver commit `chore(deps)`).
- Sem `knip`/`depcheck` instalados; análise feita por varredura de imports + lockfile (evidência suficiente para o caso neon; ferramenta dedicada registrada como melhoria opcional).

## Drift documental corrigido (Etapa 0.4)

- `README.md`: contagens manuais de testes (264/14) removidas — números deriváveis pela CI não devem ser mantidos à mão (SYN-DOC-001).
- `README.md:114`: link corrigido para `docs/adr/ADR-INDEX.md` (SYN-DOC-002, opção B).
- `AGENTS.md`: contagens substituídas pela regra de medição (`npx jest --listTests` + glob `e2e/**/*.spec.ts`), evitando drift silencioso.

## Observações

- Contagem medida em 2026-09-17 (SPEC §107.15): 354 suites Jest / 46 specs E2E — consistente com o baseline acima.
- `synkroo_test` local provisionada via `docker compose` (`synkroo-db`, porta 55432) + `CREATE DATABASE synkroo_test` + `db:migrate`.
- Backlog pós-baseline vivo em `docs/audit/` (matriz tenant, política de migrations, inventário de integrações).
