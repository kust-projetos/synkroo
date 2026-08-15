# F3.14 — `npm run verify`

## Implementação

- `package.json` expõe `npm run verify`.
- `scripts/verify.mjs` executa fail-fast: lint, app typecheck, bridge typecheck, agent typecheck, cobertura unitária e contratos de release.
- `scripts/__tests__/verify.test.mjs` verifica ordem e parada na primeira falha sem executar comandos reais.

## Evidência

| Verificação | Resultado |
|---|---|
| `node --test scripts/__tests__/verify.test.mjs` | PASS — 2 testes |
| `npm run verify` | PARTIAL — lint/typechecks e 236 suites (1.578 testes) passaram; cobertura falhou nos thresholds globais existentes: statements 53,43%, branches 38,31%, lines 54,6%, functions 41,63% |

O runner está operacional e falha corretamente no gate de cobertura. O threshold de 70% permanece um residual aberto do roadmap, não é mascarado pelo comando.
