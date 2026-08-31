# ADR-BASE-14: Sem Master Permanente no Banco Clínico

**Status:** ✅ Implementado (2026-08-28) — `users.is_master` removido, bypass `can:()=>true` eliminado, `master:*` via role_permissions tenant-scoped e grant operacional temporario
**Data:** 2026-07-29 (auditoria concluída) → 2026-08-28 (implementado W3.3)

## Decisão

Nenhuma role ou conexão com acesso Master permanente aos dados de clínica. Menor privilégio e LGPD. Rejeitado: `isMaster` standing access.

## Evidência

- `src/lib/db/schema/core.ts`: não possui mais `users.isMaster`.
- `src/core/rbac/resolve.ts`: não possui bypass global; Owner nega `master:*` e o operador depende de `role_permissions` explícito.
- `src/lib/db/migrations/0027_drop-is-master.sql`: remove a coluna legada.
- `src/lib/db/migrations/0029_rbac_membership_integrity.sql`: adiciona integridade tenant-scoped e metadados de expiração/revogação.
- `scripts/grant-operator-access.mjs` e `scripts/revoke-operator-access.mjs`: grants operacionais dry-run por padrão, expiraveis, revogaveis e auditados.
- `src/core/rbac/presets.ts`: `master:*` nunca entra em presets clínicos.
- `src/modules/core/actions/set-module-contract.ts`: usa `master:manage_modules`

## Achado

O flag `isMaster` fornece bypass total (`can: () => true`) — conflita com ADR-BASE-14.
As `master:*` permission keys existem e são o mecanismo correto (scoped, assignable, revocable).

## Implementação

- `master:*` só pode ser concedida pela operação explícita do operador, nunca por preset, role customizada ou override clínico.
- O grant exige `--expires-at`, `--reason`, `--actor` e `--apply`; sem `--apply` o script apenas simula.
- Role e membership são tenant-scoped; revogação incrementa `session_version` e remove o grant quando não há outro operador ativo.

## Evidência de verificação

Typecheck, testes unitários de RBAC, testes dos scripts e testes de integração com PostgreSQL foram executados após a migration `0029`. A consulta de pré-condição `users.is_master` falha com “column does not exist”, confirmando que a coluna já não existe no banco de teste.
