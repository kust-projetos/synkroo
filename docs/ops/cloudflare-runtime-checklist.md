# Checklist Cloudflare runtime — Synkroo (SPEC §98)

Checklist **VALIDAR EM RUNTIME**: cada item traz o estado atual conhecido
(com `path:linha` quando aplicável) e o que falta provar em
staging/produção. Nada aqui altera código — `src/middleware.ts` **não** foi
modificado nesta etapa.

Legenda: ✅ declarado no repo · ⚠️ trade-off documentado · ❌ ausente ·
**PENDENTE-RUNTIME** = só dá para validar com deploy/ambiente real.

## 1. Bindings

- ✅ `ASSETS` (`wrangler.toml:7-9`), `IA_HANDLE_ISSUER` + `WORKER_SELF_REFERENCE`
  (`wrangler.toml:11-18`), DO `AGENT` (`synkroo-ia-agent`, `wrangler.toml:21-24`),
  `NEXT_CACHE_DO_QUEUE` + migração `v1` (`wrangler.toml:25-31`),
  KV `NEXT_INC_CACHE_KV` (`wrangler.toml:33-35`), Hyperdrive `HYPERDRIVE`
  (`wrangler.toml:37-40`); staging espelha tudo (`wrangler.toml:45-79`).
- **PENDENTE-RUNTIME:** confirmar no dashboard/`wrangler deploy --dry-run` que
  cada binding resolve no ambiente certo (prod vs staging); Vectorize **não**
  aparece no `wrangler.toml` — confirmar se a busca vetorial usa pgvector
  (ver `POST /api/knowledge/search`) e remover Vectorize da lista de
  dependências se não houver binding.

## 2. Secrets por ambiente

- ✅ Validação fail-fast em `src/lib/env.ts:9-53` (`AUTH_SECRET` ≥ 32 em prod:
  `env.ts:82-85`; `JWT_SECRET` crítico); `CRON_SECRET` e `WEBHOOK_SECRET`
  comparados com `crypto.timingSafeEqual` nas rotas cron/inbound; middleware lê
  env **dentro** da função (nota OpenNext em `src/middleware.ts:5-13`).
- **PENDENTE-RUNTIME:** `wrangler secret list` em prod e staging
  (`AUTH_SECRET`, `JWT_SECRET`, `DATABASE_URL`/Hyperdrive, `CRON_SECRET`,
  `WEBHOOK_SECRET`, chaves de provider LLM/WhatsApp); segredos nunca no repo
  (config privada em `../vps-hostinger/.env`).

## 3. Limites CPU / subrequests / payload

- ✅ Estado atual: body-limit no middleware (`src/middleware.ts:52-54`,
  `exceedsBodyLimit` de `@/lib/security/request-guards`); widget 64 KB
  (`src/app/api/widget/messages/route.ts:11`); `IA_CHAT_MAX_MESSAGE_LENGTH =
  4000`; serverActions `2mb` (`next.config.ts:12-15`).
- **PENDENTE-RUNTIME:** medir wall-time de CPU por rota quente sob carga
  (`ia/chat` → DO + provider LLM conta subrequests); mapear subrequests por
  request (Hyperdrive + DO `AGENT` + IA) contra os limites do plano Workers.

## 4. Cookies seguros em produção

- ✅ Sessão JWT via `getToken` no middleware (`src/middleware.ts:78-81`,
  `AUTH_SECRET`); rotas NextAuth próprias isoladas em
  `CUSTOM_AUTH_ROUTES` (`src/middleware.ts:38-44`).
- **PENDENTE-RUNTIME:** inspecionar `Set-Cookie` real em prod — exigir
  `Secure`, `HttpOnly`, `SameSite=Lax` (ou `Strict` onde couber) e prefixo
  `__Secure-`/`__Host-`; confirmar que o bypass de dev
  (`src/middleware.ts:70-75`) nunca ativa em prod.

## 5. Headers (CSP / HSTS)

- ✅ Estado atual: headers definidos em `next.config.ts:35-60` — CSP com
  `unsafe-inline`/`unsafe-eval` (⚠️ trade-off documentado para Next.js/HMR),
  `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`; **HSTS só em prod** (`next.config.ts:56-58`).
  Cobertos por `src/__tests__/security/headers.test.ts`. O middleware **não**
  define headers de segurança (só CSRF/body-limit) — registrado, sem alteração.
- **PENDENTE-RUNTIME:** `curl -I` em prod e staging confirmando CSP + HSTS
  efetivos (atenção a stripping por proxy/CDN na frente do Worker).

## 6. CORS / CSRF

- ✅ Estado atual: `shouldRejectCsrf` no middleware (`src/middleware.ts:56-58`);
  widget com allowlist de origem (`isAllowedWidgetOrigin`,
  `src/app/api/widget/messages/route.ts:54`); transports assinados
  (`SIGNED_TRANSPORT`, `src/middleware.ts:45`).
- **PENDENTE-RUNTIME:** validar origem real do widget em prod contra a
  allowlist; testar preflight `OPTIONS` e rejeição de origem cruzada.

## 7. Pool Hyperdrive sob carga

- ✅ Estado atual: binding `HYPERDRIVE` (`wrangler.toml:37-40`, staging `:77-79`);
  `serverExternalPackages: ['pg', …]` (`next.config.ts:10`); health de banco em
  `/api/health/db` (público, cf. `src/middleware.ts:14-36`).
- **PENDENTE-RUNTIME:** `max_connections` efetivo, latência p95 sob carga,
  comportamento com pool esgotado; ligar aos alertas de
  `docs/ops/observability.md` (DB indisponível / pool esgotado).

## 8. Backups / restore

- ✅ Artefatos no repo: `scripts/db-backup.mjs` (dump `pg_dump -Fc` + gzip +
  `.sha256`; modos `--local` via `docker exec synkroo-db` e `--url
  $DATABASE_URL` p/ VPS; retenção `--keep`, padrão 7 dias; connection string
  nunca exibida) e `scripts/db-restore.mjs` (dry-run por padrão, restore real
  só com `--yes`, verificação pós-restore das tabelas core `clinics`, `users`,
  `patients`, `appointments`); rotina + cron sugerido (dump diário 02:00 UTC)
  + roteiro do drill em `docs/runbooks/database-recovery.md` §2.3 (RPO ≤ 24 h
  / RTO ≤ 4 h seguem **A CONFIRMAR pelo owner**).
- **PENDENTE-RUNTIME:** drill real de restore contra backup de produção com
  recibo no checklist do runbook (§5) + confirmação de RPO/RTO pelo owner
  (cf. `docs/ops/outage-drill-matrix.md`).

## 9. Request IDs em produção

- ✅ Contrato em `docs/ops/observability.md` — `generateRequestId`
  (`src/lib/api/response.ts:118-125`), eco em `x-request-id`, correlação
  ponta a ponta no `ia/chat` (`resolveCorrelationId` → DO → provider);
  429 canônico preserva o ID (`apiRateLimited`).
- **PENDENTE-RUNTIME:** confirmar propagação end-to-end em prod, incluindo os
  workers `ia-agent`/`ia-bridge` (`src/workers/*`, `wrangler.ia-bridge.jsonc`,
  `src/workers/ia-agent/wrangler.jsonc`).

## 10. Rate limiting distribuído

- ✅ Ver `docs/ops/rate-limiting.md` — presets por endpoint implementados;
  store in-memory por isolado (limite efetivo N × configurado).
- **PENDENTE-RUNTIME:** observar taxa de 429 por rota/5min e custo IA/hora
  (alertas em `docs/ops/observability.md`); migrar para DO/KV só com evidência.

## 11. Cron triggers

- ✅ Trigger `*/5 * * * *` (`wrangler.toml:5`); 8 rotas em
  `src/app/api/cron/*`; 3 com preset `cron` (ver `docs/ops/rate-limiting.md`).
- **PENDENTE-RUNTIME:** validar disparo agendado em prod/staging, `CRON_SECRET`
  por ambiente e comportamento dos 5 jobs sem limiter sob clock real.

## 12. Observabilidade

- ✅ Contrato e inventário em `docs/ops/observability.md`; redaction LGPD.
- **PENDENTE-RUNTIME:** coleta/agregação **não provisionada** — validar
  analytics/logs Cloudflare e `observability.enabled` no wrangler antes de
  declarar SLOs.
