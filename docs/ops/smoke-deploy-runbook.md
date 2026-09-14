# Runbook: Smoke Pós-Deploy — Synkroo

> F5 — smoke determinístico e não destrutivo após cada deploy (staging/produção).
> Complementa `scripts/smoke-staging.mjs` (contrato de staging com auth sintética)
> e a seção "Smoke Staging Checklist" de `docs/runbook-deploy-instancia.md`.

## 1. Quando rodar

- Após **todo deploy** em staging e produção (job manual ou comando local).
- Após **rollback** (`npx wrangler rollback`), para confirmar a versão restaurada.
- **Não** rodar como teste de carga nem como teste funcional — é liveness/readiness.

## 2. Como rodar

```bash
# Staging
SMOKE_BASE_URL=https://<worker-staging-url> npm run smoke:deploy

# Produção (por instância — cada clínica tem seu Worker)
SMOKE_BASE_URL=https://<worker-clinica-url> npm run smoke:deploy

# Formas equivalentes
node scripts/smoke-deploy.mjs https://<worker-url>
node scripts/smoke-deploy.mjs --base-url https://<worker-url>
node scripts/smoke-deploy.mjs --help
```

Requisitos: Node 18+ (usa `AbortSignal.timeout` e `fetch` nativo). Timeout de
10s por request. Nenhuma credencial necessária; nenhuma variável além de
`SMOKE_BASE_URL` (opcional: `SMOKE_IA_BRIDGE_URL`, ver §4).

## 3. O que cada check prova

| Check | Request | Esperado | Prova |
|---|---|---|---|
| `liveness` | `GET /api/health` | 200 `{ status: 'healthy' }` | Runtime + app responderam; inclui ping no DB (`checks.database`) |
| `auth-pipeline` | `GET /api/auth/session` (sem cookie) | 200/401 `{ authenticated: bool }` | Pipeline Auth.js responde sem credenciais reais (`POST /api/auth/login` foi removido — login é exclusivo NextAuth) |
| `db` | `GET /api/health/db` | 200 `{ status: 'complete' }` | Schema acessível (todas as tabelas esperadas existem) |
| `middleware` | `GET /api/patients` (sem sessão) | 401/403 | Middleware/gates de auth ativos (rota protegida não vaza 200) |
| `workers` | — (skipped) | `ok:true, skipped:true` | ia-bridge é chamado via **service bindings** (RPC interno, sem HTTP público) — sem endpoint externo a pingar; cobertura via `liveness` + `db` |

Saída: um JSON por linha `{ check, ok, status, ms }` (segredos redatados).
Exit `0` = todos `ok`; exit `1` = qualquer `ok: false`.

## 4. Limitação dos workers (ia-bridge / ia-agent)

O app aciona o `ia-bridge` via service bindings do Cloudflare (ver
`src/workers/ia-bridge/`, `src/core/ia-channel/agent-invoker.ts`) — não há
endpoint HTTP público do bridge exposto pelo deploy OpenNext. Por isso o smoke
registra `workers: skipped` em vez de falhar. Se o ambiente expuser um health
do bridge, informe `SMOKE_IA_BRIDGE_URL=https://...` para pingá-lo (2xx = ok).

## 5. Em caso de falha

1. Guarde a saída (ela já é redatada — sem segredos).
2. Mapeie o check:
   - `liveness` falha → Worker fora do ar ou secret ausente (`AUTH_SECRET`,
     `DATABASE_URL`). Ver `wrangler secret list` e logs no dashboard Cloudflare.
   - `auth-pipeline` falha → regressão no Auth.js/session (ver `src/lib/auth/`).
   - `db` = `incomplete` → migração não aplicada (`npm run db:migrate`) ou
     Hyperdrive apontando para o DB errado.
   - `middleware` = 200 sem sessão → **tratar como incidente de segurança**:
     gates de auth desabilitados; rollback imediato.
   - `workers` com `SMOKE_IA_BRIDGE_URL` falha → bridge fora do ar; sem o
     override, `skipped` nunca é falha.
3. **Rollback**: `npx wrangler rollback` (ou `wrangler deploy --version
   <version-id>`) — procedimento em `docs/runbook-deploy-instancia.md` §5.
4. Re Rode o smoke após o rollback para confirmar a versão restaurada.

## 6. Referências

- Script: `scripts/smoke-deploy.mjs` (`npm run smoke:deploy`)
- Testes: `scripts/__tests__/smoke-deploy.test.mjs`
- Contrato estendido de staging: `scripts/smoke-staging.mjs`
- Deploy/rollback: `docs/runbook-deploy-instancia.md` (§3–§5)
