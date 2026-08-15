# F11.15 — Security headers

CSP foi promovido de `Content-Security-Policy-Report-Only` para `Content-Security-Policy`. HSTS continua condicional à production; nosniff, X-Frame-Options, Referrer-Policy e Permissions-Policy permanecem ativos.

| Verificação | Resultado |
|---|---|
| `npx jest src/__tests__/security/headers.test.ts --runInBand` | PASS |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint em config/teste | PASS |
| `git diff --check` | PASS |
