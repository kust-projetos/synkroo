# F11.08 — Structured JSON logs and redaction

Production logger now emits one JSON object per line with timestamp, level, service, message and optional request/correlation IDs. Context is recursively redacted for password/token/secret/authorization/cookie/database URL keys. Development output remains human-readable.

| Verificação | Resultado |
|---|---|
| `npx jest src/lib/__tests__/logger.test.ts --runInBand` | PASS |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint nos arquivos alterados | PASS |
| `git diff --check` | PASS |
