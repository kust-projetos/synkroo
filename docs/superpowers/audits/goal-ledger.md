# Goal Ledger

Estado durável das execuções `/goal` do plano mestre. Nunca registrar secrets, PII ou dados clínicos.

## Regras

- Criar Goal ID `G-<fase>-<sequência>` antes da invocação.
- Congelar oráculos RED e listar paths permitidos.
- Atualizar ciclo, timestamp, métrica e failure signature após cada iteração.
- Cap ou estagnação obriga `BLOCKED`; encerrar somente como `PASS`, `BLOCKED` ou `CANCELLED`.
- Commits precisam de autorização explícita na invocação.
- Stop gate só retoma em novo Goal com approval ID do owner registrado.

## Execuções

| Goal ID | Task/REQs | Branch/known-good SHA | Allowed paths | Gates | Commit auth | Status | Approval/evidence |
|---|---|---|---|---|---|---|---|

## Ciclos append-only

| Goal ID | Cycle | Timestamp | Change | Metric/result | Failure signature | Decision |
|---|---:|---|---|---|---|---|
