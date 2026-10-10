# Runbook operacional — E2: aplicar migrations 0034/0035/0036 + deploy (Contabo)

**Data:** 2026-10-08 · **Base:** `origin/main @ efee7d48` (pós-merge E1, PR #32) · **Status:** READY FOR OPERATOR — nenhuma ação aqui executada; cada seção mutadora exige autorização humana explícita, preflight e backup.
**Fontes:** `docs/audit/2026-10-08-vnext-integration-reconciliation.md` (E0), `src/lib/db/migrations/0034_*`, `0035_*`, `0036_*`, `meta/_journal.json`, `drizzle.config.ts`, `scripts/migrate-vps.ts`, `docs/audit/migrations-policy.md`, `src/services/api-handlers/health/{db,readiness}.ts`.

## 1. Estado conhecido (read-only, sem acesso autorizado ao target)

- Código espera ledger **36** (`EXPECTED_MIGRATIONS`, conta registros `drizzle.__drizzle_migrations`). Journal: idx 0–36 (`0000`–`0036`, gap herdado `0017`).
- Última evidência operacional (2026-10-07, `docs/inventory/2026-10-07-p2-contabo-validation.md`): target com **33** → 0034 (`action_logs`: 4 cols NULL) e 0035 (`approval_tokens`, CREATE TABLE IF NOT EXISTS) **pendentes**.
- **0036 (`outbox_jobs.claim_generation`)** entrou no ledger depois daquele snapshot (E4 — fence do lease do outbox, ramo `fix/outbox-keyed-delivery-safety`): `ADD COLUMN IF NOT EXISTS claim_generation integer DEFAULT 0 NOT NULL`, expand-only, aditiva, re-rodável e sem backfill (linhas nascem em 0). Se o target ainda estiver em 33/35, a fila de aplicação é `0034 → 0035 → 0036`, na ordem do journal.
- 0034/0035/0036 são **expand-only** (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`, re-rodáveis, breakpoints journal). DOWN é só comentário — rollback real = forward-fix/restore (nunca `drizzle-kit` DOWN).
- Ledger atual do target, Hyperdrive source/target, backup off-host, grants, jobs/outbox: **INDETERMINADOS** (sem acesso read-only autorizado nesta rodada).
- **Nota de versionamento:** o relatório E0 (`docs/audit/2026-10-08-vnext-integration-reconciliation.md`) fixa 35 porque congelou o snapshot `d532ff6e`; ele permanece como registro histórico e NÃO foi reescrito. A contagem vigente é 36 (ver `docs/audit/migrations-policy.md`).

## 2. Pré-checks (somente leitura, antes de qualquer mutação)

1. `GET /api/health/db` no target → anotar `{complete, migrationsApplied, migrationsExpected}`. Esperado pré-migrate: `complete:false, applied:33 (ou 35), expected:36`.
2. `readiness` interno com `statement_timeout 3s` → distinguir `migrations-incomplete` de `db-unreachable`.
3. `scripts/migrate-vps.ts --side=source --dry-run` e `--side=target --dry-run` → plano sem mutação, sem secrets (handoff de senha via stdin/env no wrangler).
4. Confirmar backup off-host recente + drill de restore válido (`docs/runbooks/database-recovery.md` §2.3; último drill completo local 2026-09-26, RTO ~114s; switch real em prod **pendente**).
5. Congelar deploys concorrentes (WAHA/Action E4) na janela — sem mudar migrations + WAHA + Action Layer juntos.

## 3. Janela de aplicação (com autorização E2b)

1. Freeze curto de escrita se o operador exigir (0034/0035/0036 são NULL/IF-NOT-EXISTS → compatíveis com app antigo e novo; freeze é precaução, não requisito técnico).
2. Aplicar `drizzle-kit migrate` (ou `migrate-vps.ts` sem `--dry-run`, lado correto) **uma vez**, ordem do journal.
3. Re-rodar pré-checks: esperado `complete:true, applied:36`. Reaplicação é idempotente (IF NOT EXISTS).
4. Deploy do app `efee7d48+` (Workers/OpenNext + Hyperdrive apontando o target correto). Validar `/api/health/db` + readiness + smoke sem PII.
5. Telemetria: erros de `approval store unavailable`, `migrations-incomplete`, latência de `consumeApprovalToken`.

## 4. Rollback

- **Migrations:** sem DOWN — forward-fix (nova migration corretiva) ou restore do backup off-host (runbook `database-recovery.md`). 0034 (cols NULL) e 0035 (tabela nova sem FK) são reversíveis por `DROP COLUMN`/`DROP TABLE` manual **somente** se nenhum consumidor as usa e com aprovação (policy §contract, 5 condições). 0036 é reversível por `ALTER TABLE outbox_jobs DROP COLUMN claim_generation` **somente** na mesma condição — e apenas enquanto nenhuma liquidação depender da fence (a coluna é `DEFAULT 0 NOT NULL`: sem leitor, removê-la não corrompe dado algum).
- **App:** rollback ao bundle anterior (deploy anterior do Worker); app antigo é compatível com DB migrado (expand-only).
- **Limites:** sem backup válido → NO-GO. Sem Hyperdrive source/target confirmados → NO-GO.

## 5. Condições NO-GO (abortar antes de mutar)

Tenant escape, backup inconsistente/ausente, Hyperdrive ambíguo, divergência financeira, segredo exposto, ausência de rollback viável, ou qualquer gate E2a (compat em staging/rehearsal) pendente sem dispensa escrita do responsável.

## 6. Gates

- **E2a:** prova de compatibilidade em staging/rehearsal (migrate + app + readiness verdes em DB isolado).
- **E2b:** aprovação humana explícita antes de tocar BD/Cloudflare produção.
- Sem E2b: este runbook permanece **READY FOR OPERATOR — nunca DONE**.
