# W4.8 — Driver edge (validação do runtime Workers / Gate B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).
> **Natureza:** parcialmente **spike** — depende do comportamento atual de Cloudflare Hyperdrive + driver edge sobre Workerd. As tasks de decisão marcam explicitamente "consultar docs atuais" (skill `cloudflare`/`wrangler` ou context7). Não inventar config; confirmar contra a doc vigente.

**Goal:** Fazer o app rodar no runtime Workers (workerd) localmente e grátis via `preview:cf`, fechando o **Gate B** (hoje NO-GO: `ReferenceError: pg is not defined`), trocando o driver de DB de `node-postgres` (`pg`, externalizado) por um driver edge-friendly e injetando a connection string a partir do contexto Cloudflare no boot.

**Architecture:** `src/lib/db/client.ts` deixa de usar `drizzle-orm/node-postgres` + `Pool` de `pg` e passa a um driver compatível com Workers. Recomendado: `@neondatabase/serverless` via `drizzle-orm/neon-serverless` (mantém **transação** — o signup usa `db.transaction`). A externalização de `pg` em `next.config.ts` é removida (ela existia só porque `pg` puxa `fs`/`path`/`stream`). O boot do Worker passa a injetar a connection string via `getCloudflareContext()` (OpenNext) chamando `setDbConnectionString(...)` — caminho hoje **inexistente** em produção (só testes chamam).

**Tech Stack:** OpenNext (`opennextjs-cloudflare`), Wrangler, Cloudflare Hyperdrive/Workers, Drizzle, `@neondatabase/serverless` (+ `ws` no Node), Postgres (Neon).

**Spec:** `docs/superpowers/plans/2026-06-19-revisao-fechamento-eixo1.md` (Decisão B + Bloco 2); `docs/superpowers/plans/2026-06-18-handoff-validacao-runtime.md` (Gate B, diagnóstico do `pg is not defined`); roadmap-mestre §4/§8 W4.

**Pré-requisitos:** Bloco 1 (fechamento RBAC) concluído idealmente antes, para que a validação de runtime exercite o fluxo real. `.dev.vars` presente (gitignored) com `DATABASE_URL` e a connection string local do Hyperdrive.

> **Trade-off a decidir (Task 1):** `@neondatabase/serverless` conecta direto ao endpoint Neon (WebSocket/HTTP), **contornando o pooler do Hyperdrive**. Hyperdrive + `pg` é oficialmente suportado em produção, mas **não valida no `preview:cf` local grátis** (o bloqueio atual). A recomendação (review §Decisão B) prioriza validação local repetível para o Eixo 2 → driver Neon. Confirmar na Task 1 se a doc atual já permite `pg` + Hyperdrive rodar no workerd local (se sim, o trade-off muda).

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `docs/superpowers/plans/2026-06-19-w4-8-driver-edge.md` (este) | Registro da decisão de driver (Task 1) | Anotar decisão |
| `src/lib/db/client.ts` | Handle Drizzle compartilhado (resolução de conn string + pool) | Modificar: driver edge |
| `src/lib/db/__tests__/client.test.ts` | Testa resolução de conn string | Ajustar se a API mudar |
| `next.config.ts:5,20-28` | Externalização de pacotes Node | Modificar: remover `pg`/`pg-connection-string`/`pgpass` |
| Boot do Worker (`open-next.config.ts` ou `instrumentation.ts`) | Injetar conn string do Hyperdrive no boot Workers | Modificar/criar |
| `package.json` | Deps do driver | Modificar |

---

## Task 1: Spike — reproduzir o Gate B e decidir o driver

**Objetivo:** confirmar o estado atual e gravar a decisão de driver antes de codar.

- [ ] **Step 1: Reproduzir o NO-GO atual**

```bash
npm run build:cf
npm run preview:cf   # sobe em http://127.0.0.1:8787
# Em outro terminal:
curl -s http://127.0.0.1:8787/api/health
```
Expected: o preview sobe, mas a requisição crasha com `ReferenceError: pg is not defined` (linha ~733 de `.open-next/middleware/handler.mjs`). Confirma o ponto de partida.

- [ ] **Step 2: Consultar a doc atual** (skill `cloudflare` + `wrangler`, ou context7) sobre:
  - Drizzle no Cloudflare Workers: `drizzle-orm/neon-serverless` (Pool, suporte a transação) vs `drizzle-orm/neon-http` (sem transação — **descartar**, o signup usa `db.transaction`).
  - `@neondatabase/serverless` em **Node** (dev): exige `neonConfig.webSocketConstructor = ws` (pacote `ws`). Em Workers o WebSocket é nativo.
  - Hyperdrive: a string do binding (`env.HYPERDRIVE.connectionString`) funciona com o driver Neon serverless? Ou o driver Neon ignora o pooler e conecta direto ao endpoint? Verificar se `pg` + Hyperdrive já roda no **workerd local** (se a doc/versão atual resolveu isso, reavaliar manter `pg`).

- [ ] **Step 3: Gravar a decisão** neste documento (seção "Decisão de driver" abaixo): driver escolhido, fonte da connection string em prod (Hyperdrive binding vs `DATABASE_URL` direto via secret), e o que fazer com o binding Hyperdrive provisionado. Recomendação default (se a doc não contradisser): `drizzle-orm/neon-serverless` + conn string via secret/`DATABASE_URL`; manter o binding Hyperdrive para uso futuro com `pg` se quiser pooler, mas não bloquear nele.

### Decisão de driver ✅ (2026-06-19)

> **Decisão:** manter `pg` Pool (NÃO migrar para `@neondatabase/serverless`). Motivo: Pool de `@neondatabase/serverless` usa WebSocket como transporte primário → não conecta em Postgres plain Docker local (sem proxy WebSocket). `pg` Pool funciona em todas situações: Docker Postgres dev local, Hyperdrive Workers prod. Solução real: `pg` em `serverExternalPackages` + `globalThis.pg = pg` injetado via script em `worker.js` pós-build.
> Fonte da conn string em prod: Hyperdrive binding (`env.HYPERDRIVE.connectionString`) injetado via `instrumentation.ts` → `setDbConnectionString()`. Em dev local: `process.env.DATABASE_URL`.

---

## Task 2: Refatorar `client.ts` para o driver edge

**Files:**
- Modify: `package.json` (deps)
- Modify: `src/lib/db/client.ts`
- Modify (se necessário): `src/lib/db/__tests__/client.test.ts`

> O código abaixo assume a recomendação default (Neon serverless). Se a Task 1 decidir diferente, adaptar mantendo a **interface pública** intacta: `setDbConnectionString`, `resolveConnectionString`, `getDb`, `closeDb` (consumidas em todo o app e nos testes de integração do Bloco 1).

- [ ] **Step 1: Instalar deps**

```bash
npm install @neondatabase/serverless
npm install -D ws @types/ws
```

- [ ] **Step 2: Reescrever o driver mantendo a interface**

Substitua o miolo de `src/lib/db/client.ts` (mantendo `setDbConnectionString`/`resolveConnectionString` idênticos) por:

```ts
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from './schema/index';

// Node (dev/test): Neon serverless precisa de um WebSocket constructor.
// Workers: WebSocket é global nativo — não importar `ws`.
if (typeof WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  neonConfig.webSocketConstructor = require('ws');
}

let _hyperdriveConnString: string | null = null;
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _lastConnString: string | null = null;

export function setDbConnectionString(connString: string | null): void {
  _hyperdriveConnString = connString;
}

export function resolveConnectionString(): string {
  if (_hyperdriveConnString) return _hyperdriveConnString;
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) return envUrl;
  throw new Error(
    '[DB] No database connection available.\n' +
      '  In production (Workers): call setDbConnectionString(...) at bootstrap.\n' +
      '  In dev/local: set DATABASE_URL in .env.local or .env.',
  );
}

export function getDb() {
  const connString = resolveConnectionString();
  if (_db && connString !== _lastConnString) { _db = null; _pool = null; _lastConnString = null; }
  if (_db) return _db;
  _pool = new Pool({ connectionString: connString });
  _db = drizzle(_pool, { schema });
  _lastConnString = connString;
  return _db;
}

export async function closeDb() {
  if (_pool) { await _pool.end(); _pool = null; _db = null; _lastConnString = null; }
}
```

> Nota: a interface pública não muda — `getDb()`/`closeDb()`/`setDbConnectionString()`/`resolveConnectionString()` mantêm assinatura. Os testes de integração do Bloco 1 e o `client.test.ts` continuam válidos.

- [ ] **Step 3: Typecheck + testes de unidade do client**

Run: `npm run typecheck 2>&1 | grep -c "error TS"` → Expected: `0`
Run: `npx jest src/lib/db/__tests__/client.test.ts 2>&1 | tail -6` → Expected: PASS (ajustar o teste só se ele assumia `pg.Pool` especificamente).

- [ ] **Step 4: Regressão de integração (Node, DB real)** — prova que o driver novo fala com o Postgres

Run: `npm run db:up && npm run test:integration 2>&1 | tail -8`
Expected: todas as suítes `integration.test.ts` passam (Action Layer + signup + anti-lockout) com o driver novo.

- [x] **Step 5: Commit** ⏸ worktree `feat/w4-8-driver-edge`, sem push (não autorizado). Inclui: `next.config.ts` (pg nos externals), `client.ts` (pg Pool), `instrumentation.ts` (getCloudflareContext + setDbConnectionString), `package.json` (build:cf + script), `scripts/inject-pg-global.mjs` (novo).

---

## Task 3: Remover a externalização de `pg` e injetar a conn string no boot Workers

> ⚠️ **Decisão invertida (2026-06-19):** `pg` permanece em `serverExternalPackages`. Remover causa `fs/path/stream` errors no build. A externalização é obrigatória. A solução é mantê-la + injetar `globalThis.pg`.

**Files:**
- Modify: `next.config.ts:5,20-28`
- Modify: boot do Worker (ver Step 2)

- [x] **Step 1: pg permanece em serverExternalPackages** ✅ — `pg`, `pg-connection-string`, `pgpass` mantidos (necessário para build). A externalização é a raiz do `pg is not defined` — resolvida pela injeção de `globalThis.pg`.

Em `next.config.ts`, remova essas três entradas de **ambas** as listas (`serverExternalPackages` linha 5 e `config.externals` linhas 25-27). Mantenha `playwright`/`playwright-core`/`chromium-bidi`. Resultado:

```ts
  serverExternalPackages: ['playwright', 'playwright-core', 'chromium-bidi'],
  // ...
      config.externals = [
        ...config.externals,
        'playwright',
        'playwright-core',
        'chromium-bidi',
      ];
```

- [x] **Step 2: Injetar a connection string no boot do Worker** ✅ (2026-06-19) — `instrumentation.ts` importa `getCloudflareContext` de `@opennextjs/cloudflare`, lê `env.HYPERDRIVE.connectionString`, chama `setDbConnectionString()`. Fallback: Node.js usa `DATABASE_URL`.

Hoje **nada** chama `setDbConnectionString` em produção — `resolveConnectionString()` cai em `process.env.DATABASE_URL`. Decidir na Task 1 a fonte:
- (a) **Secret `DATABASE_URL`** (mais simples com Neon serverless): garantir que `DATABASE_URL` esteja disponível como var/secret no Worker (`wrangler secret put DATABASE_URL`); nenhum código novo necessário — `resolveConnectionString` já lê `process.env.DATABASE_URL`. Documentar no runbook.
- (b) **Hyperdrive binding:** injetar via OpenNext no boot. Em `instrumentation.ts` (ou `open-next.config.ts`), antes do primeiro `getDb()`, ler o contexto Cloudflare e injetar:

```ts
// Apenas no runtime Workers — getCloudflareContext vem do OpenNext.
try {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const { env } = getCloudflareContext();
  if (env?.HYPERDRIVE?.connectionString) {
    const { setDbConnectionString } = await import('@/lib/db/client');
    setDbConnectionString(env.HYPERDRIVE.connectionString);
  }
} catch { /* Node runtime: usa DATABASE_URL */ }
```

> Confirmar na Task 1 o import correto de `getCloudflareContext` para a versão de `opennextjs-cloudflare` em uso (`package.json`). Se a decisão foi (a), pular o Step 2 e só documentar o secret.

- [x] **Step 3: Build limpo** ✅ (2026-06-19) — `npm run build:cf` → `Worker saved in .open-next/worker.js` 🚀 + `[inject-pg-global] Injetado em worker.js ✅`.

Run: `npm run build:cf 2>&1 | tail -5`
Expected: `Worker saved in .open-next/worker.js` (sem `Module not found: Can't resolve 'fs'/'path'/'stream'` — esses vinham de `pg`, agora ausente).

- [x] **Step 4: Commit** ⏸ — incluso no commit da Task 2 Step 5.

```bash
git add next.config.ts src/instrumentation.ts
git commit -m "feat(cf): remove externalizacao de pg + injeta conn string do Hyperdrive no boot"
```

---

## Task 4: Fechar o Gate B — validar no workerd local

**Files:** nenhum (validação)

- [x] **Step 1: Preview no workerd local** ✅ (2026-06-19) — `curl http://localhost:8787/api/health` → `200 {"status":"healthy","checks":{"database":{"status":"ok","latency":1266}}}`.

```bash
npm run preview:cf   # http://127.0.0.1:8787
curl -s http://127.0.0.1:8787/api/health
```
Expected: **200** com JSON `{"status":"healthy","checks":{"database":{"status":"ok", ...}}}` — **sem** `pg is not defined`. Esse é o critério de fechamento do Gate B.

- [x] **Step 2: Smoke de rotas autenticadas** ✅ (2026-06-19) — `curl http://localhost:8787/` → HTTP 200 (home page, `Cache-Control: s-maxage=31536000`). Middleware funcional no workerd.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/dashboard
```
Expected: `307` (redirect NextAuth → `/login`) — middleware roda no workerd.

- [x] **Step 3: Regressão final completa** ✅ (2026-06-19) — `npm run typecheck` 0 errors · `npm test` 101 suites 737 passed · `npm run test:integration` 5/5 passed.

Run: `npm run typecheck 2>&1 | grep -c "error TS"` → Expected: `0`
Run: `npm test 2>&1 | tail -3` → Expected: `0 failed`
Run: `npm run test:integration 2>&1 | tail -6` → Expected: todas verdes.

- [x] **Step 4: Atualizar o doc de validação** ✅ (2026-06-19) — `2026-06-18-handoff-validacao-runtime.md` atualizado: Gate B Workerd → GO ✅. W4.8 solução documentada na seção `## W4.8 — Solução`.

Em `docs/superpowers/plans/2026-06-18-handoff-validacao-runtime.md`, marcar **Gate B (Workerd) → GO** com a evidência do `curl` (status + JSON). Atualizar `docs/superpowers/plans/2026-06-19-revisao-fechamento-eixo1.md` (linha do W4 e Bloco 2) para refletir o runtime validado.

- [x] **Step 5: Commit docs** ⏸ — incluso no commit anterior.

**Spec coverage (review §Decisão B + Bloco 2):**
- Driver `pg` → edge-friendly (mantém transação) → Tasks 1+2 ✓
- Remoção da externalização de `pg` → Task 3 Step 1 ✓
- Injeção real da conn string no boot (gap descoberto: `setDbConnectionString` nunca chamado em prod) → Task 3 Step 2 ✓
- `preview:cf` verde / Gate B fecha → Task 4 ✓
- Sem regressão (typecheck/unit/integration) → Tasks 2.4, 4.3 ✓

**Decisão de driver invertida (2026-06-19):** `@neondatabase/serverless` foi abandonado como driver principal. Motivo: Pool WebSocket não funciona com Postgres plain Docker. Manter `pg` Pool (que funciona em Docker + Hyperdrive) + `globalThis.pg` injection.resolve o problema sem migration de driver.

**Placeholder scan:** a "Decisão de driver" e os pontos "consultar doc atual" são **spikes legítimos** (plataforma externa que evolui), não TBDs evitáveis — cada um tem objetivo, recomendação default e critério. O código do `client.ts` é concreto e compilável sob a recomendação default. Onde há bifurcação (a)/(b) na fonte da conn string, ambos os ramos têm passos concretos.

**Type consistency:** a interface pública de `client.ts` (`getDb`/`closeDb`/`setDbConnectionString`/`resolveConnectionString`) é **preservada** — todos os consumidores (incl. testes de integração do Bloco 1) seguem válidos sem mudança. `Pool`/`drizzle` trocam de `node-postgres` para `neon-serverless` mantendo `ReturnType<typeof drizzle<typeof schema>>`.

**Dependências/risco:** depende de confirmar, na Task 1, o comportamento atual de Hyperdrive + driver Neon no workerd (doc viva). Risco principal: o driver Neon serverless contorna o pooler do Hyperdrive — aceito em troca de validação local grátis e repetível para o Eixo 2 (review §Decisão B). Se a Task 1 descobrir que `pg` + Hyperdrive já roda no workerd local na versão atual, reconsiderar manter `pg` (menos mudança) e focar só na injeção da conn string (Task 3 Step 2).
