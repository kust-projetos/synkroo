# Secret Rotation Runbook — B-SECRET-ROTATION F0.04–F0.10 / F1.01

**Status:** PREPARED — owner rotates GH/Cloudflare/DB/LLM/Evolution/Asaas + auth secrets
**Data:** 2026-08-26
**Class:** R4 (owner-gated, sem execução automática)
**Fontes:** `docs/security/credential-inventory.md`, `.gitleaksignore` (83 entries), `.gitleaks.toml`, `docs/adr/adr-deferred-f0-01-freeze.md`

> Nunca registra valores. Apenas `SecretClass | Fingerprint (last4) | Owner | Rotated | Evidence` com fingerprint via `echo $VAR | cut -c1-4`.

## Pré-requisitos

- Owner nomeado com acesso a: GitHub (PAT), Cloudflare (Workers/Hyperdrive), PostgreSQL (`DATABASE_URL`), LLM providers (MiniMax/OpenAI/OpenRouter), Evolution API, Asaas, `AUTH_SECRET`/`JWT_SECRET`.
- Backup verificado: `pg_dump "$DATABASE_URL" > backup-$(date +%F).sql` + SHA armazenado fora do repo.
- Janela de manutenção + lista de clones/forks + plano de comunicação (ADR-DEFERRED-F0.01).
- `gitleaks --version` + `wrangler --version` capturados antes/depois (sem valores).

## Inventário base (sanitizado)

- `.gitleaksignore`: 83 entries — 12 worktree (sem SHA) + 71 históricas (com SHA), 20 caminhos únicos.
  - 6 `confirmed-owner-action`: `api-glm.bat`, `api-minimax.bat`, `api-nemotron.bat`, `scripts/seed-e2e-clinic.js:jwt:4`, `scripts/seed-e2e-data.js:jwt:6`, `scripts/seed-scale-data.js:jwt:11`
  - 52 `test-fixture/placeholder` (ci.yml, seeds, `__tests__/*`)
  - 25 `false-positive/doc/example` (docs/CONFIGURACAO, DATABASE_SETUP, supabase-setup, setup-env.sh, plan 2026-06-19)
- Scanner atual: `gitleaks detect --source . --no-git --verbose` → 18 leaks, todos em arquivos gitignored (`.dev.vars:7` jwt×2+pat×4+generic×1, `.env.local:8` jwt×2+pat×2+generic×4, `coverage/lcov-report/...:1`, `src/workers/ia-agent/.dev.vars:1`, `tmp` ignorado). `gitleaks detect --source . --log-opts="--all" --redact` histórico COMMITTED → **0 leaks** (CI `gitleaks-scheduled.yml`).
- Versões capturadas: `gitleaks 8.30.1`, `wrangler 4.125.0` (npx), `git log HEAD f87bb8b9`.

## Passos (owner executa, agente não executa)

### 1. Backup + fingerprint pré-rotação (sem valores)

```bash
# apenas fingerprint, nunca valor
echo $DATABASE_URL | cut -c1-4; echo $AUTH_SECRET | cut -c1-4; echo $GH_TOKEN | cut -c1-4
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql && sha256sum backup-*.sql > backup.sha256
gitleaks --version; npx wrangler --version; git log -1 --format="%H %s" # sanitizado
```

### 2. Revogar / rotacionar por classe (provider console)

| SecretClass | Onde rotacionar | Como provar sem valor |
|---|---|---|
| `github-fine-grained-pat` GH_TOKEN / GITHUB_TOKEN / GH_ORG_TOKEN (C01-C03) + worktree `.dev.vars:10-13` `.env.local:5-6` | GitHub → Settings → Developer settings → PATs → Revoke → Generate new | fingerprint `ghp_****` last4 + timestamp + owner |
| `jwt` Supabase ANON/SERVICE_ROLE (C04-C08) + `.dev.vars:8-9` `.env.local:3-4` | Supabase Dashboard → Project → API → Service Role → Reset | fingerprint `eyJ****` last4 + owner |
| `generic-api-key` LLM (C09-C11) `api-glm/minimax/nemotron.bat` + `OPENCODE_ZEN_API_KEY` `.dev.vars:26` `.env.local:19,25,27,31,34` | z.ai / MiniMax / OpenRouter dashboards → Revoke → New key | fingerprint `sk-****`/`msk-****` last4 |
| `DATABASE_URL` Hyperdrive/Neon | Cloudflare Hyperdrive → Rotate connection string + Neon/DB → Reset password → `wrangler hyperdrive update` | fingerprint `post****` + `HYPERDRIVE id e0033a75...` |
| `AUTH_SECRET` (≥32) + `JWT_SECRET` (≥16) + `CRON_SECRET` + `WEBHOOK_SECRET` | Gerar `openssl rand -base64 32` local, não colar no repo | fingerprint `****` last4 + `src/lib/env.ts:22` fail-closed |
| Evolution `EVOLUTION_API_KEY` + Asaas `ASAAS_API_KEY`/`TOKEN_WEBHOOK` | Evolution/Asaas dashboards | fingerprint last4 + `src/modules/financeiro/lib/__tests__/crypto.test.ts` timingSafeEqual |

### 3. Aplicar nos Workers / env

```bash
# cada secret via wrangler secret put (valor digitado interativamente, nunca em log)
echo $NEW_VALUE | npx wrangler secret put AUTH_SECRET --env staging
echo $NEW_VALUE | npx wrangler secret put AUTH_SECRET --env production
echo $NEW_VALUE | npx wrangler secret put DATABASE_URL --env staging  # Hyperdrive id e0033a75f4e2449084b00b41e22e49a6
npx wrangler deploy --dry-run --config wrangler.toml --env staging  # deve manter HYPERDRIVE sem VECTORIZE, 470 files
```

`wrangler.toml` staging já validado:
- `[[env.staging.hyperdrive]] binding="HYPERDRIVE" id="e0033a75f4e2449084b00b41e22e49a6"` (staging)
- `[[hyperdrive]] binding="HYPERDRIVE" id="be5a789a003e4f08a94a82dffbb091be"` (prod)
- `env.staging.vars OUTBOX_WORKER_URL="https://synkroo-staging.walissonead.workers.dev"` vs prod `https://synkroo.walissonead.workers.dev`
- Dry-run em 2026-08-26: `wrangler 4.125.0` EXIT 0, `Total Upload: 23150.42 KiB`, bindings: `HYPERDRIVE (e0033...)`, `KV (f2ad31...)`, `DO AGENT (synkroo-ia-agent-staging)`, `IA_BRIDGE`, sem `VECTORIZE`.

### 4. Re-autenticar clones

```bash
gh auth login  # com NOVA credencial, scope repo/workflow
gh auth status  # apenas fingerprint/owner, sem token
# invalidar clones antigos: instruir `git fetch --prune` + comunicar lista de clones (ADR-DEFERRED-F0.01)
```

### 5. Gitleaks full-history em CI (não local 180s)

- Local full-history (`gitleaks detect --source . --log-opts="--all"`) excede 180s/120s — não rodar local como gate bloqueante.
- Usar CI/Scheduled como evidência autoritativa: `.github/workflows/ci.yml` job `gitleaks` (`curl | tar xz gitleaks_8.24.0`, `detect --source . --log-opts="--all" --redact --verbose`, bloqueante) + `.github/workflows/gitleaks-scheduled.yml` (cron `0 6 * * 1` + `workflow_dispatch`, `fetch-depth: 0`).
- Recibo esperado pós-rotação: `gitleaks detect` (history) 0 leaks; `gitleaks detect --no-git` apenas gitignored restantes (serão 0 após `.dev.vars`/`.env.local` substituídos).

### 6. Rollback

- Provider-specific rollback sob owner: revogar nova credencial e gerar outra; nunca reintroduzir valor antigo no repo/logs.
- DB: `pg_restore backup.sql` + `drizzle-kit migrate` roll-forward (nunca `down` destrutivo, F11.14).
- Workers: `npx wrangler rollback --env staging` + redeploy SHA anterior `5457ba8d/f87bb8b9`.
- Se história sanitizada (filter-repo/BFG): só após backup + aprovação comunicação; invalidar clones antigos.

## Recibo sanitizado (owner preenche)

| SecretClass | Fingerprint (last4) | Owner | Rotated (UTC) | Evidence |
|---|---|---|---|---|
| github-fine-grained-pat | `****` (cut -c1-4) | owner GH |  | `gitleaks CI run URL/SHA` + `gh auth status` sanitizado |
| jwt (Supabase) | `****` | owner Supabase |  | dashboard receipt + `gitleaks` 0 |
| generic-api-key (LLM) | `****` | owner LLM |  | provider receipt + fingerprint |
| DATABASE_URL/Hyperdrive | `****` | owner DB/CF |  | `wrangler deploy --dry-run staging EXIT 0` + `HYPERDRIVE e0033...` |
| AUTH_SECRET/JWT_SECRET | `****` | owner auth |  | `src/lib/env.ts` fail-closed + deploy smoke |
| CRON_SECRET/WEBHOOK_SECRET | `****` | owner ops |  | `crypto.timingSafeEqual` + `/api/internal/readiness` 200 |
| Evolution/Asaas | `****` | owner provider |  | provider receipt + `timingSafeEqual` |

## Verificação final

```bash
gitleaks --version  # 8.30.1
npx wrangler --version  # 4.125.0
git log -1 --format="%H %s"  # sanitizado, sem valores
# CI: aguardar `gitleaks-scheduled.yml` verde em main (full history)
# Staging: wrangler deploy --dry-run --env staging + /health + /internal/readiness com CRON_SECRET
```

**Gate fecha quando** owner anexar tabela acima completa + `gitleaks` CI verde + staging smoke `200` + lista de clones invalidated.
