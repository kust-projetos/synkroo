# Remediação — Review WhatsApp Sidecar (sem commit/deploy/segredos)

Data: 2026-09-01
Task: task_7c5d89367af9 — corrigir achados do review da implementação do WhatsApp sidecar
Branch: main (trabalho em working directory, sem commit)
Executor: term_dde6ccf4-b539-4ceb-b6e6-a27d18bbbf50

## Sumário executivo
Seis achados corrigidos com fail-closed estrito, auth Bearer exclusiva e contrato QR alinhado. Validação separada do sidecar (npm install/build/typecheck) e do app (37 testes channel-service, typecheck 0, lint 0, build:cf 330s, wrangler dry-run) passa 100%. Gzip real: handler.mjs 2 636 490 bytes (2 574,70 KiB / 2,51 MiB) e Total Upload 33 66,01 KiB (Wrangler), worker.js stub 906 bytes.

## 1. README — WHATSAPP_FALLBACK_URL não pode ser http://127.0.0.1:3030 para Cloudflare

**Achado:** `ops/vps/whatsapp-sidecar/README.md:42` instruía `WHATSAPP_FALLBACK_URL: http://127.0.0.1:3030 (via tunnel ou proxy reverso seguro)`. Loopback não existe no runtime Cloudflare Workers, portanto a instrução é incorreta para produção.

**Correção:** `ops/vps/whatsapp-sidecar/README.md:40-43`
```md
- `WHATSAPP_FALLBACK_URL`: `https://whatsapp-sidecar.seu-dominio.com` (HTTPS publicamente alcançável via Cloudflare Tunnel ou Nginx reverse proxy com TLS; nunca `http://127.0.0.1`/`http://localhost` — loopback não existe no runtime Cloudflare Workers)
- `WHATSAPP_FALLBACK_SECRET`: O mesmo token definido no sidecar VPS (`WHATSAPP_FALLBACK_SECRET`).

> **Nota:** `http://127.0.0.1:3030` é reservado exclusivamente para smoke test local dentro do próprio VPS (`curl -f http://localhost:3030/health`). O Worker em produção deve sempre apontar para a URL HTTPS pública do sidecar exposta via tunnel/proxy seguro.
```

Também atualizado `.env.example:41-49` para documentar fallback com HTTPS e comentário idêntico, evitando que novos devs copiem localhost para `wrangler.toml`/`vars`.

## 2. auth.ts — aceitar EXCLUSIVAMENTE Authorization: Bearer <token>

**Achado:** `ops/vps/whatsapp-sidecar/src/auth.ts:8` aceitava `req.headers['authorization'] || req.headers['x-fallback-secret']` e ainda aceitava token cru sem prefixo `Bearer ` (fallback `typeof authHeader === 'string' ? authHeader : ''`).

**Correção:** `ops/vps/whatsapp-sidecar/src/auth.ts:4-13`
```ts
export function isAuthorized(req: IncomingMessage): boolean {
  const secret = process.env.WHATSAPP_FALLBACK_SECRET;
  if (!secret) return false;
  const authHeader = req.headers['authorization'] || '';
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  if (!token) return false;
  // timingSafeEqual ...
}
```
- Removido `x-fallback-secret` totalmente.
- `Authorization` obrigatório com prefixo `Bearer `; qualquer outro header ou token cru retorna 401.
- `src/server.ts:15` já limitava `Access-Control-Allow-Headers` a `Authorization, Content-Type`, portanto não houve necessidade de remover header CORS legado.

**Prova:** `npm --prefix ops/vps/whatsapp-sidecar run build` passa, `npx tsc --noEmit --project ops/vps/whatsapp-sidecar/tsconfig.json` exit 0.

## 3. channel-service.ts — fail-closed estrito (URL/secret ausentes)

**Achado:** `src/modules/atendimento/services/channel-service.ts:185-189` fazia fail-open:
```ts
if (!fallbackUrl) {
  if (this._isConnected) return { success: true, messageId: Date.now().toString() };
  return { success: false, error: 'No WhatsApp provider available' };
}
```
Se `WHATSAPP_FALLBACK_URL` ausente mas `_isConnected === true`, devolvia sucesso simulado com messageId fake. Também não validava `WHATSAPP_FALLBACK_SECRET`, permitindo envio sem auth.

**Correção:** `src/modules/atendimento/services/channel-service.ts:146-152` e `181-185`
```ts
async initialize(): Promise<void> {
  const fallbackUrl = process.env.WHATSAPP_FALLBACK_URL;
  const fallbackSecret = process.env.WHATSAPP_FALLBACK_SECRET;
  if (!fallbackUrl || !fallbackSecret) {
    dbLogger.warn('channel-service: WHATSAPP_FALLBACK_URL or WHATSAPP_FALLBACK_SECRET not configured');
    return;
  }
  // fetch com Authorization: Bearer fallbackSecret obrigatório
}
async sendMessage(to: string, message: string): Promise<SendResult> {
  const fallbackUrl = process.env.WHATSAPP_FALLBACK_URL;
  const fallbackSecret = process.env.WHATSAPP_FALLBACK_SECRET;
  if (!fallbackUrl || !fallbackSecret) {
    return { success: false, error: 'WhatsApp fallback not configured: missing WHATSAPP_FALLBACK_URL or WHATSAPP_FALLBACK_SECRET' };
  }
  // fetch POST /api/v1/messages/send com Authorization: Bearer
}
```
- Ambos `initialize` e `sendMessage` agora exigem URL **e** secret; qualquer ausência retorna fail-closed, nunca `success: true` nem `messageId` simulado.
- Headers agora sempre `Authorization: Bearer <secret>` quando configurado; sem condicional `if (fallbackSecret)`.

**Cobertura em teste:** `src/modules/atendimento/services/__tests__/channel-service.test.ts` adicionados:
- `returns early when WHATSAPP_FALLBACK_SECRET is missing (fail-closed)` — `initialize` não chama fetch, warn combinado.
- `returns config error when fallback SECRET is missing (fail-closed)` — `sendMessage` com `_isConnected=true` ainda retorna `{ success:false, error:/not configured/i, messageId:undefined }` e `fetch` não chamado.
- `returns config error when both URL and secret missing and does not simulate messageId` — garante `messageId === undefined`.
- `never returns simulated messageId when sidecar config is missing even if instance reports connected` — nível `sendWhatsAppMessage` facade.
- Atualizados todos os `expect(global.fetch).toHaveBeenCalledWith` para `https://whatsapp-sidecar.example.com` e `Authorization: Bearer`.

Total testes channel-service: 37 passando (antes 30). Todos fail-closed exibem `error` contendo `not configured` e `messageId === undefined`.

## 4. getQRCode — buscar endpoint autenticado do sidecar

**Achado:** `src/modules/atendimento/services/channel-service.ts:223` era `getQRCode(): string | null { return this.currentQRCode; }` síncrono retornando cache local nunca preenchido via sidecar. Sidecar já implementa `GET /api/v1/session/qrcode` autenticado (`ops/vps/whatsapp-sidecar/src/server.ts:49-58`) retornando `{ qrcode, qrcode_available }`, mas cliente não chamava.

**Correção:** `src/modules/atendimento/services/channel-service.ts:219-236`
```ts
async getQRCode(): Promise<string | null> {
  const fallbackUrl = process.env.WHATSAPP_FALLBACK_URL;
  const fallbackSecret = process.env.WHATSAPP_FALLBACK_SECRET;
  if (!fallbackUrl || !fallbackSecret) return null;
  try {
    const res = await fetch(`${fallbackUrl.replace(/\/+$/, '')}/api/v1/session/qrcode`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${fallbackSecret}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { qrcode?: string | null };
    return data.qrcode ?? null;
  } catch { return null; }
}
```
- Alinha com `server.ts:49` path `/api/v1/session/qrcode` (autenticado após `isAuthorized`).
- Ambos lados usam `Authorization: Bearer`.
- `currentQRCode` mantido como campo interno mas não mais usado como contrato; contrato agora é fetch autenticado.

**Cobertura:** novos testes em `channel-service.test.ts`:
- `returns null when fallback URL/secret not configured (fail-closed)` — não chama fetch.
- `returns null when secret missing even if URL present`
- `fetches QR code from authenticated sidecar endpoint` — verifica `GET /api/v1/session/qrcode` com `Authorization: Bearer`.
- `returns null when sidecar returns non-ok status` (401)
- `returns null when fetch throws`

Contrato mantido consistente: se endpoint não estivesse implementado, a task permitia remover o contrato; como está implementado no sidecar, a remediação manteve e alinhou.

## 5. Linhas em branco finais — git diff --check

**Achado:** `git diff --check` reportava:
```
src/modules/atendimento/services/__tests__/channel-service-imports.test.ts:9: new blank line at EOF.
src/modules/atendimento/services/channel-service.ts:241: new blank line at EOF.
```

**Correção:** normalizado EOF para single newline em ambos arquivos via `rstrip() + '\n'` (Python). Verificado `git diff --check` após correção:
```
warning: in the working copy ... CRLF will be replaced by LF ...
DIFF_CHECK:0
```
Sem `new blank line at EOF.` restante. CRLF warnings são apenas informativos do git (autocrlf), não erro de blank line.

Também adicionado ignore em `eslint.config.mjs:16` para `ops/vps/whatsapp-sidecar/dist/**` para que rebuild do sidecar não quebre `npm run lint` (11 erros `no-require-imports`/`no-var` em `dist/*.js`).

## 6. Validação separada sidecar + app (testes focados, typecheck, lint, build:cf, wrangler dry-run)

### Sidecar (isolado)

| Comando | Resultado |
|---|---|
| `npm --prefix ops/vps/whatsapp-sidecar install` | `added 10 packages, 0 vulnerabilities` (14s) |
| `npm --prefix ops/vps/whatsapp-sidecar run build` | `tsc` exit 0 (—) |
| `npx tsc --noEmit --project ops/vps/whatsapp-sidecar/tsconfig.json` | exit 0 |
| `test` script | inexistente — documentado como `se scripts existirem` (package.json tem apenas `build`, `start`, `dev`) |

### App — testes focados

```
npm test -- --runInBand src/modules/atendimento/services/__tests__/channel-service.test.ts src/modules/atendimento/services/__tests__/channel-service-imports.test.ts
→ PASS channel-service.test.ts (37 passed)
→ PASS channel-service-imports.test.ts (1 passed, não importa playwright)
→ Total 37 channel-service focados, 80 com evolution-service
```

Com `evolution-service.test.ts` incluso: 80 passed (22.3s).

### App — typecheck / lint

```
npm run typecheck → tsc --noEmit exit 0
npm run lint → eslint . --max-warnings=0 exit 0 (após ignore dist)
```

### App — build:cf

Comando: `npm run build:cf` (`opennextjs-cloudflare build && node scripts/inject-pg-global.mjs`)

- Build Next.js: `Compiled successfully in 33.5s`, `Generating static pages (124/124)`, `Collecting build traces`
- Middleware: 73.7 kB
- OpenNext bundle: `Applying code patches: 7.640s`, `Bundling the OpenNext server...`
- Warning legado persistente (não relacionado ao fix): `duplicate-case` em `reports/export/route.js:case 22` (já documentado no baseline)
- Final: `Worker saved in .open-next/worker.js 🚀`, `OpenNext build complete.`, `[inject-pg-global] pg and Hyperdrive runtime globals ensured`

Duração: ~330s (async Job, ambiente Windows WSL warning esperado).

**Tamanho gzip real:**

- `handler.mjs` (bundle principal): `13 264 169 bytes` → `gzip 2 636 490 bytes = 2 574,70 KiB = 2,51 MiB` (`python gzip.compress`)
- `worker.js` stub: `2 630 bytes` → `gzip 906 bytes = 0,88 KiB` (stub que carrega handler)
- `wrangler deploy --dry-run` reporta: `Total Upload: 19551.35 KiB / gzip: 3366.01 KiB` (480 assets em `.open-next/assets`)

Comparação com baseline do receipt (`gzip: 4020.06 KiB`): redução de ~445 KiB devido à remoção de `playwright`/`playwright-core`/`chromium-bidi` do `serverExternalPackages` e do bundle.

### Wrangler dry-run

```
npx wrangler deploy --dry-run
→ wrangler 4.125.0, warnings: Multiple environments defined (sem --env, usa top-level) e duplicate-case (mesmo de build)
→ Read 480 files from .open-next/assets
→ Total Upload: 19551.35 KiB / gzip: 3366.01 KiB
→ Bindings: AGENT (Durable Object), NEXT_CACHE_DO_QUEUE, NEXT_INC_CACHE_KV, HYPERDRIVE, IA_HANDLE_ISSUER, WORKER_SELF_REFERENCE, ASSETS, NODE_ENV
→ --dry-run: exiting now. (exit 0, sem deploy)
```

Sem segredos expostos, sem commit, sem deploy real.

## Arquivos tocados

Modificados (git diff):
- `ops/vps/whatsapp-sidecar/README.md`
- `ops/vps/whatsapp-sidecar/src/auth.ts`
- `src/modules/atendimento/services/channel-service.ts`
- `src/modules/atendimento/services/__tests__/channel-service.test.ts`
- `src/modules/atendimento/services/__tests__/channel-service-imports.test.ts`
- `eslint.config.mjs` (ignore dist)
- `.env.example` (documentação fallback HTTPS)

Novos (untracked, parte da feature sidecar, não commitados nesta task):
- `ops/vps/whatsapp-sidecar/src/server.ts`, `whatsapp-service.ts`, `index.ts`, `Dockerfile`, `docker-compose.yml`, `package.json`, `tsconfig.json`

Preexistentes mas mantidos no diff da branch (não introduzidos nesta task, mas ainda modificados vs origin):
- `next.config.ts` (remoção playwright de serverExternalPackages)
- `src/lib/whatsapp/send.ts` (delegação para channel-service sem check isConnected)

## Divergências do receipt histórico

- Receipt mencionava `WHATSAPP_FALLBACK_URL=http://127.0.0.1:3030` como válido para Cloudflare; corrigido para HTTPS público.
- Receipt não capturava `x-fallback-secret` como vetor; agora removido.
- Receipt apontava `channel-service` como fail-closed, mas código permitia `messageId` simulado; agora estritamente fail-closed com testes.
- `getQRCode` não constava no receipt como divergente; agora alinhado cliente/servidor via Bearer.

## Pendências / não feito (conforme escopo)

- Sem `git commit`, sem `git push`, sem `wrangler deploy` real, sem exposição de `WHATSAPP_FALLBACK_SECRET`.
- Sidecar permanece com `node_modules` local (ignorado por `.gitignore`) e `dist` rebuildado (ignorado por eslint).
- Testes de integração que exigem `TEST_DATABASE_URL` loopback não executados nesta tranche (focados unit apenas).
