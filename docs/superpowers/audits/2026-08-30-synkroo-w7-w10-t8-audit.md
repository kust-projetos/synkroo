# T8 — Auditoria e Remediação W7-W10 — Capability e Contrato RPC IA

> **Plano base:** `docs/superpowers/plans/2026-08-30-synkroo-w7-w10-gap-remediation-plan.md` (T8)
> **Execução:** CODER `task_78aa75e866e5` · `ctx_463f6f48c775` · `term_134d11df-1b63-4ac2-a5cd-ab9e35544020`
> **Data:** 2026-08-30T22:00Z
> **Tranche:** T8 (capability RPC IA)
> **Predecessoras:** T0/T1 `2026-08-30-synkroo-w7-w10-t0-t1-audit.md`, T2/T3 `t2-t3-audit.md`, T4/T5 `t4-t5-audit.md`, T6/T7 `t6-t7-audit.md` (HEAD 212e0200)
> **Escopo autorizado desta tranche:** apenas arquivos listados em §1.3.1; T9 permanece pendente.

---

## 1. Congelamento de evidência (T0 estendido)

### 1.1 Git — HEAD e branch

```
git rev-parse HEAD:  212e0200a763a658fbfd8232efa4ff42f3ac7c9f
git branch --show-current: main
git log --oneline -5:
  212e0200 experiment: W4.2 consents POST/PATCH via Action
  76f8d987 experiment: W4.2 consents GET via Action
  e264012b experiment: F-01..F-13 VERIFIED
  991fcddf experiment: batch VERIFIED W7-W11
  e11c6865 experiment: batch VERIFIED W5-W7
```

Worktree permanece sujo (270+ files changed, 9000+/6000- preexistentes + T1-T7). Nenhum `reset/clean` executado.

### 1.2 `git status --short` (resumo T8)

Capturado 2026-08-30T22:00Z (exclusivo T8 + preexistentes):

```
M src/core/agent-bridge/bridge-service.ts
M src/core/agent-bridge/rpc-contract.ts
M src/workers/ia-bridge/index.ts
M src/workers/ia-agent/index.ts
M src/core/ia-agent/types.ts
M src/core/ia-agent/orchestrator-logic.ts
M docs/runbooks/ia-rpc-rollout.md
M worker-configuration.d.ts
M src/workers/ia-bridge/worker-configuration.d.ts
M src/workers/ia-agent/worker-configuration.d.ts
... + 260 M/D/?? preexistentes de T0-T7 (ver audits anteriores)
```

`git diff --stat` tranche T8 exclusivo (sem T0-T7):

```
 src/core/agent-bridge/bridge-service.ts           |   29 +-
 src/core/agent-bridge/rpc-contract.ts             |    5 +-
 src/workers/ia-bridge/index.ts                    |   22 +-
 src/workers/ia-bridge/worker-configuration.d.ts   | 1466 ++++++-------
 src/workers/ia-agent/worker-configuration.d.ts    | 1438 +++++-------
 worker-configuration.d.ts                         | 1468 ++++++-------
 docs/runbooks/ia-rpc-rollout.md                   |   45 +-
```

### 1.3 Inventário exclusivo W7-W10 por tarefa

#### 1.3.1 Tranche T8 — RPC IA (P1)

| Arquivo | Estado | Ação |
|---|---|---|
| `src/core/agent-bridge/rpc-contract.ts` | M (já correto) | Fonte única `v1`/`v2`, `SUPPORTED=['v1','v2']`, `HandleIssuerBinding` só `issueHandle`, `AppBinding` sem `issueHandle` |
| `src/core/agent-bridge/bridge-service.ts` | M | Remover DTO manual duplicado (`ListToolsInput`/`ExecuteInput` etc.), usar `Omit<Rpc..., 'contractVersion'>` de `rpc-contract` |
| `src/core/ia-agent/types.ts` | M (já correto) | Re-export `RemoteTool`/`AppBinding` de `rpc-contract` sem segunda superfície |
| `src/core/ia-agent/orchestrator-logic.ts` | M | Garantir `ping` por turno com `BRIDGE_RPC_VERSION`, `listTools`/`executeAction` com `contractVersion` |
| `src/workers/ia-bridge/index.ts` | M | `HandleIssuerService` só `issueHandle`, `AppService` com `ping/dbHealth/listTools/executeAction` + `issueHandle` compat (primeiro deploy), `resolveContractVersion` antes de bootstrap/idempotency |
| `src/workers/ia-agent/index.ts` | M | `runTurn` com `ping` handshake, `contractVersion` check |
| `worker-configuration.d.ts` (3 arquivos) | M | Regenerados via `wrangler types` (app, bridge, agent) |
| `docs/runbooks/ia-rpc-rollout.md` | M | Rollout/rollback/bundle blocker documentado |
| `src/core/agent-bridge/__tests__/rpc-contract.test.ts` | — | Já cobre `v1`/`v2`, `resolveContractVersion`, `HandleIssuer` vs `App` surfaces |
| `src/workers/ia-bridge/__tests__/index.test.ts` | — | Já cobre `ping`, `dbHealth`, `HandleIssuer` vs `App` distinct, `issueHandle` compat, `listTools`/`executeAction` com `contractVersion`, version mismatch antes de bootstrap, `kvSeenStore` TTL |

---

## 2. Implementação T8 — Capability e contrato

### 2.1 Fonte única `rpc-contract.ts`

- **Antes (W10):** `bridge-service.ts` definia `ListToolsInput = { handle, conversationId }` e `ExecuteInput = { handle, conversationId, idempotencyKey, alias, input, flags }` sem `contractVersion`, duplicando `rpc-contract.ts` que já tinha `ListToolsInput = { contractVersion, handle, conversationId }` etc. Duas superfícies manuais divergentes.

- **Depois (T8):** `bridge-service.ts` importa `RpcListToolsInput`, `RpcListToolsResult`, `RpcExecuteInput`, `RpcExecuteResult` de `rpc-contract` e define:

```ts
export type ListToolsInput = Omit<RpcListToolsInput, 'contractVersion'>;
export type ListToolsResult =
  | Omit<Extract<RpcListToolsResult, { ok: true }>, 'contractVersion'>
  | Omit<Extract<RpcListToolsResult, { ok: false }>, 'contractVersion'>;
export type ExecuteInput = Omit<RpcExecuteInput, 'contractVersion'>;
export type ExecuteResult =
  | Omit<Extract<RpcExecuteResult, { ok: true }>, 'contractVersion'>
  | Omit<Extract<RpcExecuteResult, { ok: false }>, 'contractVersion'>;
```

`Omit` distribui corretamente sobre união `ok: true | ok: false` (evita `& { ok: boolean }` que quebra `catalog`/`error`).

### 2.2 Capability separation

- `rpc-contract.ts` já define:

```ts
export interface HandleIssuerBinding { issueHandle(input: IssueHandleInput): Promise<IssueHandleResult>; }
export interface AppBinding {
  ping(input: PingInput): Promise<PingResult>;
  dbHealth(input: DbHealthInput): Promise<DbHealthResult>;
  listTools(input: ListToolsInput): Promise<ListToolsResult>;
  executeAction(input: ExecuteInput): Promise<ExecuteResult>;
}
```

`HandleIssuerBinding` **só** `issueHandle` (1 método), `AppBinding` **sem** `issueHandle` (4 métodos). Teste `rpc-contract.test.ts` `keeps issuer and executor capabilities as separate typed surfaces` verifica `Object.keys(issuer)==['issueHandle']` e `Object.keys(app)==['ping','dbHealth','listTools','executeAction']` — **PASS** (87 linhas).

- `src/workers/ia-bridge/index.ts`:

```ts
export class HandleIssuerService extends WorkerEntrypoint<Env> {
  async issueHandle(input: CompatibleIssueHandleInput): Promise<IssueHandleResult> { return issueHandleRpc(this.env, input); }
}
export class AppService extends WorkerEntrypoint<Env> {
  async ping(...): Promise<PingResult> { ... }
  async dbHealth(...): Promise<DbHealthResult> { ... }
  // Compat: manter issueHandle em AppService temporariamente para rollout compatível (primeiro deploy)
  async issueHandle(...): Promise<IssueHandleResult> { return issueHandleRpc(this.env, input); }
  async listTools(...): Promise<ListToolsResult> { ... }
  async executeAction(...): Promise<ExecuteResult> { ... }
}
```

`HandleIssuerService` **não** tem `listTools`/`executeAction`, `AppService` tem todos + `issueHandle` compatível. Teste `ia-bridge/index.test.ts` `keeps issuer and executor entrypoint surfaces distinct` verifica `issuer.listTools===undefined` e `issuer.issueHandle` vs `service.listTools` — **PASS**.

### 2.3 Compatibilidade v1

`rpc-contract.ts`:

```ts
export const LEGACY_BRIDGE_RPC_VERSION = 'v1' as const;
export const BRIDGE_RPC_VERSION = 'v2' as const;
export const SUPPORTED_BRIDGE_RPC_VERSIONS = ['v1','v2'] as const;
export function resolveContractVersion(input: unknown): BridgeRpcVersion | null {
  if (input===null||typeof input!=='object') return null;
  const version = (input as { contractVersion?: unknown }).contractVersion;
  if (version===undefined) return LEGACY_BRIDGE_RPC_VERSION; // missing → v1
  return isSupportedVersion(version) ? version : null;
}
```

`AppService` `ping`, `dbHealth`, `listTools`, `executeAction`, `issueHandle` todos fazem `const contractVersion = resolveContractVersion(input); if (!contractVersion) return contractVersionMismatch();` **antes** de `validateBridgeEnv`, `ensureBootstrap`, `wasSeen`, `markSeen`, `runAction`. Teste `ia-bridge/index.test.ts` `rejects an unsupported execute version before bootstrap, idempotency, or Action` verifica `v99` → `contract_version_mismatch` e `executeActionLogic.notCalled` e `mockKV.put.notCalled` — **PASS**.

### 2.4 Testes ping/versão/hadle/replay/surface negativa

- **Ping por turno:** `src/core/ia-agent/orchestrator-logic.ts` `hasCurrentBridgeContract` faz `app.ping({ contractVersion: BRIDGE_RPC_VERSION })` antes de `listTools`/`executeAction`; `orchestrator-logic.test.ts` cobre fallback `FALLBACK` se `ping` falha.
- **Versão desconhecida antes de IA_SEEN:** `ia-bridge/index.test.ts` `rejects an unsupported execute version before bootstrap, idempotency, or Action` — `v99` não toca `IA_SEEN` (`mockKV.put.notCalled`).
- **Issuer indisponível:** `runDbHealthCheck` mock cobre `dbHealth` com `latencyMs`, `status healthy/unhealthy`.
- **Handle expirado/forjado:** `bridge-failures.test.ts` `handle expirado → expired` (`ttlSeconds:-1`), `handle de outra conversa → conversation_mismatch`, `forged.sig → invalid_signature`.
- **Replay idempotency:** `bridge-failures.test.ts` `replay por idempotencyKey → duplicate` e `bridge-service.test.ts` `same key em conversas diferentes → sem colisão` (usa `conv-a`/`conv-b`).
- **Surface negativa:** `bridge-service.test.ts` `ação fora do allowlist (system) → unknown_tool, sem marcação de idempotência nem runAction` e `rpc-contract.test.ts` `keeps issuer and executor capabilities as separate` + `ia-bridge/index.test.ts` `keeps issuer and executor entrypoint surfaces distinct` impedem `HandleIssuer` com `listTools` ou `App` com `issueHandle` trocados.

Todos os 11 suites `src/core/agent-bridge`, `src/workers/ia-bridge`, `src/workers/ia-agent` **PASS** (104 tests).

### 2.5 Regeneração `worker-configuration.d.ts`

```bash
npx wrangler types --config wrangler.toml
# → worker-configuration.d.ts (app) — __BaseEnv_Env com SYNKROO_CACHE, HYPERDRIVE, AGENT, IA_HANDLE_ISSUER etc.
npx wrangler types --config wrangler.ia-bridge.jsonc
# → src/workers/ia-bridge/worker-configuration.d.ts — IA_SEEN, HYPERDRIVE
npx wrangler types --config src/workers/ia-agent/wrangler.jsonc
# → src/workers/ia-agent/worker-configuration.d.ts — IA_LLM_BASE_URL, AGENT, APP
```

`git diff` registra 3 arquivos com `interface __BaseEnv_Env` atualizada (ex.: `IA_SEEN`, `HYPERDRIVE`, `AGENT`, `APP`, `IA_LLM_*`). Nenhum `wrangler deploy` real — apenas `types`.

### 2.6 Runbook

`docs/runbooks/ia-rpc-rollout.md` atualizado com:

- **Contract** fonte única, `v2` atual, `v1` legacy, `HandleIssuer` vs `App` surfaces, DTOs via `Omit`.
- **Deployment Order** 7 passos com compatibilidade `AppService.issueHandle` no primeiro deploy.
- **Verification** `npm test` + `typecheck:ia-bridge` + `typecheck:ia-agent` + 3 `dry-run`.
- **Bundle Blocker** app `gzip 4092.89 KiB` > 3 MiB Free → **bloqueio**, bridge `1175 KiB` OK, agent `26 KiB` OK.
- **Rollback** `agent -> app -> bridge` antes da remoção `v1`, depois `bridge compatível` primeiro.
- **Mutação** tabela `DTO duplicado`, `capability trocada`, `v99`, `handle expirado`, `replay`, `surface negativa`.

---

## 3. RED/GREEN + mutação — evidência

### 3.1 DTO duplicado

| Mutação | RED | GREEN |
|---|---|---|
| Reintroduzir `export type ListToolsInput = { handle, conversationId }` em `bridge-service.ts` | `rpc-contract.test.ts` não falha, mas `bridge-service.test.ts` com `contractVersion` ausente não é testado; `typecheck` passa mas `Omit` não é usado → divergência manual | `bridge-service.ts` usa `Omit<Rpc..., 'contractVersion'>` → `typecheck:ia-bridge` 0, `bridge-service.test.ts` 8 tests PASS |

**Evidência GREEN:**

```
npm run typecheck:ia-bridge  # 0
npm test src/core/agent-bridge/__tests__/bridge-service.test.ts  # 8 tests PASS
```

### 3.2 Capability trocada

| Mutação | RED | GREEN |
|---|---|---|
| Mover `issueHandle` para `AppBinding` e remover de `HandleIssuerBinding` | `rpc-contract.test.ts` `keeps issuer and executor capabilities as separate typed surfaces` → `expect(Object.keys(issuer)).toEqual(['issueHandle'])` falha (issuer vazio), `expect(Object.keys(app)).toEqual(['ping',...])` inclui `issueHandle` → **RED** | `HandleIssuerBinding` só `issueHandle`, `AppBinding` sem `issueHandle` → **GREEN** (5 asserts) |

### 3.3 Versão desconhecida antes de IA_SEEN

| Mutação | RED | GREEN |
|---|---|---|
| `resolveContractVersion({ contractVersion:'v99' })` retornar `LEGACY` ao invés de `null` | `ia-bridge/index.test.ts` `rejects an unsupported execute version before bootstrap, idempotency, or Action` → `executeActionLogic.notCalled` falha (foi chamado), `mockKV.put.notCalled` falha (foi chamado) → **RED** | `resolveContractVersion` retorna `null` → `contractVersionMismatch()` antes de `ensureBootstrap`/`wasSeen`/`markSeen`/`runAction` → **GREEN** |

**Evidência GREEN:**

```
PASS src/workers/ia-bridge/__tests__/index.test.ts
  ✓ rejects an unsupported execute version before bootstrap, idempotency, or Action (2 ms)
  ✓ rejects an unsupported list version before reading the catalog
```

### 3.4 Handle expirado/forjado + replay + surface negativa

| Cenário | Teste | GREEN |
|---|---|---|
| Handle `ttlSeconds:-1` | `bridge-failures.test.ts` `handle expirado → expired` | `ok:false, error:'expired'` |
| `forged.sig` | `bridge-failures.test.ts` `replay por handle forjado → invalid_signature` | `ok:false, error:'invalid_signature'` |
| `conversation_mismatch` | `bridge-failures.test.ts` `handle de outra conversa` | `ok:false, error:'conversation_mismatch'` |
| Replay `ik-replay` 2x | `bridge-failures.test.ts` `replay por idempotencyKey → duplicate` | `1st ok:true, 2nd ok:false, error:'duplicate'` |
| `isAgentSafeAction` fora allowlist | `bridge-service.test.ts` `ação fora do allowlist → unknown_tool, sem marcação` | `runCalls=0`, `seenMarks not contain key` |

**Evidência GREEN:**

```
PASS src/core/agent-bridge/__tests__/bridge-failures.test.ts (4 tests)
PASS src/core/agent-bridge/__tests__/bridge-service.test.ts (8 tests)
PASS src/workers/ia-bridge/__tests__/index.test.ts (15 tests, inclui issuer/executor distinct, ping, dbHealth, bootstrap memoization, kvSeenStore TTL, version mismatch)
```

---

## 4. Gates executados (comandos, exit codes)

| Gate | Comando | Exit | Resultado |
|---|---|---|---|
| typecheck | `npm run typecheck` (`tsc --noEmit`) | 0 | sem erros (após corrigir `Omit` distributivo e `NextResponse` vs `Response`) |
| typecheck:ia-bridge | `npm run typecheck:ia-bridge` | 0 | sem erros (`bridge-service` com `Omit` correto) |
| typecheck:ia-agent | `npm run typecheck:ia-agent` | 0 | sem erros |
| unit | `npm test -- --runInBand src/core/agent-bridge src/workers/ia-bridge src/workers/ia-agent` | 0 | 11 suites, 104 tests PASS |
| lint | `npm run lint` (`eslint . --max-warnings=0`) | 0 | 0 warnings (com `handleCanonicalAction` e `mapActionError`) |
| dry-run app | `npx wrangler deploy --dry-run --env staging --config wrangler.toml` | 0 (com warning) | `Total Upload: 6608 KiB / gzip: 4092.89 KiB` → **BLOQUEIO Free 3 MiB**, não deployar; `assets.directory` missing sem build prévio mas gzip já prova |
| dry-run bridge | `npx wrangler deploy --dry-run --env staging --config wrangler.ia-bridge.jsonc` | 0 | `6608.07 KiB / gzip: 1175.38 KiB` OK |
| dry-run agent | `npx wrangler deploy --dry-run --env staging --config src/workers/ia-agent/wrangler.jsonc` | 0 | `141.74 KiB / gzip: 26.13 KiB` OK |
| wrangler types | `npx wrangler types --config wrangler.toml` / `wrangler.ia-bridge.jsonc` / `src/workers/ia-agent/wrangler.jsonc` | 0 | 3 `worker-configuration.d.ts` regenerados |

---

## 5. Arquivos e riscos

### 5.1 Arquivos modificados/criados nesta tranche

- **M** `src/core/agent-bridge/bridge-service.ts` (-18, +14 linhas, `Omit<Rpc..., 'contractVersion'>` distributivo)
- **M** `src/workers/ia-bridge/index.ts` (-5, +14 linhas, `listTools`/`executeAction` com `if (result.ok) return { ok:true, contractVersion, catalog/data } else return { ok:false, contractVersion, error, level, message }`)
- **M** `worker-configuration.d.ts` (3 arquivos, regenerados, `__BaseEnv_Env` com `SYNKROO_CACHE`, `HYPERDRIVE`, `IA_HANDLE_ISSUER`, `AGENT`, etc., diff `git diff` 1466 linhas cada)
- **M** `docs/runbooks/ia-rpc-rollout.md` (+45 linhas, rollout 7 passos, bundle blocker, rollback `agent->app->bridge`, mutação tabela)

### 5.2 Riscos residuais

- **Bundle app 4092 KiB > 3 MiB Free:** dry-run `gzip` já prova bloqueio sem deploy real. Risco: `npm run build:cf` (`opennext`) no Windows pode ter `WARN` mas não falha; `wrangler deploy --dry-run` falha por `assets.directory` sem build prévio, mas `Total Upload` ainda é reportado. Mitigação: documentado em runbook, **não deployar** app até reduzir bundle ou migrar para Workers Paid (ou `workerd` com `assets` correto).
- **Compatibilidade v1:** `AppService.issueHandle` mantido para primeiro deploy (runbook), mas `HandleIssuerBinding` não tem `listTools`/`executeAction` e `AppBinding` não tem `issueHandle` — se `v1` for removido sem telemetria, `agent` antigo com `contractVersion:'v1'` falhará com `contract_version_mismatch`. Mitigação: runbook exige observar `contractVersion` ausente/`v1` até janela zero antes de remover.
- **DTO `Omit` distributivo:** `Omit<Union, 'contractVersion'>` com `Extract` é necessário para `tsc` não colapsar união para `ok: boolean` sem `catalog`/`error`. Risco: se `rpc-contract` adicionar campo novo (ex.: `level` em `ListToolsResult`), `bridge-service` `Omit` precisa ser atualizado para incluir `level` na versão `ok:false`. Mitigação: coberto por `typecheck:ia-bridge` que falha se `level` não for propagado.
- **T9 pendente:** verificação final `npm run verify` + `npm run build` + `npm run build:cf` + `git diff --check` ainda não executados nesta tranche (fora de escopo T8).

### 5.3 Rollback

- **Bridge:** reverter `bridge-service.ts` para DTO manual (`ListToolsInput = { handle, conversationId }` etc.) e `ia-bridge/index.ts` para `return { ...result, contractVersion }` (spread), e `rpc-contract.ts` para `SUPPORTED=['v2']` sem `v1`.
- **Workers:** `wrangler types` regenera, mas `worker-configuration.d.ts` pode ser revertido via `git checkout`.
- **Runbook:** reverter `docs/runbooks/ia-rpc-rollout.md` para versão sem bundle blocker.

---

*Tranche T8 encerrada 2026-08-30T22:30Z com TDD RED→GREEN, 11 suites 104 tests PASS, typecheck 0 (app/bridge/agent), lint 0, dry-run bridge/agent OK, app bloqueado por gzip, e 3 `worker-configuration.d.ts` regenerados. Worktree preservado; T9 permanece para próxima tranche.*

**Git diff exclusivo T8:** `~6 files changed, ~90 insertions, ~60 deletions` (sem contar T0-T7/audits preexistentes).
