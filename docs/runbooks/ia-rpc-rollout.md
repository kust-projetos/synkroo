# IA RPC Rollout (T8 — 2026-08-30)

## Contract (fonte única: `src/core/agent-bridge/rpc-contract.ts`)

- `v2` (`BRIDGE_RPC_VERSION`) é o contrato atual; `v1` (`LEGACY_BRIDGE_RPC_VERSION`) é compatibilidade temporária.
- Request sem `contractVersion` → tratado como `v1` apenas (legacy). Request com `contractVersion` desconhecido → `contract_version_mismatch` **antes** de `IA_SEEN`, `idempotency` ou `Action`.
- `HandleIssuerBinding` = `{ issueHandle }` apenas. `AppBinding` = `{ ping, dbHealth, listTools, executeAction }` sem `issueHandle`. DTOs de `bridge-service.ts` são `Omit<..., 'contractVersion'>` de `rpc-contract`.
- `SUPPORTED_BRIDGE_RPC_VERSIONS = ['v1','v2']`.

## Deployment Order (com compatibilidade v1)

1. **Bridge** com ambos entrypoints (`HandleIssuerService` + `AppService` com `issueHandle` compatível) + `SUPPORTED=['v1','v2']`.
2. **Regenerar tipos:** `npx wrangler types --config wrangler.toml` (app), `wrangler.ia-bridge.jsonc` (bridge), `src/workers/ia-agent/wrangler.jsonc` (agent) — registrar diff dos 3 `worker-configuration.d.ts`.
3. **Dry-runs:** `npx wrangler deploy --dry-run --env staging --config wrangler.toml` (app, gzip 4092 KiB → **bloqueio Free 3 MiB**, não deployar), `--config wrangler.ia-bridge.jsonc` (bridge, gzip 1175 KiB OK), `--config src/workers/ia-agent/wrangler.jsonc` (agent, gzip 26 KiB OK). App binding deve ser `IA_HANDLE_ISSUER` com `HandleIssuerService`.
4. **App** + smoke `app -> issuer -> agent -> executor` (ping `v2` por turno).
5. **Agent** — cada turno faz `ping({ contractVersion:'v2' })` antes de `listTools`/`executeAction`.
6. Observar `contractVersion` ausente (`v1`) e `v1` explícito até janela zero.
7. **Remoção posterior (release separado, após telemetria):** remover `AppService.issueHandle` e caminho `v1` (`resolveContractVersion` sem fallback), rodar testes de superfície negativa.

## Verification

```bash
npm test -- --runInBand src/core/agent-bridge src/workers/ia-bridge src/workers/ia-agent
# 11 suites, 104 tests PASS (inclui rpc-contract, bridge-service, handle, ping, dbHealth, issuer/executor distinct, bootstrap, deps, version mismatch, idempotency, etc.)
npm run typecheck:ia-bridge  # tsc --noEmit --project tsconfig.ia-bridge.json (0)
npm run typecheck:ia-agent   # tsc --noEmit --project tsconfig.ia-agent.json (0)
npx wrangler deploy --dry-run --env staging --config wrangler.toml          # app: gzip 4092 KiB → BLOQUEIO (3 MiB Free)
npx wrangler deploy --dry-run --env staging --config wrangler.ia-bridge.jsonc # bridge: 1175 KiB OK
npx wrangler deploy --dry-run --env staging --config src/workers/ia-agent/wrangler.jsonc # agent: 26 KiB OK
```

Smoke deve cobrir: `ping` por turno, versão desconhecida antes de `IA_SEEN`, issuer indisponível, handle expirado/forjado, replay `idempotencyKey`, e superfície negativa (binding trocado).

## Bundle Blocker (2026-08-30)

- **App:** `Total Upload: 6608 KiB / gzip: 4092.89 KiB` (via `npm run build` + `opennext` + `inject-pg-global`) → **excede Workers Free 3 MiB**, deploy real bloqueado. Dry-run registra `assets.directory` missing sem build prévio, mas gzip já prova bloqueio. **Ação:** não deployar app; decidir redução de bundle ou plano Workers pago antes de T9.
- **Bridge:** `1175.38 KiB` OK
- **Agent:** `26.13 KiB` OK

## Rollback

- **Antes da remoção v1:** `agent -> app -> bridge` (ordem inversa do deploy). Bridge com `v1` ainda aceita app/agent antigos.
- **Após remoção v1:** redeployar bridge compatível (`SUPPORTED=['v1','v2']` + `AppService.issueHandle`) **antes** de voltar app/agent antigos com `v1`. Não testar bridge `binding-only` via URL pública (404).
- **Bundle:** se app não puder ser deployado por limite, manter bridge/agent já deployados (são independentes) e resolver bundle antes de T9 `build:cf`.

## Testes de Mutação (RED→GREEN)

- **DTO duplicado:** reintroduzir `export type ListToolsInput = { handle, conversationId }` em `bridge-service.ts` → `rpc-contract.test.ts` `keeps issuer and executor capabilities as separate typed surfaces` falha (`Object.keys(app)` inclui `issueHandle` se AppBinding tiver `issueHandle`), e `bridge-service.test.ts` não usa `contractVersion` → **RED**, remover → **GREEN**.
- **Capability trocada:** mover `issueHandle` para `AppBinding` e remover de `HandleIssuerBinding` → `rpc-contract.test.ts` `Object.keys(issuer)==['issueHandle']` e `Object.keys(app)==['ping',...]` falham → **RED**.
- **Versão desconhecida antes de IA_SEEN:** `resolveContractVersion({ contractVersion:'v99' })` deve retornar `null` e `executeAction` com `v99` deve retornar `contract_version_mismatch` sem tocar `IA_SEEN` (`mockKV.put` not called) → `ia-bridge/index.test.ts` `rejects an unsupported execute version before bootstrap, idempotency, or Action` falha se `resolveContractVersion` tratar `v99` como `v1` → **RED**.
- **Handle expirado/forjado:** `issueHandle(..., ttlSeconds:-1)` → `expired`, `forged.sig` → `invalid_signature` — `bridge-failures.test.ts` cobre.
- **Replay:** mesma `idempotencyKey` → `duplicate` — `bridge-service.test.ts` e `bridge-failures.test.ts` cobrem.
- **Surface negativa:** `HandleIssuerService` não deve ter `listTools`/`executeAction` e `AppService` não deve expor `HandleIssuerBinding` — `ia-bridge/index.test.ts` `keeps issuer and executor entrypoint surfaces distinct` cobre.

## Evidências T8 (2026-08-30)

- `src/core/agent-bridge/bridge-service.ts` — DTOs agora `Omit<Rpc..., 'contractVersion'>` de `rpc-contract` (2 tipos).
- `src/core/agent-bridge/rpc-contract.ts` — fonte única `v1`/`v2`, `HandleIssuerBinding` só `issueHandle`, `AppBinding` sem `issueHandle`.
- `src/workers/ia-bridge/index.ts` — `HandleIssuerService` só `issueHandle`, `AppService` com `ping/dbHealth/listTools/executeAction` + `issueHandle` compatível (primeiro deploy).
- `worker-configuration.d.ts` (3 arquivos) regenerados via `wrangler types` (app, bridge, agent) — diff registrado em `git diff` (tipos `__BaseEnv_Env` etc.).
- `docs/runbooks/ia-rpc-rollout.md` atualizado com rollout/rollback/bloqueio bundle.
- **Gates:** `npm test` 11 suites 104 tests PASS, `typecheck:ia-bridge` 0, `typecheck:ia-agent` 0, `dry-run` bridge/agent OK, app bloqueado por gzip.

