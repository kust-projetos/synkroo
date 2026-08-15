# F2.12 — Audit payload allowlist e redaction nested

`allowlistInput` continua exigindo allowlist top-level e agora percorre objetos/arrays aninhados, removendo chaves PII/sensíveis (`email`, `cpf`, `phone`, `name`, `patient`, secrets/tokens, dados clínicos e endereço).

| Verificação | Resultado |
|---|---|
| `npx jest src/core/actions/__tests__/audit-writer.test.ts --runInBand` | PASS — 8 testes |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint nos arquivos alterados | PASS |
| `git diff --check` | PASS |
