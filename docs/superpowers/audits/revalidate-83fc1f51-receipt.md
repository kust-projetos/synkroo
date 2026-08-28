# Receipt de Revalidação do Baseline Local Synkroo (83fc1f51)

- **Data/Hora:** 2026-08-27T12:20:00Z
- **Commit SHA:** `83fc1f519b58506887f5529f45b613bbab67cab1`
- **Operador/Agente:** CODER AGY (Antigravity CLI v1.1.22)
- **Status Geral:** ✅ **APROVADO / VERIFIED** (Todos os 10 gates concluídos com código de saída 0)

---

## 1. Sumário Executivo de Validação

| Gate | Comando | Resultado | Status |
|---|---|---|---|
| **1. Roadmap Ledger Check** | `node scripts/roadmap-ledger.mjs --check` | 143 records, 126 VERIFIED, 14 EXTERNAL, 3 DEFERRED | ✅ PASS (Exit 0) |
| **2. ESLint** | `npm run lint` | 0 warnings, 0 errors (`--max-warnings=0`) | ✅ PASS (Exit 0) |
| **3. Typecheck App** | `npm run typecheck` | 0 errors (`tsc --noEmit`) | ✅ PASS (Exit 0) |
| **4. Typecheck Workers** | `npm run typecheck:ia-bridge` & `typecheck:ia-agent` | 0 errors nos dois tsconfigs | ✅ PASS (Exit 0) |
| **5. Release Contracts** | `npm run test:release` | 13/13 testes aprovados | ✅ PASS (Exit 0) |
| **6. Unit/Coverage Test Suite** | `npm test -- --runInBand --coverage` | 286/286 suites, 2068 testes OK, thresholds de cobertura cumpridos | ✅ PASS (Exit 0) |
| **7. Isolated Integration Suite** | `npm run test:integration:run` | 39/39 suites, 226 testes OK, 0 skips | ✅ PASS (Exit 0) |
| **8. Cloudflare OpenNext Build** | `npm run build:cf` | 123 rotas geradas, worker.js + pg injection OK | ✅ PASS (Exit 0) |
| **9. Wrangler Dry-Run App** | `npx wrangler deploy --dry-run` | Bindings Hyperdrive, KV, DOs e Assets validados | ✅ PASS (Exit 0) |
| **10. Wrangler Dry-Run Workers** | `npx wrangler deploy -c wrangler.ia-bridge.jsonc --dry-run` e `ia-agent` | Bindings validados sem erros | ✅ PASS (Exit 0) |

---

## 2. Evidências Detalhadas dos Comandos

### Gate 1: Roadmap Ledger Check
```
> node scripts/roadmap-ledger.mjs --check
records=143 unique=143
DEFERRED=3
EXTERNAL=14
VERIFIED=126
```

### Gate 2: ESLint
```
> synkroo@0.1.0 lint
> eslint . --max-warnings=0
(Exit Code: 0)
```

### Gate 3: TypeScript Typecheck (App)
```
> synkroo@0.1.0 typecheck
> tsc --noEmit
(Exit Code: 0)
```

### Gate 4: TypeScript Typecheck (Workers)
```
> synkroo@0.1.0 typecheck:ia-bridge
> tsc --noEmit --project src/workers/ia-bridge/tsconfig.json

> synkroo@0.1.0 typecheck:ia-agent
> tsc --noEmit --project src/workers/ia-agent/tsconfig.json
(Exit Code: 0)
```

### Gate 5: Release Contracts
```
> synkroo@0.1.0 test:release
> node --test scripts/__tests__/cli-entrypoint.test.mjs scripts/__tests__/inject-pg-global.test.mjs scripts/__tests__/seed-test-clinic.test.mjs scripts/__tests__/smoke-staging.test.mjs scripts/__tests__/verify-remediation-schema.test.mjs scripts/__tests__/ignore-client-abort.test.mjs

✔ smoke runner recognizes Windows and POSIX module paths (0.8445ms)
✔ schema verifier recognizes Windows and POSIX module paths (0.1911ms)
✔ recognizes only the expected Next.js client disconnect (1.2709ms)
✔ keeps the generated pg injection marker ASCII-safe for Wrangler startup analysis (180.6528ms)
✔ E2E seed provisions the clinic and credentials expected by global setup (0.7927ms)
✔ redacts credentials and patient identifiers (1.4222ms)
✔ runs the complete privacy-safe staging contract with authenticated checks (42.3329ms)
✔ serializes staging checks to avoid cold-start database races (76.6822ms)
✔ blocks authenticated staging checks when synthetic credentials are absent (1.8793ms)
✔ requires remediation columns and tenant-scoped unique keys (1.0252ms)
✔ rejects a schema without the outbox tenant idempotency key (0.5882ms)
✔ message event migration preflights duplicates and is replay-safe (187.3676ms)
✔ lead phone migration is replay-safe (131.9928ms)
ℹ tests 13 | pass 13 | fail 0 | cancelled 0 | skipped 0
```

### Gate 6: Jest Unit & Coverage Suite
```
Test Suites: 286 passed, 286 total
Tests:       5 skipped, 2068 passed, 2073 total
Snapshots:   0 total
Time:        552.654 s
Coverage Threshold: All global thresholds met (Lines >= 70%, Statements >= 70%, Functions >= 65%, Branches >= 55%).
(Exit Code: 0)
```

### Gate 7: Isolated Integration Pipeline
```
> synkroo@0.1.0 test:integration:run
> node scripts/integration-run.mjs
> drizzle-kit migrate: [✓] migrations applied successfully!
seed-test-clinic: deterministic clinic and credentials ready

Test Suites: 39 passed, 39 total
Tests:       226 passed, 226 total
Snapshots:   0 total
Time:        75.669 s
(Exit Code: 0)
```

### Gate 8: Cloudflare OpenNext Production Build
```
> synkroo@0.1.0 build:cf
> opennextjs-cloudflare build && node scripts/inject-pg-global.mjs

App directory: D:\projetos\synkroo
Next.js version : 15.5.22
@opennextjs/cloudflare version: 1.20.2
@opennextjs/aws version: 4.1.0
workerd compatibility_date: 2026-06-23

✓ Compiled successfully in 80s
✓ Generating static pages (123/123)
Worker saved in .open-next\worker.js
[inject-pg-global] pg and Hyperdrive runtime globals ensured in D:\projetos\synkroo\.open-next\worker.js
(Exit Code: 0)
```

### Gate 9 & 10: 3x Wrangler Deploy Dry-Run

1. **App Worker (`synkroo` via OpenNext)**:
   - Command: `npx wrangler deploy --dry-run`
   - Assets: 476 files (Total Upload: 23319.16 KiB / gzip: 4020.06 KiB)
   - Bindings: `AGENT` (Durable Object), `NEXT_CACHE_DO_QUEUE` (Durable Object), `SYNKROO_CACHE` (KV), `HYPERDRIVE` (Hyperdrive Config), `IA_BRIDGE` (Worker Service), `WORKER_SELF_REFERENCE`, `ASSETS`.
   - Result: Exit Code 0.

2. **IA Bridge Worker (`synkroo-ia-bridge`)**:
   - Command: `npx wrangler deploy --config wrangler.ia-bridge.jsonc --dry-run`
   - Bindings: `IA_SEEN` (KV), `HYPERDRIVE` (Hyperdrive Config).
   - Result: Exit Code 0.

3. **IA Agent Worker (`synkroo-ia-agent`)**:
   - Command: `npx wrangler deploy --config src/workers/ia-agent/wrangler.jsonc --dry-run`
   - Bindings: `AGENT` (Durable Object), `APP` (Worker Service).
   - Result: Exit Code 0.

---

## 3. Avaliação de Riscos & Sanitização

- **Segurança de Segredos:** Nenhuma variável confidencial, chave de API ou credencial foi impressa ou exportada neste receipt.
- **Isolamento de Banco:** Os testes de integração rodaram exclusivamente contra banco de teste dedicado (`synkroo_test`), sem impacto em banco de produção ou staging.
- **Compatibilidade Cloudflare:** Os bundles OpenNext e workers auxiliares compilaram sem erros impeditivos de tipo, empacotamento ou dependências.
