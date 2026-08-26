# Pilot Charter — B-PILOT-RESOURCES F12.01–F12.07 (R4 CHARTER-DRAFTED)

**Status:** CHARTER-DRAFTED — sem provisionamento/execução, apenas charter documental
**Data:** 2026-08-26
**Tenant:** `synkroo-staging` (nomeado, dedicado, isolado por `clinicId`)
**Janela:** `2026-09-01T02:00:00Z` (manutenção, fuso UTC; converter para America/Sao_Paulo no rollout)
**Participante piloto:** `dr-1` (owner clínico piloto; demais equipe a nomear em O5-X01)
**Fonte:** `docs/superpowers/plans/2026-08-16-roadmap-143-wave-5-release-pilot.md` O5-G07, `docs/ops/w12-pilot-readiness.md`, `docs/ops/w11-rollout-runbook.md`

> Nenhum dado PII real, secret value ou dataset produtivo neste charter. Dataset é anonimizado + checksum `sha256`.

## 1. Escopo

- Objetivo: validar F12.01–F12.07 (provision → import → J-01..J-12 → outage drills → UX/perf → training → scorecard) sem alterar scope 143.
- Candidato: SHA `f87bb8b9` (após `npm run verify` verde, `waitlist` 37/39, `db:migrate` local OK). Staging candidato será `synkroo-staging` em `wrangler.toml` `env.staging` `HYPERDRIVE e0033a75f4e2449084b00b41e22e49a6`.
- Gate O5-X01: requer owner/team/window/modules/channels/support/rollback/data-classification + autorização explícita antes de `scripts/provision-client.mjs --apply`.

## 2. Tenant & recursos dedicados

- Tenant alias: `synkroo-staging` (≠ prod `synkroo`)
- Recursos Cloudflare por env: `KV f2ad31b71d484e0ba3fc6df1814d7d8e` (staging) vs `8f2a4d355686427585f665688d1cc082` (prod), `DO AGENT synkroo-ia-agent-staging`, `IA_BRIDGE synkroo-ia-bridge-staging`, `HYPERDRIVE e0033a75f4e2449084b00b41e22e49a6`
- DB: PostgreSQL 17 + Hyperdrive; `src/lib/db/schema/*` 11 schemas (core, crm, conversations, business, audit, appointments via `modules/operacional/schema`, infra, modules, enums) + `drizzle-kit check` verde.
- Backup pré-piloto: `pg_dump "$DATABASE_URL" > backup-2026-09-01.sql` + `sha256sum` armazenado fora do repo (W11 runbook). Rollback DB = roll-forward (F11.14), nunca `down` destrutivo.

## 3. Dataset anonimizado

- Arquivo placeholder: `docs/pilot/approved-import.csv` (não commitado com PII)
- Checksum: `sha256: 0000000000000000000000000000000000000000000000000000000000000000` (owner substitui por `sha256sum approved-import.csv` real após aprovação)
- Colunas: `name, phone, email (normalizeEmail), birthDate, clinicSlug` — sem CPF/RG, sem endereço completo.
- Contagens: `accepted: 0 / rejected: 0` (preview dry-run antes de `--apply`; replay idempotente, batch transaction, rollback por import batch — `scripts/import-client-data.mjs`).
- Base legal: LGPD minimização, `legal_hold` respeitado (`src/modules/operacional/schema/patients.ts`), `docs/ops/w10-retention-policy.md` (msgs 90d, DO 30d, audit 2a, gateway 1a, exports 7d).

## 4. Equipe & janela

- Participante nomeado: `dr-1` (dentista owner)
- Equipe adicional: _a preencher O5-X04_ (recepção, admin, suporte)
- Janela: `2026-09-01T02:00:00Z` — duração 2h, abort threshold: smoke/readiness fail ou SLO breach (W11).
- Suporte: on-call via `docs/ops/w11-rollout-runbook.md` + alertas F11.10; rollback: `wrangler rollback --env staging` + redeploy tag anterior + `pg_restore` se necessário.

## 5. Módulos / canais

- Módulos contratados: `atendimento`, `comercial`, `crm`, `financeiro`, `followup`, `operacional` (manifest `src/lib/ui/sidebar.tsx` + RBAC `src/modules/core/schema/rbac`).
- Canais: `Evolution` + `webchat` + `Instagram` (channel_installations tenant-bound, webhook deriva `clinicId` sem aceitar tenant livre — F2.06).
- Teste de consulta: criar 1 appointment de teste após import (O5-G02 order).

## 6. Pipeline pré-piloto (sem execução externa)

```bash
pg_dump "$DATABASE_URL" > backup-2026-09-01.sql
npm run roadmap:check  # 143 unique
npm run typecheck && npm run typecheck:ia-bridge && npm run typecheck:ia-agent
npx wrangler deploy --dry-run --config wrangler.toml --env staging  # 470 files, HYPERDRIVE sem VECTORIZE
npx wrangler deploy --dry-run --config wrangler.ia-bridge.jsonc  # 6527 KiB
npx wrangler deploy --dry-run --config src/workers/ia-agent/wrangler.jsonc  # 140.87 KiB, STATE_VERSION=2
node scripts/provision-client.mjs --client pilot --environment staging        # dry-run, preview redacted
node scripts/import-client-data.mjs --client pilot --file docs/pilot/approved-import.csv  # preview accepted/rejected
```

## 7. Critérios de entrada (O5-X01/X02)

- [ ] Owner, tenant `synkroo-staging`, janela `2026-09-01T02:00Z` e participantes (`dr-1`) assinados
- [ ] Dataset `sha256` + retenção + rejection policy aprovados
- [ ] Backup + rollback/maintenance window comunicados
- [ ] `provision-client` / `import-client-data` dry-run preview anexado (sem PII)
- [ ] `w11-rollout-runbook` + `metric-dictionary` + SLO F11.09 alinhados

## 8. Saídas esperadas

- Recibo sanitizado: tenant alias, dataset `sha256`, `accepted/rejected` counts, script version, window, operator, `pg_dump` SHA — sem PII/secret.
- Após receipts: J-01..J-12 (sem baseline beta), outage drills F12.04, mobile/desktop + a11y + perf, training O5-X04, scorecard F12.07, decisão formal GO/NO-GO F12.08.

**Próximo passo:** owner aprova e autoriza `provision-client --apply` + `import --apply`.
