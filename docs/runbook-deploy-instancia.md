# Runbook: Deploy por Instância — Synkroo Cloudflare Workers

> W4.6 — Consolidado do spike W4.1 + Hyperdrive (W4.2) + Vectorize/KV (W4.4) + Secrets (W4.5).

---

## 1. Visão Geral

Cada clínica Synkroo tem seu próprio **Worker Cloudflare** + **Postgres dedicado** + **Hyperdrive** (pooler). O deploy é por instância — não há multi-tenant no Worker (cada Worker = 1 clínica = 1 DB).

**Stack de deploy:**
- **Runtime:** Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`)
- **DB:** PostgreSQL gerenciado (instância dedicada por cliente)
- **Pooler:** Hyperdrive (binding `HYPERDRIVE`)
- **Embeddings:** Vectorize (binding `VECTORIZE_INDEX`)
- **Cache:** KV (binding `SYNKROO_CACHE`)

---

## 2. Checklist de Provisionamento por Cliente

Para cada nova clínica:

### 2.1 Infraestrutura

- [ ] Provisionar instância PostgreSQL (Cloudflare Hyperdrive-compatible ou externa com IP allow-listed)
- [ ] Criar Hyperdrive config no dashboard Cloudflare → colar `id` no `wrangler.toml`
- [ ] Criar Vectorize index:
  ```bash
  npx wrangler vectorize create synkroo-embeddings --dimensions=768 --metric=cosine
  ```
- [ ] Criar KV namespace:
  ```bash
  npx wrangler kv namespace create SYNKROO_CACHE
  ```
- [ ] Colar `id` do Vectorize e KV no `wrangler.toml` (campos `id` dos bindings)

### 2.2 Secrets

```bash
npx wrangler secret put AUTH_SECRET        # ≥32 chars
npx wrangler secret put JWT_SECRET          # ≥16 chars
npx wrangler secret put DATABASE_URL         # connection string do Postgres
# Opcionais por funcionalidade:
npx wrangler secret put MINIMAX_API_KEY
npx wrangler secret put EVOLUTION_API_KEY
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put CRON_SECRET
```

Ver `docs/runbook-secrets-cf.md` para lista completa.

### 2.3 Módulos contratados

Após primeiro deploy, acessar o painel admin (`/dashboard/configuracoes/acessos`) como owner e:
- [ ] Criar perfil `Administrador` (se não existir)
- [ ] Atribuir acesso ao usuário admin
- [ ] Contratar módulos via `setModuleContract` (master-only, via script ou dashboard):
  ```ts
  // Exemplo: ativar módulo operacional
  await runAction(setModuleContract, { moduleId: 'operacional', enabled: true }, masterCtx);
  ```

---

## 3. Comandos de Deploy

### Build

```bash
npm run build:cf
# Equivalente a: opennextjs-cloudflare build
```

Gera `.open-next/worker.js` + `handler.mjs` + `middleware/handler.mjs`.

### Preview local (NÃO usar em CI)

```bash
npm run preview:cf
# Equivalente a: opennextjs-cloudflare preview
# ⚠️ Abre porta local com Wrangler — NÃO rodar em CI/headless
```

### Deploy

```bash
npm run deploy:cf
# Equivalente a: opennextjs-cloudflare deploy
# Requer CLOUDFLARE_API_TOKEN no ambiente
```

### Smoke Staging Checklist

Após cada deploy em staging, executar estes comandos para validar o runtime:

```bash
# 1. Health check básico (deve retornar 200 com status ok)
curl -s https://synkroo-staging.<subdomain>.workers.dev/api/health | jq .
# Esperado: {"ok":true,"timestamp":"...","runtime":"workerd"}

# 2. API pública (GET route handler)
curl -s https://synkroo-staging.<subdomain>.workers.dev/api/spike | jq .
# Esperado: {"ok":true,"route":"/api/spike","runtime":"workerd","timestamp":"..."}

# 3. Auth — sem sessão, deve redirecionar para /login (302)
curl -I https://synkroo-staging.<subdomain>.workers.dev/dashboard 2>&1 | grep -i location

# 4. Login (obter cookie de sessão)
curl -v -X POST https://synkroo-staging.<subdomain>.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@clinica.com","password":"..."}' 2>&1 | grep -i set-cookie

# 5. Painel admin com sessão (substituir <cookie> pelo valor do passo 4)
curl -s https://synkroo-staging.<subdomain>.workers.dev/dashboard/configuracoes/acessos \
  -H "Cookie: <cookie>" | head -20
# Esperado: HTML com "Usuários e acessos" no body

# 6. Server Action (exercitar runAction → INSERT em action_logs)
curl -s -X POST https://synkroo-staging.<subdomain>.workers.dev/dashboard/configuracoes/acessos/perfis \
  -H "Content-Type: text/plain;charset=UTF-8" \
  -H "Next-Action: <action-id>" \
  -H "Cookie: <cookie>" \
  -d '[...]' | jq .
# Esperado: {"ok":true,"data":{"id":"..."}} ou erro RBAC com code "core:manage_users"
```

> ⚠️ Smoke runtime NÃO executado neste build (sem Cloudflare account). Checklist acima é referência para staging real com conta provisionada.

## 4. Smoke Test Pós-Deploy

```bash
# Health check básico
curl -s https://<worker-url>/api/health | jq .

# Auth — deve redirecionar para /login (sem sessão)
curl -I https://<worker-url>/dashboard

# API pública
curl -s https://<worker-url>/api/spike | jq .

# Server Action (via POST)
curl -s -X POST https://<worker-url>/api/spike \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

---

## 5. Rollback

Se o deploy quebrar:

```bash
# Rollback para o deploy anterior (Wrangler mantém histórico)
npx wrangler rollback

# Ou deploy de uma versão específica:
npx wrangler deploy --version <version-id>
```

---

## 6. Monitoramento

### Cloudflare Dashboard

- **Workers & Pages** → métricas de CPU, requests, erros
- **Logpush** → enviar logs para ferramenta externa (Datadog, Grafana, etc.)
- **Hyperdrive** → pool connections, latência de query

### Health interno

- `GET /api/health` — status do runtime + DB ping
- `GET /api/health/db` — status do banco (query leve)
- `action_logs` — auditoria de todas as Actions executadas (W3.1)

---

## 7. CI Pipeline

O workflow `.github/workflows/ci.yml` executa:

| Job | Gatilho | Comandos |
|---|---|---|
| `ci` | push/PR | lint → tsc → test → `next build` |
| `cf-build` | workflow_dispatch / release | `npm run build:cf` (OpenNext + Wrangler) |

O job `ci` é rápido (~2 min) e roda em todo push/PR. O job `cf-build` é mais pesado (~4 min) e roda apenas manualmente ou em branches de release.

---

## 8. Resolução de Problemas

| Sintoma | Causa provável | Ação |
|---|---|---|
| `npm run build:cf` falha com `Module not found: fs` | `pg` não está no `serverExternalPackages` | Verificar `next.config.ts` |
| `npm run build:cf` falha com `chromium-bidi` | CJS não existe em `node_modules` | Copiar `lib/cjs` de um lockfile antigo |
| Worker retorna 500 após deploy | Secret ausente | `wrangler secret list` → verificar `AUTH_SECRET` |
| Painel admin não carrega ações | `bootstrapActions()` não rodou | Verificar `instrumentation.ts` no build |
| `action_logs` vazio | `writeActionLog` falhou | Verificar logs do Worker (Cloudflare dashboard) |

---

## 9. Histórico

| Data | Versão | Mudança |
|---|---|---|
| 2026-06-17 | 1.0 | Spike W4.1: validação Server Actions + App Router em Workers |
| 2026-06-18 | 1.1 | W4.2: Hyperdrive adapter |
| 2026-06-18 | 1.2 | W4.3: OpenNext + Wrangler config consolidada |
| 2026-06-18 | 1.3 | W4.4: Vectorize + KV bindings |
| 2026-06-18 | 1.4 | W4.5: Bootstrap Actions + auth edge |
| 2026-06-18 | 1.5 | W4.6: Runbook consolidado; remoção Vercel; CI pipeline CF |
