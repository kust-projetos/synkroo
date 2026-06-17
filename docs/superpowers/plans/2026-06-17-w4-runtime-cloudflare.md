# W4 — Runtime Cloudflare (OpenNext + Hyperdrive + Vectorize) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rodar o produto-base na topologia-alvo: Next 15 (App Router) em **Cloudflare Workers** via **OpenNext**, Postgres gerenciado por instância atrás do **Hyperdrive**, **Vectorize** provisionado (consumido no W5), auth edge validada, bootstrap de Actions no entrypoint, e pipeline de deploy por instância de cliente.

**Architecture:** Um Worker por instância de cliente (infra dedicada). O app Next é adaptado por `@opennextjs/cloudflare`. O acesso a Postgres passa pelo **Hyperdrive** (pooling + cache na edge), com o driver `pg` sob `nodejs_compat`. Secrets e bindings são por instância (cada cliente tem seu Worker + DB + índices). **Este é o maior risco de plataforma do roadmap** — a Task 1 é um spike go/no-go antes de qualquer migração.

**Tech Stack:** Next 15, `@opennextjs/cloudflare`, Wrangler, Cloudflare Workers (`nodejs_compat`), Hyperdrive, Vectorize, KV. Drizzle + `pg`.

**Spec:** roadmap-mestre §4 (visão-alvo) e §8 W4; decisões abertas §10 (provider Postgres, Vectorize); riscos da spec do W3 (Server Actions em Workers).

**Pré-requisitos:** W0/W1 implementados. W3 implementado é desejável (sistema modular limpo), mas a Task 1 (spike) pode rodar antes para reduzir risco cedo.

> **Importante:** Cloudflare/OpenNext evoluem rápido. Onde este plano cita configs, **confirmar a sintaxe atual** via `wrangler` e docs (context7: `@opennextjs/cloudflare`, Hyperdrive, Vectorize) antes de aplicar — não copiar cegamente.

---

## File Structure

- Create: `wrangler.toml` (ou `wrangler.jsonc`) — config do Worker, bindings, flags.
- Create: `open-next.config.ts` — config do adapter Cloudflare.
- Create: `src/instrumentation.ts` — boot (registerActions) no runtime.
- Modify: `src/lib/db/client.ts` — usar connection string do Hyperdrive.
- Modify: `package.json` — scripts `build:cf`, `preview:cf`, `deploy:cf`.
- Delete: `vercel.json`.
- Create: `docs/runbook-deploy-instancia.md` — processo de deploy por cliente.

---

### Task 1: Spike go/no-go — Next 15 + Server Actions em Workers

**Objetivo:** provar que App Router + **Server Actions** (mecanismo de UI do W3) rodam sob `@opennextjs/cloudflare` **antes** de migrar. Se não rodarem, o W3 cai no fallback (route handlers) — decisão a tomar aqui, não no fim.

- [ ] **Step 1: Instalar o adapter e gerar a config base**

Run: `npm i -D @opennextjs/cloudflare wrangler`
Consultar docs atuais (context7) para o comando de init do adapter e a config mínima.

- [ ] **Step 2: Branch isolada de spike** (`spike/cf-runtime`) com uma página mínima que exercita uma **Server Action** simples (sem DB) e uma rota de API.

- [ ] **Step 3: Build + preview local no runtime Workers**

Run: `npx opennextjs-cloudflare build` (confirmar nome do comando) e `npx wrangler dev`/`preview`.
Expected: a página carrega, a Server Action executa, a rota responde — **no runtime Workers**, não Node.

- [ ] **Step 4: Registrar o veredito**

Documentar em `docs/runbook-deploy-instancia.md` (seção "Compatibilidade"): Server Actions OK? Quais limitações (streaming, tamanho, APIs Node)? Se **não** OK → registrar a decisão de usar **route handlers** como mecanismo de UI no W3 (atualizar a spec do W3 §2.4) e seguir.

- [ ] **Step 5: Commit (na branch de spike) + decisão**

```bash
git add . && git commit -m "spike(cf): valida Server Actions e App Router em Workers (OpenNext)"
```
> **Gate:** só prosseguir para as Tasks 2+ após o veredito. Este é o ponto de maior incerteza.

---

### Task 2: Postgres gerenciado + Hyperdrive + driver

**Decisão de provider (roadmap §10):** Postgres gerenciado por instância (recomendado: **Neon**, com `pgvector` disponível) atrás do **Hyperdrive** como pooler/cache. Confirmar com o produto se cada cliente terá Neon dedicado ou Postgres self-managed.

- [ ] **Step 1: Provisionar um Postgres de staging** (Neon ou equivalente) e obter a connection string.

- [ ] **Step 2: Criar o Hyperdrive** apontando para esse Postgres

Run: `npx wrangler hyperdrive create synkroo-staging --connection-string="postgres://..."`
Anotar o `id` do Hyperdrive para o binding.

- [ ] **Step 3: Adaptar `src/lib/db/client.ts`** para usar a connection string do Hyperdrive em runtime Workers

O `getDb()` deve usar `env.HYPERDRIVE.connectionString` quando rodando no Worker (e `DATABASE_URL` em dev/local). Usar `pg` com `nodejs_compat`. Confirmar o padrão atual de `pg` + Hyperdrive nas docs (context7).
Expected: nenhuma quebra do contrato `getDb()` consumido pelos repositories/Action Layer.

- [ ] **Step 4: Verificar conexão**

Em `wrangler dev` com o binding, executar uma query simples (ex.: health do DB) e confirmar resposta. Rodar a suíte de integração que toca DB local continua passando (driver inalterado em dev).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/client.ts wrangler.toml
git commit -m "feat(cf): acesso a Postgres via Hyperdrive (pg + nodejs_compat)"
```

---

### Task 3: Config OpenNext + Wrangler + flags

**Files:** `open-next.config.ts`, `wrangler.toml`

- [ ] **Step 1: `wrangler.toml`** com: `compatibility_flags = ["nodejs_compat"]`, `compatibility_date` atual, bindings (Hyperdrive, KV, Vectorize — Tasks 2/4), e o entrypoint do Worker gerado pelo OpenNext. Confirmar o formato exigido pelo adapter.

- [ ] **Step 2: `open-next.config.ts`** conforme o adapter Cloudflare (cache, incremental, etc.). Consultar docs atuais.

- [ ] **Step 3: Scripts em `package.json`**

```json
"build:cf": "opennextjs-cloudflare build",
"preview:cf": "opennextjs-cloudflare build && wrangler dev",
"deploy:cf": "opennextjs-cloudflare build && wrangler deploy"
```
(confirmar nomes de comando do adapter)

- [ ] **Step 4: Build de produção no runtime CF**

Run: `npm run build:cf` → Expected: build conclui; bundle dentro do limite do Worker. Se exceder, avaliar split/externals.

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml open-next.config.ts package.json
git commit -m "feat(cf): config OpenNext + Wrangler + scripts de build/deploy"
```

---

### Task 4: Bindings — Vectorize e KV

- [ ] **Step 1: Criar índice Vectorize de staging** (dimensão conforme o modelo de embedding alvo — confirmar no W5; provisionar a infra aqui)

Run: `npx wrangler vectorize create synkroo-staging --dimensions=<n> --metric=cosine`

- [ ] **Step 2: Criar namespace KV** (cache/estado leve)

Run: `npx wrangler kv namespace create SYNKROO_CACHE`

- [ ] **Step 3: Adicionar os bindings ao `wrangler.toml`** (Vectorize, KV) e tipar `env` (gerar tipos: `wrangler types`).

- [ ] **Step 4: Verificar** que `wrangler dev` sobe com os bindings sem erro (não precisa consumir ainda; consumo é W5).

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml worker-configuration.d.ts 2>/dev/null
git commit -m "feat(cf): bindings Vectorize e KV provisionados"
```

---

### Task 5: Bootstrap de Actions + auth edge no runtime

- [ ] **Step 1: Boot determinístico** — chamar `bootstrapActions()` (W3.4) no início do runtime

Criar `src/instrumentation.ts` com `register()` que chama `bootstrapActions()` (Next instrumentation roda uma vez no boot). Confirmar que o OpenNext executa `instrumentation.ts` no Worker; se não, chamar no entrypoint do Worker.
Expected: `getActions()` populado em produção (catálogo de permissões e tools do agente disponíveis).

- [ ] **Step 2: Validar middleware/auth na edge**

O `middleware.ts` usa `getToken` (`next-auth/jwt`), já edge-compatible. Confirmar que `AUTH_SECRET` está disponível como secret do Worker (`wrangler secret put AUTH_SECRET`) e que o login/sessão funcionam no preview CF.
Expected: rota protegida redireciona sem sessão; com sessão, acessa.

- [ ] **Step 3: Commit**

```bash
git add src/instrumentation.ts
git commit -m "feat(cf): bootstrap de Actions no boot + auth edge validada"
```

---

### Task 6: Deploy por instância + remover Vercel

- [ ] **Step 1: Runbook de deploy por instância** (`docs/runbook-deploy-instancia.md`)

Documentar, por cliente: criar Postgres + Hyperdrive + Vectorize + KV dedicados; setar secrets (`AUTH_SECRET`, `JWT_SECRET`, LLM, Evolution); definir `instance_modules` contratados (via master/seed); `wrangler deploy` com o nome/rota do cliente. Incluir checklist de provisionamento.

- [ ] **Step 2: Remover `vercel.json`** e referências a Vercel em docs/CI.

Run: `rm vercel.json` + ajustar `.github/workflows/*` para o pipeline CF (build:cf + deploy em ambiente protegido).

- [ ] **Step 3: Deploy de staging real** (uma instância de teste)

Run: `npm run deploy:cf` (ambiente staging) → Expected: Worker publicado; URL responde.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cf): runbook de deploy por instancia; remove vercel.json"
```

---

### Task 7: Verificação final (smoke em staging)

- [ ] **Step 1: Health** — `GET /api/health` na URL do Worker → Expected: 200, DB OK (via Hyperdrive).
- [ ] **Step 2: Fluxo de auth** — login → dashboard protegido no Worker.
- [ ] **Step 3: Uma Server Action (ou route handler, conforme veredito da Task 1)** exercita `runAction` ponta-a-ponta contra o Postgres via Hyperdrive; confirmar gravação em `action_logs`.
- [ ] **Step 4: Typecheck + testes locais** seguem verdes (`npx tsc --noEmit`, `npm test`).
- [ ] **Step 5: Commit final** → `git add -A && git commit -m "chore(cf): staging verde — runtime Cloudflare operacional (W4)"`

---

## Self-Review

**Spec coverage (§4, §8 W4):**
- OpenNext → Workers → Tasks 1/3 ✓
- Hyperdrive → Postgres por instância → Task 2 ✓
- Vectorize provisionado → Task 4 ✓ (consumo no W5)
- Auth edge validada → Task 5 ✓
- Bootstrap de Actions no runtime → Task 5 ✓ (fecha o gancho do W3.4)
- Pipeline de deploy por instância + remover vercel.json → Task 6 ✓
- Spike de Server Actions (risco flagged no W3) → Task 1 ✓

**Placeholder scan:** as configs (`wrangler.toml`, `open-next.config.ts`) remetem a "confirmar sintaxe atual via docs" **de propósito** — Cloudflare/OpenNext mudam e cravar sintaxe agora geraria erro. Cada Task tem objetivo + comando-base + verificação concreta, não TBD.

**Riscos e dependências:**
- **Task 1 é gate go/no-go.** Se Server Actions não rodarem em Workers, a spec do W3 §2.4 muda para route handlers (mesmo `runAction`). Decidir aqui.
- `getDb()` via Hyperdrive (Task 2) não altera o contrato consumido por repositories/Action Layer — risco contido ao client.
- Dimensão do índice Vectorize (Task 4) depende do modelo de embedding (W5) — provisiona-se a infra; o valor exato é confirmado no W5.
- **Não-bloqueante para o Eixo 2:** módulos de domínio podem ser planejados/implementados em paralelo; só dependem do W3, não do W4.
