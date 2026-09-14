# W11 Rollout Runbook — F11.05 / F11.11

> Pipeline canônico exigido por `docs/superpowers/plans/2026-08-25-pendencias-restantes-fechamento.md` T6. Ordem fixa, owner-gated, sem EXTERNAL.

## Pipeline (backup → expand → workers → app → smoke → cleanup)

1. **Backup / preflight**
   ```bash
   pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
   npm run roadmap:check  # 143 unique, VERIFIED 126 (pré-W11)
   npm run typecheck && npm run typecheck:ia-bridge && npm run typecheck:ia-agent
   npx wrangler deploy --dry-run --config wrangler.ia-agent.jsonc
   npx wrangler deploy --dry-run --config wrangler.ia-bridge.jsonc
   ```
   - Nunca copie `../vps-hostinger/.env` para repo; use `VPS_ENV=../vps-hostinger/.env; set -a; . "$VPS_ENV"; set +a`.

2. **Expand migration (compatível)**
   ```bash
   npm run db:generate  # drizzle-kit generate → src/lib/db/schema/*
   npm run db:migrate   # drizzle-kit migrate (expand, sem down destrutivo F11.14)
   ```
   - F11.14: DB aplicada recebe roll-forward, não `down` destrutivo. Thresholds de abort definidos no ADR de migração.

3. **Workers (bridge antes do app F11.06)**
   ```bash
   npm run deploy:ia-bridge   # wrangler deploy ia-bridge (Hyperdrive binding)
   npm run deploy:ia-agent    # wrangler deploy ia-agent porta 8788 (Agents SDK/DO)
   # Versionamento: app/bridge/agent + RPC + schema + DO STATE_VERSION por release/cliente (F11.12)
   # Provar old/new compatibility e version skew; lifecycle DO não cruza rollback gradual (F11.13)
   ```

4. **App (OpenNext Cloudflare)**
   ```bash
   npm run build:cf
   npm run deploy:cf
   ```

5. **Smoke + contracts**
   ```bash
   npm run health  # liveness público mínimo F11.07
   curl -H "Authorization: Bearer $CRON_SECRET" /api/internal/readiness  # readiness protegido/barato
   npm run test:release  # contracts
   npm run verify        # lint→typecheck→coverage→test:release (F3.14)
   ```

6. **Cleanup**
   - Remover migrations `down` antigas; manter apenas roll-forward.
   - Arquivar backup com retenção (ver `docs/ops/w10-retention-policy.md`: gateway 1 ano, audit 2 anos).
   - Atualizar `docs/superpowers/audits/roadmap-143-ledger.json` via `npm run roadmap:write` e commit.

## Health / Readiness (F11.07)
- Liveness público: `GET /api/health` (sem auth, barato).
- Readiness: `GET /api/internal/readiness` protegido por `CRON_SECRET`/`WEBHOOK_SECRET` via `crypto.timingSafeEqual`, check DB + Hyperdrive.

## Observabilidade (F11.08 / F11.09)
- Logs JSON com `requestId`/`correlationId` + redaction (`src/lib/logger.ts:31`).
- Métricas/SLO: `auth`, `DB`, `webhook`, `queue`, `agent`, `provider`, `sidecar` — ver `src/lib/logger.ts` + audit `f11-08-structured-logging.md`.
- Alertas/runbooks acionáveis (F11.10) alinhados à janela de deploy.

## Security headers (F11.15)
- `content-security-policy`, `hsts`, `x-content-type-options: nosniff`, `referrer-policy`, `permissions-policy` — suite `src/__tests__/security/headers.test.ts` + audit `f11-15-security-headers.md`.

## Rollback (F11.11)
- App/workers: redeploy da tag anterior; DB usa roll-forward (expand → contract separado).
- Compatibilidade: old/new e version skew provados antes do rollout; DO `STATE_VERSION` versionado impede cruzar rollback gradual.
- Sem push/merge/prod deploy sem owner explícito (global constraint); W12 piloto só com `docs/ops/w12-pilot-readiness.md` aprovado.

## Constraint de agenda (E1 — verificação operacional)

A garantia anti-overbooking vive no banco (`EXCLUDE USING gist`, criada pela migration `0001_dapper_overlap.sql`). Após cada deploy/migração em staging/produção, confirmar que a constraint existe:

```sql
SELECT conname FROM pg_constraint WHERE conrelid='appointments'::regclass AND conname='appointments_no_overlap';
```

Resultado esperado: 1 linha (`appointments_no_overlap`). Se vazia, a migration `0001` não foi aplicada — abortar o rollout e investigar antes do smoke.

## Referências
- `scripts/verify.mjs:10` — `lint → typecheck → typecheck:bridge/agent → coverage → test:release`
- `docs/superpowers/audits/roadmap-143-ledger.json` — W11 VERIFIED local
