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
| G-AUDIT-20260804 | REM-01..REM-15 | main / edfd8975 | audit remediation paths | pending | session owner | IN_PROGRESS | fixture RED→GREEN; full gate pending |

## Ciclos append-only

| Goal ID | Cycle | Timestamp | Change | Metric/result | Failure signature | Decision |
|---|---:|---|---|---|---|---|
| G-AUDIT-20260804 | 1 | 2026-08-04T11:00Z | Added two-clinic audit fixture contract | 1 test passed | missing fixture module (expected RED) | KEEP |
| G-AUDIT-20260804 | 2 | 2026-08-04T12:00Z | W1 security boundaries | lint/typecheck/security/unit/build green | integration unavailable: no TEST_DATABASE_URL/working Postgres | KEEP; NO-GO pending DB |
| G-AUDIT-20260804 | 3 | 2026-08-04T12:55Z | W2–W5 unit, architecture, mutation and release evidence | 1539 unit; security 142; mutation 91.98%; gitleaks clean; production audit 0 high/critical | full E2E setup fails on full run; staging IDs/secrets/approval absent | NO-GO |
