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
- ✅ Dry-run estático 2026-09-25 (`wrangler 4.131.2`, sem auth, sem deploy):
  `npx wrangler deploy --dry-run` → 475 files, `Total Upload: 17449.28 KiB`,
  bindings prod (`HYPERDRIVE be5a789a...`, `KV 8f2a4d...`, DO `AGENT` via
  `synkroo-ia-agent`, `IA_HANDLE_ISSUER`→`synkroo-ia-bridge#HandleIssuerService`,
  `WORKER_SELF_REFERENCE`→`synkroo`, `ASSETS`); `--env staging` → mesmos 475
  files, `HYPERDRIVE e0033a75...`, `KV f2ad31...`, `AGENT` via
  `synkroo-ia-agent-staging`, `IA_HANDLE_ISSUER`→`synkroo-ia-bridge-staging`;
  `wrangler.ia-bridge.jsonc` → 2088.44 KiB (`IA_SEEN` KV + `HYPERDRIVE`);
  `src/workers/ia-agent/wrangler.jsonc` → 161.14 KiB (DO `AGENT` +
  `APP`→`synkroo-ia-bridge#AppService`); 4× `--dry-run: exiting now.`,
  zero erros de binding, sem `VECTORIZE` em nenhum output.
- ✅ Vectorize — RESOLVIDO (estático): zero ocorrências em `wrangler.toml`,
  `wrangler.ia-bridge.jsonc` e `src/workers/ia-agent/wrangler.jsonc`
  (`Select-String -Pattern "vectorize"` → zero matches); busca vetorial usa
  pgvector — `src/modules/ia/schema/knowledge.ts:11`
  (`vector('embedding', { dimensions: 1536 })`),
  `src/services/rag/rag.service.ts:314,330` (busca via pgvector + fallback
  keyword), `src/app/api/knowledge/search/route.ts:28`,
  `src/workers/ia-agent/index.ts:41` (purge via pgvector, "não Vectorize"),
  decisão `docs/adr/ADR-BASE-04-pgvector.md:8,15` (pgvector único, sem
  Vectorize simultâneo), gate `src/__tests__/cloudflare/remediation-config.test.ts:18-19`
  (`not.toContain('VECTORIZE')`). Vectorize removido da lista de dependências
  de runtime deste checklist.
- **PENDENTE-RUNTIME:** dry-run acima antecipa parcialmente (config resolve
  estaticamente), mas NÃO fecha o item — falta confirmação real em
  staging/prod: deploy + dashboard (bindings por ambiente) + `GET /health`
  e smoke das rotas quentes.
- ✅ Evidência STAGING 2026-09-25 (parcial, não fecha o item — dashboard +
  prod seguem pendentes): `npm run build:cf` OK (OpenNext bundle +
  `inject-pg-global`); `npx opennextjs-cloudflare deploy --env staging` OK →
  `https://synkroo-staging.walissonead.workers.dev`, Version ID
  `6f34e733-...` (deploy output completo no log da sessão; sem `--env`
  staging nada foi tocado em prod). Bindings confirmados no output do deploy:
  `AGENT` via `synkroo-ia-agent-staging`, `NEXT_INC_CACHE_KV f2ad31...`,
  `HYPERDRIVE e0033a75...`, `IA_HANDLE_ISSUER`→`synkroo-ia-bridge-staging`,
  `WORKER_SELF_REFERENCE`→`synkroo-staging`, `ASSETS`, `schedule: */5 * * * *`.
  Liveness: `GET /api/health` → 200 `{"status":"ok",...}` (~0.88 s);
  `GET /api/health/db` → 200
  `{"data":{"status":"incomplete","complete":false,"migrationsApplied":30,"migrationsExpected":33}}`
  (Hyperdrive alcança o DB, mas 30/33 migrations — smoke `db` FAIL, ver abaixo).
  `node scripts/smoke-deploy.mjs https://synkroo-staging.walissonead.workers.dev`
  → liveness pass (200), auth-pipeline pass (200), middleware pass (307),
  workers skipped by design (service bindings sem HTTP público), db FAIL
  (200 com `complete:false`), exit 1. Nota de deploy: primeira tentativa sem
  env falhou com `no local hyperdrive connection string` (staging não define
  `localConnectionString`); resolvido SEM alterar `wrangler.toml`/código via
  env var de processo
  `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` apontando ao
   Postgres local documentado — `wrangler.toml` intacto.
- ✅ Evidência PRODUÇÃO 2026-09-25 (fecha o item no plano config+binding —
  dashboard visual segue opcional): `npm run build:cf` OK sem env extra (prod
  tem `localConnectionString` em `wrangler.toml:40`); `npm run deploy:cf`
  (`opennextjs-cloudflare deploy`, SEM `--env`) OK → worker `synkroo`
  `https://synkroo.walissonead.workers.dev`, Version ID
  `fd5197a7-50db-4401-8b92-3f8663d1c302`. Bindings confirmados no output:
  `AGENT` via `synkroo-ia-agent`, `NEXT_INC_CACHE_KV 8f2a4d...`, `HYPERDRIVE
  be5a789a...`, `IA_HANDLE_ISSUER`→`synkroo-ia-bridge#HandleIssuerService`,
  `WORKER_SELF_REFERENCE`→`synkroo`, `ASSETS`, `schedule: */5 * * * *`
  (475 assets, 3 novos, startup 42 ms). Liveness: `GET /api/health` → 200
  `{"status":"ok",...}`; `GET /api/health/db` → 200
  `{"data":{"status":"complete","complete":true,"migrationsApplied":33,"migrationsExpected":33}}`
  (33/33 — prod à frente do staging, que estava 30/33);
  `node scripts/smoke-deploy.mjs https://synkroo.walissonead.workers.dev` →
  liveness/auth-pipeline/db/middleware pass, workers skipped by design, exit 0.
  Nota: deploy emitiu warning de que `DOQueueHandler` não é exportado do
  worker (só afeta chamadas diretas a esse DO; deploy e smoke íntegros) —
  registrado como risco, sem alteração de código nesta etapa.

## 2. Secrets por ambiente

- ✅ Validação fail-fast em `src/lib/env.ts:9-53` (`AUTH_SECRET` ≥ 32 em prod:
  `env.ts:82-85`; `JWT_SECRET` crítico); `CRON_SECRET` e `WEBHOOK_SECRET`
  comparados com `crypto.timingSafeEqual` nas rotas cron/inbound; middleware lê
  env **dentro** da função (nota OpenNext em `src/middleware.ts:5-13`).
- **PENDENTE-RUNTIME:** `wrangler secret list` em prod e staging
  (`AUTH_SECRET`, `JWT_SECRET`, `DATABASE_URL`/Hyperdrive, `CRON_SECRET`,
  `WEBHOOK_SECRET`, chaves de provider LLM/WhatsApp); segredos nunca no repo
  (config privada em `../vps-hostinger/.env`).
- ✅ Evidência 2026-09-25 (NOMES apenas — `secret list` nunca expõe valores):
  `npx wrangler secret list` (prod/default) → 13 nomes: `AUTH_SECRET`,
  `AUTH_URL`, `CRON_SECRET`, `EVOLUTION_API_KEY`, `EVOLUTION_API_URL`,
  `EVOLUTION_INSTANCE_NAME`, `EVOLUTION_WEBHOOK_SECRET`, `JWT_SECRET`,
  `NEXTAUTH_URL`, `SEED_SECRET`, `WEBHOOK_SECRET`, `WHATSAPP_FALLBACK_SECRET`,
  `WHATSAPP_FALLBACK_URL`; `npx wrangler secret list --env staging` → 15
  nomes: `AUTH_SECRET`, `CRON_SECRET`, `DATABASE_URL`, `ENCRYPTION_KEY`,
  `EVOLUTION_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE_NAME`,
  `EVOLUTION_WEBHOOK_SECRET`, `JWT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
  `SEED_SECRET`, `WEBHOOK_SECRET`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN`. Nenhum valor exibido, criado ou alterado (nenhum
  `secret put/delete` executado). Divergências de nomes entre ambientes
   registradas, sem juízo de valor — rotação/valores seguem fora de escopo.
- ✅ Reconfirmação PRODUÇÃO 2026-09-25 (NOMES apenas, sem valores):
  `npx wrangler secret list` (default/prod) → mesmos 13 nomes
  (`AUTH_SECRET`, `AUTH_URL`, `CRON_SECRET`, `EVOLUTION_API_KEY`,
  `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE_NAME`,
  `EVOLUTION_WEBHOOK_SECRET`, `JWT_SECRET`, `NEXTAUTH_URL`, `SEED_SECRET`,
  `WEBHOOK_SECRET`, `WHATSAPP_FALLBACK_SECRET`, `WHATSAPP_FALLBACK_URL`);
  nenhum `secret put/delete` executado. `CRON_SECRET` + `WEBHOOK_SECRET`
  presentes em prod — coerente com os 401 medidos no §11.

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
- ✅ Evidência STAGING 2026-09-25 (parcial — sem sessão autenticada não há
  flags para auditar, item segue PENDENTE-RUNTIME): `curl.exe -sI` em `/`,
  `/api/health`, `/login` e dump de headers (`-D -`) em `/api/auth/session`,
  `/api/patients` (307) e `POST /api/messages/send` (307) — NENHUM
  `Set-Cookie` emitido em respostas anônimas (correto: sem sessão, sem cookie;
  sem valores para ecoar). Comportamento auth sem cookie: `GET
  /api/auth/session` → 200 `{"authenticated":false,"user":null,...}` (sem
  vazamento); `GET /api/patients` sem cookie → 307
  `Location: /login?redirectTo=%2Fapi%2Fpatients` (middleware). Flags
  `Secure/HttpOnly/SameSite` + prefixo `__Secure-`/`__Host-` + bypass de dev
   seguem exigindo sessão autenticada real em staging/prod.
- ✅ Evidência PRODUÇÃO 2026-09-25 (parcial — mesmo limite: sem sessão
  autenticada não há flags para auditar, item segue PENDENTE-RUNTIME para
  `Secure/HttpOnly/SameSite`/prefixo): `curl.exe -s -D -` em
  `https://synkroo.walissonead.workers.dev/api/auth/session` → 200 (sem
  vazamento, corpo `authenticated:false`) e `/api/patients` → 307
  `Location: /login?redirectTo=%2Fapi%2Fpatients` — NENHUM `Set-Cookie` em
  respostas anônimas (correto). Bypass de dev não observado em prod.

## 5. Headers (CSP / HSTS)

- ✅ Estado atual: headers definidos em `next.config.ts:35-60` — CSP com
  `unsafe-inline`/`unsafe-eval` (⚠️ trade-off documentado para Next.js/HMR),
  `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`; **HSTS só em prod** (`next.config.ts:56-58`).
  Cobertos por `src/__tests__/security/headers.test.ts`. O middleware **não**
  define headers de segurança (só CSRF/body-limit) — registrado, sem alteração.
- **PENDENTE-RUNTIME:** `curl -I` em prod e staging confirmando CSP + HSTS
  efetivos (atenção a stripping por proxy/CDN na frente do Worker).
- ✅ Evidência STAGING 2026-09-25 (`curl.exe -sI`
  `https://synkroo-staging.walissonead.workers.dev/` + `/api/health` +
  `/login`, todos 200): `Strict-Transport-Security: max-age=31536000;
  includeSubDomains` PRESENTE (inclusive em staging);
  `content-security-policy: default-src 'self'; script-src 'self'
  'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src
  'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'` (nome do header
  em minúsculas via edge, trade-off `unsafe-inline`/`unsafe-eval` confirmado
   em runtime); `x-content-type-options: nosniff`; `x-frame-options: DENY`;
   `referrer-policy: strict-origin-when-cross-origin`; `permissions-policy:
   camera=(), microphone=(), geolocation=()`. Prod + stripping por proxy/CDN
   seguem PENDENTE-RUNTIME.
- ✅ Evidência PRODUÇÃO 2026-09-25 (`curl.exe -sI`
  `https://synkroo.walissonead.workers.dev/` + `/login`, ambos 200, e
  headers de `/api/auth/session` + `/api/patients`): TODOS os headers do
  contrato presentes — `Strict-Transport-Security: max-age=31536000;
  includeSubDomains`, CSP idêntica ao staging (`frame-ancestors 'none'`,
  trade-off `unsafe-inline`/`unsafe-eval` confirmado), `x-frame-options:
  DENY`, `x-content-type-options: nosniff`, `referrer-policy:
  strict-origin-when-cross-origin`, `permissions-policy: camera=(),
  microphone=(), geolocation=()`. HSTS em prod confirmado em runtime
  (fecha a metade "prod" do item; stripping por proxy/CDN à frente do
  Worker segue PENDENTE-RUNTIME).

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
- 🛡️ Mitigação 2026-09-25 (**ROLLBACK** — 15432 segue exposta): restringir
  `15432/tcp` aos ranges Cloudflare publicados quebrou o Hyperdrive staging
  (`/api/health/db` → `complete:false`; egresso Hyperdrive fora dos ranges
  publicados) e foi revertida com staging/prod íntegros; achado: `DOCKER-USER`
  vazia contorna o ufw p/ portas publicadas pelo Docker. Detalhe, comandos de
  rollback e pendências em `docs/ops/vps-access.md` § "Firewall do Postgres
  (2026-09-25)".

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
- ✅ Drill LOCAL executado em 2026-09-25 (Opção A, alvo descartável
  `synkroo-restore-test`; origem dev local; restore + verificação ≈ 20 s;
  ledger 31/31 idêntico ao dev) — evidência em
  `docs/runbooks/restore-tests/2026-09-25-local-drill.md`.
- ✅ Drill de PRODUÇÃO EXECUTADO em 2026-09-25 (autorizado pelo owner; alvo
  descartável `synkroo-prod-drill` na VPS, porta só em loopback; dump
  `synkroo-prod-20260925-143506.dump`, 184.231 bytes, com hash registrado;
  `pg_restore --no-owner` OK sem erros em ~1 s; contagens core zeradas —
  banco de produção vazio; ledger 33/33 idêntico à produção; produção
  permaneceu `healthy`) — evidência em
  `docs/runbooks/restore-tests/2026-09-25-prod-drill.md`. RTO medido:
  restore + verificação < 60 s (banco de 77 MiB). RPO/RTO permanecem
  **medidos, A RATIFICAR pelo owner**.

## 9. Request IDs em produção

- ✅ Contrato em `docs/ops/observability.md` — `generateRequestId`
  (`src/lib/api/response.ts:118-125`), eco em `x-request-id`, correlação
  ponta a ponta no `ia/chat` (`resolveCorrelationId` → DO → provider);
  429 canônico preserva o ID (`apiRateLimited`).
- **PENDENTE-RUNTIME:** confirmar propagação end-to-end em prod, incluindo os
  workers `ia-agent`/`ia-bridge` (`src/workers/*`, `wrangler.ia-bridge.jsonc`,
  `src/workers/ia-agent/wrangler.jsonc`).
- ✅ Evidência negativa STAGING 2026-09-25 (item segue PENDENTE-RUNTIME):
  dump completo de headers (`curl.exe -s -D -`) em `/api/health` (200),
  `/api/auth/session` (200), `/api/patients` (307) e `POST
  /api/messages/send` (307) — header `x-request-id` AUSENTE em todas as
  respostas de borda observadas (busca case-insensitive; só `CF-RAY` de
  correlação edge presente). Correlação ponta a ponta `ia/chat` → DO →
   provider e workers `ia-agent`/`ia-bridge` não validados.
- ✅ Evidência negativa PRODUÇÃO 2026-09-25 (item segue PENDENTE-RUNTIME):
  dumps `curl.exe -s -D -` em `/` + `/login` (200), `/api/health` (200),
  `/api/auth/session` (200), `/api/patients` (307) e `POST
  /api/messages/send` não testado em prod — header `x-request-id` AUSENTE
  em todas as respostas de borda (só `CF-RAY` presente). Observação nova:
  `POST /api/cron/cleanup` sem secret → 401 com `requestId` NO CORPO
  (`{"error":{"code":"UNAUTHORIZED",...,"requestId":"0f6149f4-..."}}`) —
  o app gera correlation ID mesmo rejeitando, mas não o ecoa como header
  `x-request-id`. Correlação ponta a ponta `ia/chat` → DO → provider e
  workers seguem não validados.

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
- ✅ Evidência STAGING 2026-09-25 (contrato validado sem expor o valor):
  `curl.exe -X POST .../api/cron/reminders` sem secret → 401;
  `curl.exe -X POST .../api/cron/cleanup` sem secret → 401
  (`timingSafeEqual` rejeita ausente como esperado). Trigger agendado
  provisionado no deploy staging (`schedule: */5 * * * *`, deploy output).
  Disparo agendado real sob clock + `CRON_SECRET` por ambiente + 5 jobs sem
   Disparo agendado real sob clock + `CRON_SECRET` por ambiente + 5 jobs sem
   limiter seguem PENDENTE-RUNTIME.
- ✅ Evidência PRODUÇÃO 2026-09-25 (contrato validado sem expor o valor):
  `curl.exe -X POST https://synkroo.walissonead.workers.dev/api/cron/reminders`
  sem secret → 401 `{"error":"Unauthorized"}`; `POST .../api/cron/cleanup`
  sem secret → 401 com envelope + `requestId` no corpo. Trigger agendado
  provisionado no deploy prod (`schedule: */5 * * * *`, deploy output).
  Nota: formato do corpo 401 difere entre as duas rotas (reminders simples
  vs cleanup envelope com `requestId`) — inconsistência cosmética registrada,
  sem alteração. Disparo agendado real sob clock + 5 jobs sem limiter seguem
  PENDENTE-RUNTIME.

## 12. Observabilidade

- ✅ Contrato e inventário em `docs/ops/observability.md`; redaction LGPD.
- **PENDENTE-RUNTIME:** coleta/agregação **não provisionada** — validar
  analytics/logs Cloudflare e `observability.enabled` no wrangler antes de
  declarar SLOs.
