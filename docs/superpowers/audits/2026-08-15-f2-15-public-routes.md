# F2.15 — Allowlist pública exata

- Removido prefixo público amplo `/api/auth/`.
- Mantidos endpoints Auth.js explícitos e somente `/api/auth/callback/*` como prefixo dinâmico necessário.
- Signup é explicitamente público fora de production, mas o middleware retorna 404 em production (F2.02).
- Webhook financeiro público apenas em `/api/financeiro/webhooks/asaas`; provider desconhecido não entra na allowlist.
- Prefixo `/api/whatsapp/evolution/` foi removido; a rota exata permanece explícita.

| Verificação | Resultado |
|---|---|
| Matriz middleware | PASS — 9 testes |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint nos arquivos alterados | PASS |
| `git diff --check` | PASS |
