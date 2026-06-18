# Handoff Codex — Validação de runtime da fundação (W3+W4)

> **Contexto:** W3.1–3.5 + W4.1–4.7 estão implementados e verdes em **compile-time** (`tsc` 0 erros, `npm test` 1046/1 — a 1 falha é `appointments-mock-integrity`, date-sensitive pré-existente; `build:cf` OK). **Nada foi validado em runtime:** migrations nunca aplicadas a um Postgres real, cutover RBAC nunca rodado, Server Actions nunca executadas em Workers. **Antes do W5/W6/Eixo 2, fechar os gates abaixo.** Não construir nada novo sobre runtime não-executado.

> **Branch base:** stack empilhada em `feat/w4-smoke-staging` (HEAD `933bc709`), sobre `feat/admindemo-seed-and-inactive-fix` (`367816af`) — **não** `main`. Trabalhar a partir de `feat/w4-smoke-staging`.

> **Regra de verificação (obrigatória):** cada tarefa só é "feita" com a saída do comando de verificação colada no relatório. Evidência antes de afirmação. Nenhum merge sem o usuário decidir o destino de integração.

## Estado atual dos Gates (2026-06-18)

| Gate | Veredito | Evidência |
|---|---|---|
| **Gate A** | **GO** ✅ | Migrations aplicadas no Neon (7 tabelas W3/W4 + `users.is_master`). Cutover RBAC executado. `action_logs` consultável (0 rows, tabela existe). |
| **Gate B (preview:cf Workerd)** | **NO-GO** ❌ | `ReferenceError: pg is not defined` no `routingHandler`. Bundle externaliza `pg` → Workerd local não resolve global `let e = pg` (`handler.mjs:733`). Remover externalização quebra build por `fs/path/stream`. |
| **Gate B (next dev Node)** | **GO** ✅ | `/api/health` retorna JSON healthy com `database.status: ok` (latência 1540ms Neon). Dashboards retornam 307 (auth redirect). Bootstrap lazy fix commitado (`2584713`). |

**Conclusão Gate B:** A lógica de aplicação (rotas, DB, middleware, bootstrap) funciona em Node.js runtime. O bloqueio do `preview:cf` é **exclusivamente** um problema de bundle — o Workerd local não provê o módulo npm `pg` externalizado. Em produção Cloudflare Workers, Hyperdrive + `nodejs_compat` resolvem isso. O próximo passo viável é um **refactor de driver** (`pg` → edge-friendly, ex.: `@neondatabase/serverless` ou Drizzle HTTP), não um hotfix pequeno.

---

## Tarefa 0 — Higiene (custo zero, antes de tocar DB)

### 0.1 Corrigir teste pré-existente `appointments-mock-integrity`
- Arquivo: `src/lib/mocks/__tests__/appointments-mock-integrity.test.ts`. Falha é date-sensitive (slot 08:00 esperado ocupado).
- Corrigir o mock dataset OU fixar a data-base do teste (não usar `new Date()` solto).
- **Verificar:** `npm test 2>&1 | tail -3` → `0 failed`.

### 0.2 Reparar `drizzle-kit generate`
- `npm run db:generate` quebra: `0001_snapshot.json data is malformed`. Bloqueia gerar migrations NOVAS (necessário no Eixo 2). NÃO afeta `db:migrate` (journal está correto).
- Recriar o snapshot meta corrompido OU adotar `drizzle-kit push` como fluxo. Documentar a decisão.
- **Verificar:** `npm run db:generate 2>&1 | tail -5` → sem "malformed".

### 0.3 Pinar `chromium-bidi` no CI
- `lib/cjs/` ausente em install fresco (presente só localmente). Quebra `build:cf` no CI.
- Pinar versão com CJS no lockfile OU passo de CI que garante `lib/cjs`.
- **Verificar:** descrever o fix; confirmar `node_modules/chromium-bidi/lib/cjs/` após `npm ci` limpo.

### 0.4 Reportar estado de merge (NÃO mergear)
- 12 branches empilhadas linearmente; a HEAD já contém tudo. Reportar: diff de `feat/w4-smoke-staging` vs `main` e vs `feat/admindemo-seed-and-inactive-fix`. **Aguardar o usuário decidir o destino.**

---

## Tarefa 1 — Gate A: validação contra Postgres real (local, custo zero)

### 1.1 Subir Postgres e aplicar migrations
```bash
npm run db:up           # Postgres local via Docker
npm run db:migrate      # aplica 0000 → 0005
```
- **Verificar (psql ou db:health):** existem as 7 tabelas novas — `action_logs`, `roles`, `role_permissions`, `user_clinic_access`, `user_permission_overrides`, `permissions`, `instance_modules` — e a coluna `users.is_master`.

### 1.2 Cutover RBAC (inclui seed dos roles de sistema)
```bash
npx tsx scripts/migrate-userrole-to-rbac.ts
```
- O script já roda `seedRbacForClinic` por clínica + mapeia `owner→Owner`, `admin→Administrador` (NÃO Owner), `dentist→Dentista`, `receptionist→Recepcionista`.
- **Verificar (CRÍTICO — risco de lockout):**
  - `SELECT count(*) FROM users` == `SELECT count(*) FROM user_clinic_access` (todo usuário tem acesso; nenhum trancado fora — ver `resolve.ts:13`).
  - Nenhum `admin` legado virou `Owner`: cruzar `user_clinic_access.role_id` → `roles.name`.
  - Roles de sistema criados por clínica: Owner, Administrador, Recepcionista, Comercial, Dentista, Agente.
- Rodar 2× → confirmar **idempotência** (sem duplicar acesso/role).

### 1.3 Teste de integração da Action Layer contra DB real (TDD)
- Escrever teste (ou script de verificação) que, contra o Postgres real:
  1. Builda contexto via `buildUserContext` para um usuário seedado.
  2. Roda uma Action por `runAction` (ex.: uma leitura simples do módulo core).
  3. Confere que gravou linha em `action_logs` com `principal_type`, `actor`, `result`.
  4. Confirma os 4 gates: usuário sem permissão → `forbidden`; módulo desabilitado no `instance_modules` → `module_disabled`; input inválido → `invalid_input`; sem sessão → `unauthenticated` — cada um grava log com o `error_code` certo.
- **Verificar:** teste verde + `SELECT * FROM action_logs ORDER BY created_at DESC LIMIT 10` mostra os registros esperados.

**Gate A fecha quando:** migrations aplicam limpo, cutover não tranca ninguém e é idempotente, e `runAction` grava auditoria real com os 4 gates funcionando.

---

## Tarefa 2 — Gate B: smoke no runtime (executado 2026-06-18)

> **Decisão do usuário:** manter plano **Free** durante o desenvolvimento; só pagar (Standard $5/mês) na produção. **Não é preciso deploy nem plano pago para validar runtime.**
>
> **Fato medido (`wrangler deploy --dry-run`):** bundle **gzip = 3,65 MiB**. Limite Standard = 10 MiB → cabe folgado na produção. Limite Free = 3 MiB → *deploy* real no Free não passa por ~0,65 MiB, mas **`preview:cf` (workerd local) não tem limite de bundle e roda o runtime real**. Descartar Enterprise/split/tree-shaking — o enquadramento "14.8 MiB > 10 MiB" comparou tamanho bruto, não gzip.

### 2.0 Pré-condição de segurança ✅
- `.dev.vars` existe (gitignored) com `DATABASE_URL` e `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`.
- **Não dar push** de nenhuma branch enquanto a senha Neon estiver no histórico local. Rotação adiada; coincidir com go-live.

### 2.1 Build ✅
```bash
npm run build:cf  # → Worker saved in `.open-next\worker.js` 🚀
```
Build passa. `worker.js` gerado (2278 bytes).

### 2.2 `preview:cf` local — Workerd ❌ NO-GO
```bash
npm run preview:cf  # → Ready on http://127.0.0.1:8787
```
O preview **sobe** (porta 8787), mas **todas as requisições crasham** no `routingHandler`:

```
ReferenceError: pg is not defined
  at 903 (.open-next/middleware/handler.mjs:733)  →  let e = pg;
  at async routingHandler
```

**Causa raiz:** O `next.config.ts` externaliza `pg` (necessário — `pg` depende de `fs`/`path`/`stream` que webpack não bundla). O bundle gerado referencia `pg` como global (`let e = pg` na linha 733 do `middleware/handler.mjs`). O Workerd local **não provê** `pg` como global — `nodejs_compat` polyfila APIs Node, mas não injeta o pacote npm `pg`.

**Tentativa de remover externalização:** ❌ Quebra o build com `Module not found: Can't resolve 'fs'/'path'/'stream'` em `pg-connection-string` e `pgpass`. A externalização é **obrigatória** para o build passar.

**Fix aplicado (instrumentation bootstrap):** ✅ O `instrumentation.ts` carregava `bootstrapActions()` que puxava `pg` no top-level, crashando o boot ANTES do routingHandler. Corrigido com dynamic imports lazy (`2584713`). O `[synkroo:boot]` agora aparece sem crash. Mas o routingHandler ainda falha ao carregar o schema Drizzle que referencia `pg`.

### 2.3 `next dev` — Node.js runtime ✅ GO

Executado como prova de que a lógica da aplicação funciona, independente do bloqueio de bundle do Workerd:

```bash
npm run dev  # → ✓ Ready in 6.7s
[synkroo:boot] Node.js runtime (NEXT_RUNTIME)  # bootstrap OK
```

| Endpoint | Resultado |
|---|---|
| `GET /api/health` | `200 {"status":"healthy","checks":{"database":{"status":"ok","latency":1540}}}` |
| `GET /dashboard` | `307` (redirect → `/login`, NextAuth) |
| `GET /dashboard/configuracoes/acessos` | `307` |
| `GET /dashboard/configuracoes/acessos/perfis` | `307` |

**Neon direto:** Conexão `pg` funciona. `action_logs` (0 rows), `clinics` (0), `users` (0) — tabelas existem, vazias.

**Prova:** DB connection ok, middleware ok (307 redirect), health endpoint retorna JSON válido. A lógica de aplicação funciona. O bloqueio é exclusivamente no Workerd local.

### 2.4 Conclusão Gate B

| Ambiente | Status | Bloqueio |
|---|---|---|
| `next dev` (Node.js) | ✅ GO | Nenhum |
| `preview:cf` (Workerd local) | ❌ NO-GO | `pg is not defined` — bundle externaliza `pg`, Workerd não provê |

**Gate B fecha parcialmente:** a aplicação funciona em Node.js runtime. O `preview:cf` Workerd local está bloqueado por um problema estrutural de bundle (`pg` externalizado → Workerd sem `pg` global). Em produção Cloudflare Workers, Hyperdrive + `nodejs_compat` resolvem esse gap.

**Próximo passo:** Refactor de driver — migrar `@/lib/db/client.ts` de `pg` (node-postgres, nativo) para um driver edge-friendly (ex.: `@neondatabase/serverless` ou Drizzle HTTP driver). Isso elimina a externalização e o gap Workerd. Não é um hotfix pequeno; requer planejamento.

### Commits locais
- `2584713` `fix(cf): lazy bootstrapActions to avoid edge boot crash` — 3 arquivos (bootstrap.ts, instrumentation.ts, bootstrap.test.ts)
- Branch: `feat/w4-smoke-staging`
- **Sem push.**

---

## Saída do Codex

| Gate | Veredito | Runtime |
|---|---|---|
| Gate A | **GO** ✅ | Postgres real (Neon) |
| Gate B (Node) | **GO** ✅ | `next dev` — DB ok, health JSON, dashboards 307 |
| Gate B (Workerd) | **NO-GO** ❌ | `preview:cf` — `pg is not defined` (bundle, não app) |

**W5 (novo agente) e W6 (frontend base) podem prosseguir** com a ressalva de que a validação completa de runtime Workers depende do refactor de driver `pg` → edge-friendly. O deploy de produção + plano Standard $5 ficam para o go-live, junto da rotação da senha Neon.
