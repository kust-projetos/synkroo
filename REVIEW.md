# REVIEW.md

Política de review deste repo. Lida por `reviewer`, `/code-review` e Claude no CI. Findings não aprovam nem bloqueiam: branch protection exige aprovação humana.

## Passes (nesta ordem)

| Pass | Pergunta | Fonte de verdade |
|---|---|---|
| Spec-conformance | O diff faz o que foi pedido? Requisito por requisito, veredito com `file:line` ou gap exato | `intent/<slug>.md` + plano em `specs/<slug>.html` |
| Bugs | Quebra comportamento, perde dado, estado inválido, edge case sem tratamento | código + testes |
| Security | Auth, validação de input, PII em log/erro, secrets, injeção, OWASP Top 10 | código + `CLAUDE.md` |

## Severidade

- **Important**: quebra comportamento, vaza dado ou viola política. Bloqueia.
- **Nit**: estilo, nome, formatação. Não bloqueia.

Máximo 5 nits por review. Resto vira contagem (`+N nits`).

## Ignorar

- `src/gen/`, `**/*.generated.*`
- O que lint/CI já impõe (formatação, imports, tipos)
- Trabalho extra que a spec não pediu (nota à parte, não bloqueia). Trabalho que a spec pediu e falta: sempre bloqueia.

## Saída

```
## Spec-conformance: approved | blocked
- REQ-1 atendido src/x.ts:42
- REQ-2 não atendido: falta <gap exato>
## Bugs (Important): N
## Security (Important): N
## Nits: até 5 + contagem
```

Finding repetido 2x → linha em `CLAUDE.md` "Things Claude gets wrong".
