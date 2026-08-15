# F2.18 — Agent permissions fail-closed

- Runtime lookup em `src/core/rbac/agent-access.ts` agora retorna somente permissões persistidas.
- `DEFAULT_AGENT_PERMISSIONS` permanece disponível para seed explícito, mas não é fallback de autorização em runtime.

| Verificação | Resultado |
|---|---|
| Testes agent-access + seed | PASS — 11 testes |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint nos arquivos alterados | PASS |
| `git diff --check` | PASS |

Nota: a suíte ESLint global excedeu o limite de tempo nesta sessão; a verificação direcionada passou.
