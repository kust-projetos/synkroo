# F11.07 — Liveness/readiness

- `/api/health` é público e retorna status operacional sem autenticação.
- `/api/internal/readiness` exige sessão e retorna resposta privacy-safe para sessão autenticada.

| Verificação | Resultado |
|---|---|
| health route tests | PASS — 4 testes |
| readiness route tests | PASS — 2 testes |
| Total | PASS — 6 testes |
