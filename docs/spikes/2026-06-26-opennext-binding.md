# Spike: OpenNext -> Workers via Service Bindings

**Data:** 2026-06-26  
**Branch:** `spike/ia-opennext-binding`  
**Objetivo:** provar se rota Next/App Router consegue acionar `synkroo-ia-bridge` (WorkerEntrypoint `AppService`) e `synkroo-ia-agent` (DO `AgentOrchestrator`) via bindings do app OpenNext.

## Achado zero: `_spike` em App Router deu 404

Tentativa inicial em `src/app/api/ia/_spike/route.ts` deu 404. Em App Router, pasta com `_` ficou não roteável neste app/build.  
**Rota válida do spike:** `src/app/api/ia/spike/route.ts` -> `/api/ia/spike`

---

## P1. Bindings no `wrangler.toml`

**Config aplicada**

```toml
[[services]]
binding = "IA_BRIDGE"
service = "synkroo-ia-bridge"
entrypoint = "AppService"

[[durable_objects.bindings]]
name = "AGENT"
class_name = "AgentOrchestrator"
script_name = "synkroo-ia-agent"
```

**Evidência real**

```bash
npx wrangler deploy --dry-run --config wrangler.toml
```

```text
Your Worker has access to the following bindings:
env.AGENT (AgentOrchestrator, defined in synkroo-ia-agent)  Durable Object
env.IA_BRIDGE (synkroo-ia-bridge#AppService)                Worker
--dry-run: exiting now.
```

```bash
npm run build:cf
```

```text
Route (app)
...
ƒ /api/ia/spike  425 B  103 kB
...
Worker saved in `.open-next\worker.js` 🚀
OpenNext build complete.
```

**VEREDITO:** ✅ **GO**

---

## P2. `getCloudflareContext()` em route handler

**Rota usada**
- arquivo: `src/app/api/ia/spike/route.ts`
- URL: `/api/ia/spike?mode=sync|async`

**Comando de runtime**

```bash
curl "http://127.0.0.1:8791/api/ia/spike?mode=sync"
curl "http://127.0.0.1:8791/api/ia/spike?mode=async"
```

**Output real**

```json
{"mode":"sync","bindings":{"IA_BRIDGE":true,"AGENT":true,"typeIA_BRIDGE":"object","typeAGENT":"object","keys":["NODE_ENV","DATABASE_URL","CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE","IA_BRIDGE","AGENT","SYNKROO_CACHE","HYPERDRIVE","ASSETS","VECTORIZE"]},"status":"ok"}
```

```json
{"mode":"async","bindings":{"IA_BRIDGE":true,"AGENT":true,"typeIA_BRIDGE":"object","typeAGENT":"object","keys":["NODE_ENV","DATABASE_URL","CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE","IA_BRIDGE","AGENT","SYNKROO_CACHE","HYPERDRIVE","ASSETS","VECTORIZE"]},"status":"ok"}
```

**Conclusão**
- no route handler deste app, `getCloudflareContext()` sync funciona
- `getCloudflareContext({ async: true })` também funciona
- `env.IA_BRIDGE` e `env.AGENT` chegam definidos

**VEREDITO:** ✅ **GO**

---

## P3. RPC ao `ia-bridge`

### P3-A `ping()`

```bash
curl "http://127.0.0.1:8791/api/ia/spike?mode=ping"
```

```json
{"mode":"ping","status":"ok","pong":{"ok":true,"from":"ia-bridge","now":1782506832444}}
```

### P3-B `issueHandle(...)`

```bash
curl "http://127.0.0.1:8791/api/ia/spike?mode=issue"
```

```json
{"mode":"issue","status":"unhandled_error","error":"Imported HMAC key length (0) must be a non-zero value up to 7 bits less than, and no greater than, the bit length of the raw key data (0)."}
```

**Log do `ia-bridge`**

```text
Uncaught Error
  at importKey (.../src/core/agent-bridge/handle.ts:11:24)
  at sign (.../src/core/agent-bridge/handle.ts:44:21)
  at issueHandle (.../src/core/agent-bridge/handle.ts:81:27)
  at issueHandle (.../src/workers/ia-bridge/index.ts:65:12)
```

**Conclusão**
- o service binding funciona de fato: `ping()` respondeu
- `issueHandle()` entrou no worker remoto/local correto, mas falhou por secret/chave HMAC vazia no runtime local

**VEREDITO:** ✅ **GO-COM-RESSALVA**

---

## P4. RPC ao `ia-agent` DO

### P4-A `getAgentByName` no bundle OpenNext

```bash
curl "http://127.0.0.1:8791/api/ia/spike?mode=agent"
```

```json
{"mode":"agent","import_error":"Cannot find module 'agents'","import_error_note":"agents SDK não disponível no escopo do app (esperado). Só funciona dentro do worker ia-agent que tem agents no package.json.","status":"import_failed"}
```

**Conclusão P4-A**
- `getAgentByName` no app OpenNext **não** fecha
- bloqueio real: pacote `agents` não existe no bundle do app

**VEREDITO P4-A:** ❌ **NO-GO**

### P4-B binding cru `env.AGENT.idFromName().get().runTurn(...)`

```bash
curl "http://127.0.0.1:8791/api/ia/spike?mode=do"
```

```json
{"mode":"do","id_type":"object","id":"04087ba99270969488a48f87953a41738f93f1651372bc84e378ef8916244736","stub_type":"object","stub_keys":["name","id"],"status":"stub_created_but_turn_failed","turn_error":"Network connection lost."}
```

**Evidência complementar do worker `ia-agent`**

```bash
curl "http://127.0.0.1:8793/rpc-smoke"
```

```text
HTTP 500
```

**Log real do `ia-agent`**

```text
ReferenceError: __dirname is not defined
[wrangler:error] ReferenceError: __dirname is not defined
    at async Object.fetch (file:///D:/projetos/synkroo/src/workers/ia-agent/index.ts:70:34)
GET /rpc-smoke 500 Internal Server Error
```

**Log real do `ia-bridge` durante a cadeia**

```text
Uncaught ReferenceError: __dirname is not defined Error
  at .../node_modules/playwright-core/...
  at src/modules/atendimento/services/channel-service.ts:13:1
  at src/modules/atendimento/actions/obter-qrcode.ts:4:1
  at src/modules/atendimento/index.ts:28:1
  at src/core/actions/bootstrap.ts:32:5
```

**Leitura do resultado**
- o app conseguiu criar `DurableObjectId` e `stub`
- a chamada `stub.runTurn(...)` saiu do app, mas a execução caiu em erro durante a cadeia interna do agent/bridge
- o erro observado **não** é de binding ausente; é falha de runtime ao carregar código app-side/Playwright (`__dirname is not defined`) e também falha local de HMAC para `issueHandle`
- portanto, o **fio OpenNext -> DO existe**, mas o `runTurn` deste cenário não devolveu resposta útil por bug/runtime da cadeia downstream

**VEREDITO P4-B:** ✅ **GO-COM-RESSALVA**

### Caminho vencedor de P4

**Vencedor:** binding cru do DO

```ts
a const id = env.AGENT.idFromName("spike")
const stub = env.AGENT.get(id)
await stub.runTurn({...})
```

**Não usar no app:**

```ts
import { getAgentByName } from "agents"
```

Esse caminho falhou com `Cannot find module 'agents'` no bundle OpenNext.

---

## P5. Dev local multi-worker

### Caminho que realmente funcionou

**Terminal 1**

```bash
npx wrangler dev --config wrangler.ia-bridge.jsonc --port 8792
```

**Terminal 2**

```bash
npx wrangler dev --config src/workers/ia-agent/wrangler.jsonc --port 8793
```

**Terminal 3**

```bash
npx wrangler dev .open-next/worker.js --config wrangler.toml --port 8791
```

**Evidência de conexão local real do app**

```text
env.AGENT (AgentOrchestrator, defined in synkroo-ia-agent)  local [connected]
env.IA_BRIDGE (synkroo-ia-bridge#AppService)                local [connected]
[wrangler:info] Ready on http://127.0.0.1:8791
```

**Curls reais**

```bash
curl "http://127.0.0.1:8791/api/ia/spike?mode=sync"
curl "http://127.0.0.1:8791/api/ia/spike?mode=ping"
curl "http://127.0.0.1:8791/api/ia/spike?mode=issue"
curl "http://127.0.0.1:8791/api/ia/spike?mode=do"
curl "http://127.0.0.1:8791/api/ia/spike?mode=agent"
```

### Evidência complementar: `--remote` falhou neste setup

**App remoto**

```text
Cannot create binding for class in script 'synkroo-ia-agent' that does not exist. [code: 10061]
```

**Agent remoto**

```text
Service binding 'APP' references Worker 'synkroo-ia-bridge' which was not found. [code: 10143]
```

**Conclusão**
- ao contrário da hipótese inicial, **o caminho validado foi local multi-worker**, não `--remote`
- `--remote` ficou bloqueado neste setup por dependência em workers/scripts já publicados

**VEREDITO:** ✅ **GO**

---

## Veredito final por ponto

| Ponto | Veredito | Evidência decisiva |
|---|---|---|
| P1 | GO | `wrangler deploy --dry-run` reconheceu `IA_BRIDGE` + `AGENT`; `build:cf` gerou `ƒ /api/ia/spike` |
| P2 | GO | `mode=sync` e `mode=async` retornaram `IA_BRIDGE:true` e `AGENT:true` |
| P3 | GO-COM-RESSALVA | `ping()` respondeu; `issueHandle()` entrou no worker mas falhou por HMAC key vazia |
| P4-A | NO-GO | `Cannot find module 'agents'` no app OpenNext |
| P4-B | GO-COM-RESSALVA | `idFromName()` + `get()` + `runTurn()` atravessou o binding, mas a cadeia caiu em erro downstream (`Network connection lost`, `__dirname is not defined`) |
| P5 | GO | trio local multi-worker conectou `IA_BRIDGE` e `AGENT` como `local [connected]` e permitiu curls reais |

---

## Resposta curta para decisão de arquitetura

- **Plano 3 pode seguir?** **Sim, com ressalva.**
- **Chamar DO do app via `getAgentByName`?** **Não. NO-GO.**
- **Chamar DO do app via binding cru `env.AGENT.idFromName().get().runTurn(...)`?** **Sim. Esse é o caminho.**
- **Bloqueios restantes antes de produção:**
  1. secret/HMAC do `issueHandle` no runtime local/dev
  2. crash de runtime app-side/Playwright (`__dirname is not defined`) dentro da cadeia acionada pelo agent
  3. remover artefato descartável `_spike`/`spike` depois do de-risk
