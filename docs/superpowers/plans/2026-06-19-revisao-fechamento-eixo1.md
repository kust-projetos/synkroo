# Revisão de fechamento — Eixo 1 (W0–W6) antes do Eixo 2

> **Data:** 2026-06-19 · **Branch:** `main` (já contém `feat/w4-smoke-staging` mergeado)
> **Objetivo:** verificar se W0–W6 + ajustes pré-Eixo 2 foram implementados corretamente e listar pendências antes de planejar o Eixo 2.
> **Regra:** evidência antes de afirmação — cada veredito abaixo tem comando/arquivo:linha.

## Verdade-base objetiva (verde)

| Check | Resultado |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **0 erros** (exit 0) |
| `npm test` (jest unit) | **737 passed, 5 skipped, 0 failed** — 101/102 suites |
| `npm run test:integration` (Postgres real) | **5/5 PASS** — os 4 gates da Action Layer + sucesso + escrita em `action_logs` (re-verificado pós-rebaseline) |
| Supabase | **zerado** (0 no `package.json`; resíduo só em README de teste) |
| `graphify-out` versionado | **0** arquivos (destrackeado) |
| `npm run db:generate` | **OK** ("No schema changes" — sem "malformed"); Tarefa 0.2 resolvida pelo rebaseline |
| `chromium-bidi` | **pinado 15.0.0** (Tarefa 0.3) |
| `vercel.json` | **removido**; `wrangler.toml` com Hyperdrive/Vectorize/KV + `nodejs_compat`; CI `cf-build` presente |

## Veredito por fase

| Fase | Veredito | Nota |
|---|---|---|
| **W0** Estabilização | ✅ completo | graphify-out destrackeado, docs reescritos com stack real, tsc verde |
| **W1** Morte do Supabase | ✅ completo | zero Supabase, tipos inferidos do schema |
| **W2** Camada de dados | ✅ absorvido | decisão documentada; lint anti-DB-em-client presente (`.eslintrc.json`) |
| **W3.1** Action Layer | ✅ completo | `runAction` com os 4 gates (`run.ts:16,36,38,41`), grava `action_logs`, `agentToolsFor` (`agent.ts:25`) |
| **W3.2** RBAC | ✅ completo | 5 tabelas (`schema/rbac.ts`), cutover idempotente, anti-escalada (`resolve.ts:17`); pgEnum legado mantido por design |
| **W3.3** Manifesto/gates/contexto | ⚠️ parcial | construtores de contexto OK; só gate de **menu** plugado (`build-menu.ts:48`); `withModuleRoute`/`assertModuleForJob` sem uso real |
| **W3.4** Módulos/Core/lint | ⚠️ **BLOCKER** | template Core completo, mas `provisionClinic`/`seedRbacForClinic` **órfãos** — signup (`repositories/auth/index.ts:119`) insere clínica sem seed RBAC |
| **W3.5** Painel admin | ⚠️ parcial | matriz de permissões leiga, mas form de atribuição pede **UUID cru** (`UserAccessForm.tsx:39,51`) — acceptance "zero jargão" não cumprida |
| **W4** Runtime Cloudflare | ✅ completo (2026-06-19) | W4.8 driver edge: `postgres.js` substitui `pg`; `serverExternalPackages` atualizado; Hyperdrive via `instrumentation.ts`; Gate B Workerd GO — `preview:cf` → `database.status: ok` (latência 38ms); ver `docs/superpowers/plans/2026-06-18-handoff-validacao-runtime.md` |
| **W5** Novo agente IA | ⚠️ só remoção | Task 1 (~8k LOC removidos) feita e limpa (tsc verde); agente 4+1 (Tasks 2–5) **greenfield deferido pelo próprio plano** |
| **W6** Frontend base | ⚠️ parcial | 3/4 redirects + shells + doc OK; `buildMenu` criado mas **não integrado** (menu usa `can=()=>true`, TODO W7+); `contatos` não resolvido |

## Pendências antes do Eixo 2

### 🔴 Blocker (corrigir antes)
1. **RBAC não é provisionado no signup (W3.4).** `provisionClinic`/`seedRbacForClinic` não têm caller no fluxo real. Clínica nova nasce sem roles/acesso → `resolveAccess` retorna `can:()=>false` → o próprio dono não abre `/dashboard/configuracoes/acessos`. Ligar o seed ao `insert(clinics)` do signup (mesma transação) e criar o `userClinicAccess` Owner do dono.

### 🟠 Alto (decidir antes de construir sobre o runtime)
2. ~~**Runtime Workers nunca validado (W4 / Gate B).**~~ ✅ **RESOLVIDO (2026-06-19)** — `postgres.js` substitui `pg`; `serverExternalPackages` + `webpack.externals` atualizados; `instrumentation.ts` com Hyperdrive; `preview:cf` retorna `database.status: ok` (latência 38ms). Ver `docs/superpowers/plans/2026-06-18-handoff-validacao-runtime.md`.
3. **Anti-lockout ausente.** Nada impede remover o último Owner. Anti-escalada existe; anti-lockout não. Guarda em `assignUserAccess`/remoção de acesso.

### 🟡 Médio (qualidade/guardrail)
4. **W3.5** — substituir entrada de UUID por seletores reais de usuário/perfil (resolve TODOs e a acceptance).
5. **W3.3/W6** — plugar gates reais (`withModuleRoute` em `/api/*`, `assertModuleForJob` em crons) e integrar `buildMenu`+RBAC no shell.
6. **W6** — resolver `contatos` (redirect ou remover do menu).
7. **Lint boundaries** de `warn`→`error` para bloquear regressão de fronteira no CI.

### ⚪ Deferido legítimo (Eixo 2 / go-live — não é pendência de fundação)
- Redesenho do eixo CRM/Contatos (§9.1 → módulo E-04).
- Migração de cada página de domínio ao template.
- Remoção do `pgEnum userRole` pós-cutover em todos os ambientes.
- Deploy prod + plano Standard + rotação da senha Neon (go-live).

---

## Recomendação (decisões resolvidas) e diretrizes para o agente implementador

> As duas decisões abertas estão **resolvidas abaixo**. O agente implementador segue esta ordem; não há decisão de produto pendente para os itens 1–2.

### Decisão A — Agente W5: **deferir o build, ratificado.**
A fundação fecha **sem agente funcional** (só a remoção dos ~8k LOC + stubs foi feita). Justificativa: o build do agente depende de (i) runtime Workers validado — agora sim ✅ — e (ii) das Actions/módulos que ele opera, que nascem no Eixo 2. A própria ordem sugerida do Eixo 2 (`Core → E-01 → E-02 → E-03 → Agente`) põe o agente por último. Construí-lo agora seria sobre runtime não-executado e antes de suas tools existirem. **W5 Tasks 2–5 viram um workstream do Eixo 2**, sequenciado após o Core e a validação de runtime. Não é pendência de fundação.

### Decisão B — Driver edge: **resolvido via `postgres.js` (W4.8, 2026-06-19)** ✅

O problema: `pg` em `serverExternalPackages` → `let e = pg` no bundle → `ReferenceError: pg is not defined` no Workerd.

**Solução implementada (W4.8 v4):**
- `pg`/`pg-connection-string`/`pgpass` **removidos** de `serverExternalPackages` e `webpack.externals`
- `postgres.js` adicionado (^3.4.9)
- `postgres` **adicionado** a `serverExternalPackages` + `webpack.externals` (necessário — usa `net`/`tls`/`crypto` que workerd não bundla natively)
- `instrumentation.ts`: `getCloudflareContext()` + extração `HYPERDRIVE.connectionString` via `as any` cast + `setDbConnectionString()`
- `src/lib/db/client.ts`: Pool de `postgres.js` + drizzle de `drizzle-orm/postgres-js`; interface pública preservada
- **postgres.js conecta via TCP** em todas situações (dev Docker + Hyperdrive prod); não precisa de WebSocket proxy
- **Gate B Workerd: GO** — `preview:cf` → `http://127.0.0.1:8787/api/health` retorna `{"status":"healthy","checks":{"database":{"status":"ok","latency":38}}}`
- 2 arquivos de rota ajustados para compatibilidade `postgres.js` result type (`Array.isArray()` em vez de `.rows`): `whatsapp/webhook/route.ts`, `instagram/webhook/route.ts`
- Interface pública de `client.ts` **preservada**
- Worktree: `feat/w4-8-driver-edge-v4` · 5 arquivos escopo + 2 consequence fixes

**Drivers testados e descartados:**
- `@neondatabase/serverless` — Pool usa WebSocket (`wsProxy`), não funciona contra Postgres Docker plain (sem proxy WebSocket na porta 5432)
- `pg` Pool — funciona em todas situações mas requer `globalThis.pg` injection no bundle do Workerd

> **Driver final:** `postgres.js` — elimina dependência de polyfill/global injection, conecta via TCP, compatível com Hyperdrive.


### Ordem de execução para o próximo agente

**Bloco 1 — Fechar a fundação (fazer primeiro; pequeno e cirúrgico):**

1. **[BLOCKER] Provisionar RBAC + acesso do dono no signup.** Em `src/repositories/auth/index.ts` → `createUserWithClinic` (transação, linha 116+), após criar `clinic` e o `user` (role `owner`):
   - Refatorar `seedRbacForClinic` (`src/core/rbac/seed.ts:18`) para **aceitar um handle de DB/tx** (hoje usa `getDb()` interno). **Obrigatório:** chamá-lo com o `tx` da transação do signup — chamar com `getDb()` quebra por FK (`roles.clinicId` → clínica ainda não commitada, conexão diferente).
   - Após o seed, buscar o `roles.id` do perfil **Owner** (`RESERVED_ROLE_OWNER`) daquela clínica e inserir `userClinicAccess(userId = owner.id, clinicId = clinic.id, roleId = ownerRoleId)` **dentro da mesma tx**. O dono recebe role **Owner**, **não** `is_master` (master é o super-admin de instância, reservado).
   - Eliminar/repurposar o órfão `src/modules/core/services/clinic-provisioning.ts` (`provisionClinic`): ou deletá-lo, ou torná-lo o helper canônico (clínica + seed + acesso do dono) que o signup chama. Não deixar dois caminhos divergentes.
   - **Aceitação:** signup novo → `SELECT count(*) FROM user_clinic_access WHERE user_id = <owner>` = 1 com role Owner; o dono abre `/dashboard/configuracoes/acessos` sem redirect. Teste de integração cobrindo isso.

2. **[Alto] Anti-lockout.** Em `assignUserAccess`/`createRole` (e futuro `removeUserAccess`), bloquear remover/rebaixar o **último** acesso Owner da clínica. Anti-escalada já existe (`resolve.ts:17`); falta anti-lockout. Teste cobrindo "não é possível remover o último Owner".

3. **[Médio, agora desbloqueado] Menu com RBAC real.** Com o item 1 feito, substituir `can = () => true` (`sidebar.tsx:83`, `TODO(W7+)`) pela resolução real via `buildUserContext` + `buildMenu`/`filterMenuByAccess` (já existem, sem call site). Aceitação: usuário sem `core:manage_users` não vê o item "Usuários e acessos".

**Bloco 2 — Validação de runtime (own spec → plano):**

4. **W4.8 — Driver edge** (Decisão B). ✅ **completo (2026-06-19)** — `postgres.js` substitui `pg`; Gate B Workerd GO. `preview:cf` → `database.status: ok` (latência 38ms). Worktree `feat-w4-8-driver-edge-v4`. Ver `docs/superpowers/plans/2026-06-18-handoff-validacao-runtime.md` para evidências completas.

**Bloco 3 — Itens médios restantes (podem ir junto ao Core do Eixo 2):**

5. W3.5 — substituir entrada de UUID (`UserAccessForm.tsx:39,51`) por seletores reais de usuário/perfil (resolve os TODOs em `acessos/page.tsx:14` e `perfis/page.tsx:14`).
6. Plugar `withModuleRoute` em `/api/*` de módulos contratáveis e `assertModuleForJob` nos crons.
7. Resolver `contatos` (redirect ou remover do menu, `sidebar.tsx:100`).
8. Lint boundaries `warn` → `error` (`.eslintrc.json:23`) para bloquear regressão de fronteira no CI.

> **Planejamento do Eixo 2** pode começar em paralelo ao Bloco 1/2, mas o **código** dos módulos do Eixo 2 só deve começar depois do Bloco 1 (fundação fechada) e do Bloco 2 (runtime validável).

## Conclusão
Fundação **substancialmente implementada e verde em compile-time + runtime** (Action Layer validada contra Postgres real + Gate B Workers fechado). **Ainda não fechada:** 1 blocker funcional (seed RBAC no signup — Bloco 1). **Bloco 2 (Gate B Workers) ✅ completo** — runtime Workers validado via `globalThis.pg` injection. Recomendação: executar o **Bloco 1** (fecha a fundação) antes de iniciar o **código** do Eixo 2; o agente W5 fica como workstream do Eixo 2 (Decisão A). O planejamento do Eixo 2 pode iniciar em paralelo.
