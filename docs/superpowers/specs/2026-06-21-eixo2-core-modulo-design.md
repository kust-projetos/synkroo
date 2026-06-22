# Eixo 2 — Módulo Core (Onda 0) — Design

> **Tipo:** Spec de módulo (design). Primeiro módulo do Eixo 2.
> **Data:** 2026-06-21
> **Status:** Aprovado em substância (brainstorming). Pendente revisão do spec escrito antes do plano de implementação.
> **Escopo:** apenas planejamento/documentação. Implementação por outro agente, guiado pelo plano derivado deste.
> **Dependências:** Eixo 1 fechado (Action Layer, RBAC, manifesto, runtime Workers GO). Nenhum outro módulo do Eixo 2.

## 0. Contexto e objetivo

O **Core** é o primeiro item do Eixo 2 (**Onda 0** do sequenciamento). Tem dois papéis:

1. **Exemplo canônico** do template de módulo (§6 do roadmap-mestre) — a referência que todos os módulos seguintes copiam.
2. **Fechar as pendências de fundação** deferidas do Eixo 1 (menu/RBAC, seletores, gates, lint, anti-lockout, contatos).

**Estado de entrada (já existe, Eixo 1):** Action Layer (`runAction` com 4 gates, `action_logs`), RBAC granular (5 tabelas, `resolveAccess`, seed idempotente no signup, anti-lockout em `assignUserAccess`), manifesto de módulos (`makeManifest`/`isEnabled`), e o **menu do Core já filtrado por manifesto+RBAC** (`getVisibleCoreMenu` → `buildUserContext` + `buildMenu` + `filterMenuByAccess`).

**Fonte de verdade superior:** roadmap-mestre (`2026-06-17-...-roadmap-design.md`) §5 (Action Layer), §6 (template), §9.1 (CRM/Contatos). Sequenciamento: `2026-06-21-eixo2-sequenciamento-design.md`.

---

## 1. Princípio organizador — Tipo A vs Tipo B

O trabalho do Core divide-se em dois tipos, tratados diferente para evitar generalização especulativa:

- **Tipo A — fecha lacuna real:** entregar completo e com qualidade. Tem valor imediato e usuário/consumidor já existente.
- **Tipo B — estabelece padrão cujos consumidores (módulos contratáveis) só nascem em ondas futuras:** entregar **mecanismo + UMA instância de referência genuína + deferir o resto explicitamente**. O Core é o *exemplo* canônico — um exemplo precisa de uma instância de cada padrão, **não** de N aplicações a alvos sintéticos.

**Decomposição:** um único spec/plano, ordenado **A antes de B** (A é coeso e shippable; B é a metade mais fina, apoiada na fundação de A).

---

## 2. Estado atual (reconhecimento — verificado em 2026-06-21)

| Item | Estado | Evidência |
|---|---|---|
| Menu manifesto+RBAC (Core) | ✅ funciona p/ itens do Core | `lib/ui/menu-actions.ts:15`, `lib/ui/build-menu.ts:42-48`, `core/modules/gates.ts:23` |
| Menu — outros itens | ⚠️ ~15 `navItems` estáticos client-side, sem RBAC/manifesto | `lib/ui/sidebar.tsx:75-91` |
| Seletores usuário/perfil | ❌ input de UUID cru | `modules/core/ui/UserAccessForm.tsx:32-50`; TODOs em `app/dashboard/configuracoes/acessos/page.tsx:14` e `.../acessos/perfis/page.tsx:14` |
| Gates `withModuleRoute`/`assertModuleForJob` | ⚠️ definidos, **sem caller** | `core/modules/gates.ts:10-18,34-36` |
| `contatos` | ⚠️ página existe, fora do menu | `app/dashboard/contatos/page.tsx` |
| Lint de fronteira | ⚠️ `warn` (não `error`) | `.eslintrc.json:23-31` |
| Anti-lockout | ⚠️ só downgrade em `assignUserAccess`; **sem `removeUserAccess`**; `resolveAccess`/`getAccess` **não filtram `isActive`** | `modules/core/actions/assign-user-access.ts`; `core/rbac/resolve.ts`, `core/rbac/repository.ts:22-30` |
| Template §6 | ⚠️ parcial: faltam `services/`, `repositories/`, `schema/`, `integrations/`; actions usam `getDb()` direto | `modules/core/*` |

> Descoberta-chave: `schema/core.ts` é arquivo legado **misturado** — contém clinics/users/credentials (Core) **e** patients/procedures/dentists/feedback (Operacional E-02). Separação física por bounded context é prematura enquanto os outros módulos não migram.

---

## 3. Escopo — Tipo A (lacunas reais)

### A1. Camada `repositories/` + `services/` do Core *(fundação do template)*

Hoje as 4 actions do Core (`assign-user-access`, `create-role`, `set-module-contract`, + as novas) chamam `getDb()` direto. Estabelecer o fluxo canônico **`action → service → repository → drizzle`**:

- `src/modules/core/repositories/` — acesso a dados do domínio Core: `usersRepo`, `rolesRepo`, `accessRepo`, `clinicsRepo`. Encapsulam as queries Drizzle (hoje espalhadas em actions e em `core/rbac/repository.ts`).
- `src/modules/core/services/` — regras de negócio: provisionamento, **invariante anti-lockout (A3)**, orquestração das operações de acesso.
- Actions passam a delegar a services; nenhuma `getDb()` direto em `actions/`.

> Relação com `core/rbac/repository.ts` (o `RbacRepo`/`drizzleRbacRepo` de leitura usado por `resolveAccess`): permanece (é a leitura de resolução de acesso). Os novos repositories do módulo cobrem as **operações de escrita/listagem** do painel admin. Documentar a fronteira para não duplicar.

### A2. Seletores de usuário/perfil (W3.5)

- Read-actions na Action Layer: `core.listClinicUsers` e `core.listClinicRoles`, ambas `module:'core'`, `requires:'core:manage_users'`, sobre os repositories (A1). RBAC consistente com as escritas da mesma tela.
- `UserAccessForm.tsx`: trocar os dois `<input placeholder="UUID...">` por `<select>` populados pelas read-actions.
- Páginas `acessos/page.tsx` e `acessos/perfis/page.tsx`: resolver os `TODO(W3.5)` carregando as listas reais.
- **Aceitação:** atribuir acesso sem digitar UUID; selects mostram nome do usuário e nome do perfil.

### A3. Invariante anti-lockout completo (3 caminhos)

A invariante real é **"a clínica retém ≥1 Owner ativo (`isActive=true`) com acesso"**. A guarda atual cobre só 1 dos 3 caminhos de violação. Extrair para um helper de serviço único (`assertOwnerInvariant` em `services/`) e aplicá-lo em **todos**:

- **(a) Downgrade de role** — `assignUserAccess` já cobre → migrar para o helper (DRY).
- **(b) Remoção de acesso** — **nova action `core.removeUserAccess`** (`requires:'core:manage_users'`) + botão na UI; aplica o helper antes de deletar `userClinicAccess`.
- **(c) Desativação de usuário** — confirmado que `getAccess`/`resolveAccess` **não** filtram `isActive` (`repository.ts:22-30`), mas o login bloqueia inativos → desativar o último Owner = lockout. **Entra no escopo do Core** criar/ajustar `core.deactivateUser` (ou o caminho real de desativação existente), `requires:'core:manage_users'`, aplicando o helper antes de `isActive=false`.
- **Aceitação (testes de integração):** não é possível remover, rebaixar **nem desativar** o último Owner ativo da clínica.

### A4. `contatos` — deferir para E-04 (decisão de modularidade)

Análise (§6 abaixo): "Contatos" (a tela `ContactSplitView`) é a **camada unificada do módulo CRM (E-04)**, distinta de Pacientes (Operacional/E-02) e Leads (Comercial/E-05). Pelo princípio §9.1, Operacional e Comercial funcionam **sem** o CRM.

- **Decisão:** o Core **não** redireciona nem deleta `contatos`. `redirect → /crm` seria incorreto (assume CRM sempre presente, viola modularidade).
- **Comportamento até E-04:** `/dashboard/contatos` fica fora do menu **e indisponível por acesso direto** (`notFound()`/guard equivalente) até o módulo CRM assumir a rota.
- **Ação no Core:** documentar a fronteira (§6) e o deferral; destino final e modelo de domínio (entidade unificada vs. referências) decididos no spec do **E-04** (§9.1, com proposta + mockup).

---

## 4. Escopo — Tipo B (padrão + 1 referência)

### B1. Schema-ownership — instância física real + seam público

- **Mover** `src/lib/db/schema/rbac.ts` → `src/modules/core/schema/rbac.ts` (≈7 importadores, arquivo **não-misturado** — refator barato e seguro). Atualizar os imports: `modules/core/actions/*`, `core/rbac/seed.ts`, `core/rbac/repository.ts`, `core/rbac/agent-access.ts`, `scripts/migrate-userrole-to-rbac.ts`, e os testes.
- `src/modules/core/schema/index.ts` — interface pública de schema do Core: exporta o `rbac` (físico, local) e **re-exporta** as demais tabelas do Core de `@/lib/db/schema` (clinics, users, userCredentials, modules, action_logs) — estas continuam fisicamente centrais porque `schema/core.ts` está misturado (separação vem quando E-02 migrar).
- **Agregação de migrations preservada:** `src/lib/db/schema/index.ts` deve continuar capturando as tabelas RBAC (passa a `export * from '@/modules/core/schema/rbac'` ou caminho equivalente) para o `db:generate` não perder as tabelas. **Verificar `drizzle.config` e `db:generate` ("No schema changes") após o move.**
- **Caveat honesto (registrar):** com o eslint atual (`boundaries`: `lib` é allow-by-default; só `module→module` é restrito), este seam é **forward-looking, não enforçado** — ainda é possível importar `@/lib/db/schema` direto. É o padrão de ownership estabelecido, não ownership enforçado.

### B2. Gates — mecanismo + teste + doc (aplicação deferida)

- `withModuleRoute`/`assertModuleForJob` já existem e funcionam. O Core é `alwaysOn` (gatear suas rotas é no-op) e **não há módulo contratável existente** para gatear sem inventar stub manifests.
- **Refino do sequenciamento (`2026-06-21-eixo2-sequenciamento-design.md:65`):** a Onda 0 fecha **mecanismo + testes + documentação + primeira aplicação genuína quando houver alvo real no Core**. O rollout de gates em rotas/crons de módulos contratáveis fica nos specs dos módulos donos.
- **Decisão:** o Core entrega **o mecanismo + testes unitários + documentação do padrão** (como uma rota `/api/*` e um cron se plugam ao gate). **Não** criar manifests sintéticos para followup/agent/canais — esse gating pertence à migração de cada módulo.
- **Registrar explicitamente** (no spec e no plano) que a aplicação real é deferida por-módulo, para não ler como "feito em todo lugar".

### B3. Lint de fronteira `warn` → `error`

- **Rodar `npm run lint` primeiro** e confirmar zero violações de fronteira (fonte plausível: `legacy` em `src/services/*`). Corrigir o que aparecer.
- Só então flipar `.eslintrc.json:23` de `"warn"` para `"error"`, travando regressão de fronteira no CI.

### B4. Menu manifesto-driven — documentar + deferir migração dos estáticos

- A infra já funciona para o Core. **Não** migrar os ~15 `navItems` estáticos agora: seus consumidores são módulos ainda não migrados, que trazem seus itens via manifesto (condicionados a `isEnabled`) ao migrar.
- **Refino do sequenciamento (`2026-06-21-eixo2-sequenciamento-design.md:63-66`):** a Onda 0 fecha o padrão manifesto+RBAC no Core e documenta a dívida dos itens estáticos restantes; a migração dos itens de CRM/Pipeline/Leads/Campanhas fica nos specs dos módulos donos.
- **Registrar a dívida com justificativa de modularidade:** os estáticos atuais (CRM, Pipeline, Leads, Campanhas…) hoje aparecem **sempre**, o que num deploy sem esses módulos está semanticamente **errado** — não é cosmético. A correção é por-módulo, nas ondas seguintes.
- O flash do padrão híbrido (estáticos client + Core via `useEffect`/server-action) fica; o fix real (server components) está fora de escopo.

---

## 5. Arquitetura / fluxo de dados

Fluxo canônico que o Core materializa e os demais módulos copiam:

```
app (UI/route) → runAction(action, input, ctx) → service (regra) → repository (Drizzle) → DB
                       │
                       └─ gates: input (Zod) + entitlement (module) + RBAC (requires) + ctx + audit (action_logs)
```

- **Actions** declaram `module:'core'` + `requires:'core:...'`; expostas à UI (`runAction`) e ao agente (`agentToolsFor`) sem duplicação.
- **Read-actions** (A2) seguem o mesmo caminho com handlers de leitura.
- **Anti-lockout** (A3) vive no service como invariante, não na action.

---

## 6. Modularidade e fronteiras — Contatos / CRM (a nuance)

Três conceitos distintos, hoje confundidos:

| Conceito | Dono (módulo) | Existe sem CRM? |
|---|---|---|
| **Pacientes** | Operacional (E-02) | ✅ tela própria `/dashboard/pacientes` |
| **Leads** | Comercial (E-05) | ✅ tela própria `/dashboard/leads` |
| **Contatos** (`ContactSplitView`) | **CRM (E-04)** | ❌ é a *lente unificada* sobre pacientes+leads |

**Princípio (roadmap §9.1):** Operacional e Comercial funcionam **sem** o CRM. Sem o módulo CRM, o cliente **não fica sem dados** (pacientes e leads seguem nos seus módulos) — fica sem a **visão agregada "Contatos"**. *Onde mora a entidade contato* (entidade unificada vs. referências entre contextos) é decisão do **E-04**, fora do escopo do Core.

---

## 7. Error handling

- `runAction` mapeia `ActionError(code, msg)` → `{ result:'error', errorCode }`. Anti-lockout usa `ActionError('conflict', ...)` (já estabelecido).
- Admin read-actions (`core.listClinicUsers`, `core.listClinicRoles`) seguem a semântica normal da Action Layer: `unauthorized` sem sessão; `forbidden` sem `core:manage_users`; nunca vazam dados de outra clínica (ctx injeta `clinicId`).
- Lista vazia em erro de auth fica restrita a menu/discovery (`getVisibleCoreMenu`), onde falhar fechado é UX aceitável.
- Move de schema (B1): falha de import é capturada por `tsc` (gate de build) — verificação obrigatória no plano.

---

## 8. Testing

- **Integração (Postgres real, `jest.integration.config.js`):** anti-lockout nos 3 caminhos (remover / rebaixar / desativar último Owner); read-actions `listClinicUsers`/`listClinicRoles` (escopo por clínica); fluxo action→service→repository.
- **Unit:** helper `assertOwnerInvariant`; gates (`withModuleRoute`/`assertModuleForJob`) — manter/expandir os existentes.
- **Gates de build:** `npm run typecheck` (0 erros), `npm run db:generate` ("No schema changes" pós-move), `npm run lint` (0 violações antes do flip B3).

---

## 9. Definition of Done (refina o DoD da Onda 0 do sequenciamento)

- [ ] **A1** Core sem `getDb()` direto em `actions/`; `repositories/` + `services/` criados (exemplo canônico §6).
- [ ] **A2** Painel admin com seletores reais (sem UUID cru); TODOs W3.5 resolvidos.
- [ ] **A3** `removeUserAccess` e `deactivateUser` (ou caminho real de desativação) criados/ajustados; invariante anti-lockout (≥1 Owner ativo) cobrindo remoção, downgrade e desativação; testes de integração nos 3 caminhos.
- [ ] **A4** `contatos` documentado e deferido a E-04; sem redirect/delete; `/dashboard/contatos` fora do menu e indisponível por acesso direto até E-04.
- [ ] **B1** `rbac.ts` movido para `modules/core/schema/`; `schema/index.ts` (módulo) como seam público; migrations íntegras (`db:generate` limpo); caveat de não-enforço registrado.
- [ ] **B2** gates com mecanismo + testes + doc; refino do sequenciamento registrado; rollout real por-módulo deferido aos specs dos módulos donos.
- [ ] **B3** lint de fronteira em `error` no CI (após zero violações).
- [ ] **B4** padrão de menu do Core documentado; refino do sequenciamento registrado; dívida dos `navItems` estáticos restantes registrada com justificativa.
- [ ] `typecheck` 0 erros; unit + integração verdes.

---

## 10. Fora de escopo (deferido com razão)

- Migração dos `navItems` estáticos ao manifesto (por-módulo, ondas seguintes).
- Aplicação real dos gates a módulos contratáveis (por-módulo, ao migrar).
- Separação física de `schema/core.ts` (clinics/users vs. patients/procedures) — quando E-02 migrar.
- Modelo de domínio e destino de Contatos/CRM (E-04).
- Fix do flash do menu híbrido (server components).
- Remoção do `pgEnum userRole` legado (pós-cutover, go-live).

---

## 11. Riscos

- **Move de `rbac.ts` (B1):** quebra de import silenciosa → mitigado por `tsc` + `db:generate` + suíte. Risco baixo (≈7 importadores, arquivo não-misturado).
- **Flip do lint (B3):** pode revelar violações de fronteira pré-existentes → mitigado rodando lint antes e corrigindo.
- **Refator das actions para services/repositories (A1):** regressão silenciosa → coberto por testes de integração existentes (Action Layer) + novos.

---

## 12. Referências

| Documento | Papel |
|---|---|
| `2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` | Roadmap-mestre (§5 Action Layer, §6 template, §9.1 CRM) |
| `2026-06-21-eixo2-sequenciamento-design.md` | Sequenciamento do Eixo 2 (Core = Onda 0) |
| `2026-06-19-revisao-fechamento-eixo1.md` | Pendências deferidas que o Core absorve |
| `2026-06-19-fechamento-fundacao-rbac.md` | Padrão de anti-lockout / seed RBAC |
| `.planning/research/PITFALLS.md` | Consultar ao escrever o plano de implementação |
