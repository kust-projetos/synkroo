# F3.14 — `npm run verify`

## Implementação

- `package.json` expõe `npm run verify`.
- `scripts/verify.mjs` executa fail-fast: lint, app typecheck, bridge typecheck, agent typecheck, cobertura unitária e contratos de release.
- `scripts/__tests__/verify.test.mjs` verifica ordem e parada na primeira falha sem executar comandos reais.

## Evidência

| Verificação | Resultado |
|---|---|
| `node --test scripts/__tests__/verify.test.mjs` | PASS — 2 testes |
| `npm run verify` | PARTIAL — lint/typechecks e 240 suites (1.595 testes) passaram; cobertura falhou nos thresholds globais existentes: statements 53,5%, branches 38,47%, lines 54,66%, functions 41,92% |

O runner está operacional e falha corretamente no gate de cobertura. O threshold de 70% permanece um residual aberto do roadmap, não é mascarado pelo comando.

## 2026-08-15 global coverage follow-up

- Full Jest baseline: `npm test -- --coverage --runInBand` — 241 suites passed, 1,597 passed / 5 skipped tests; statements 53.45%, branches 38.45%, lines 54.62%, functions 41.87%; exit 1 because all global thresholds are 70%.
- Focused worker gap: `npm test -- --coverage --runInBand src/core/agent-bridge src/workers/ia-bridge` — 8 suites and 81 tests passed, but `src/workers/ia-bridge/index.ts` remained 0% and global coverage was statements 14.51%, branches 0.91%, lines 15.50%, functions 2.44%.
- No threshold or coverage exclusion was changed. F3.14 remains `PARTIAL`.

## 2026-08-15 validation coverage follow-up

- Added `src/lib/__tests__/validation.test.ts`; focused `validation.ts` coverage: 93.57% statements, 92.78% branches, 100% functions, 96.96% lines.
- Fresh global Jest: `node_modules/.bin/jest --coverage --runInBand` — 243 suites passed, 1,607 passed / 5 skipped tests; statements 54.24%, branches 40.04%, lines 55.42%, functions 42.37%; exit 1 at the unchanged 70% thresholds.
- Delta from prior baseline: +0.79 statements, +1.59 branches, +0.80 lines, +0.50 functions. F3.14 remains `PARTIAL`.

## 2026-08-15 treatment-plan coverage follow-up

- Added `src/services/treatment-plans/__tests__/treatment-plan.service.test.ts`; focused service coverage: 100% statements, 96% branches, 100% functions, 100% lines.
- Fresh global Jest: `node_modules/.bin/jest --coverage --runInBand` — 244 suites passed, 1,615 passed / 5 skipped tests; statements 54.84%, branches 40.45%, lines 56.06%, functions 42.96%; exit 1 at unchanged 70% thresholds.
- Delta from validation baseline: +0.60 statements, +0.41 branches, +0.64 lines, +0.59 functions. F3.14 remains `PARTIAL`.

## Wave 0 reconciliation — 2026-08-20

- Cluster A repository mutation receipt is separate from the global verify gate: Stryker covered 124 repository mutants, with 87 killed, 36 survived and 1 no-coverage; computed score 70.16% against break threshold 70. This supports F2.19, not global F3.14 coverage.
- Focused additions for validation and treatment plans are green and improve local coverage, but the latest recorded global baseline remains statements 54.84%, branches 40.45%, lines 56.06% and functions 42.96%, below the unchanged 70% thresholds.
- The full integration runner also has a separate known environmental failure: 34 suites/188 tests passed while 14 tests timed out in 10-second hooks; this does not count as a global verify pass.
- Classification remains `PARTIAL`; no threshold, exclusion, skip or retry policy was weakened.
