# ADR-BASE-14: Sem Master Permanente no Banco Clínico

**Status:** ✅ Implementado (2026-08-28) — `users.is_master` removido, bypass `can:()=>true` eliminado, `master:*` via role_permissions tenant-scoped
**Data:** 2026-07-29 (auditoria concluída) → 2026-08-28 (implementado W3.3)

## Decisão

Nenhuma role ou conexão com acesso Master permanente aos dados de clínica. Menor privilégio e LGPD. Rejeitado: `isMaster` standing access.

## Evidência

- `src/lib/db/schema/core.ts`: `users.isMaster` (boolean, default false) — flag de bypass
- `src/core/rbac/resolve.ts`: `if (await repo.isMaster(userId)) return { role: 'master', can: () => true }`
- `src/core/rbac/presets.ts`: `master:*` permission keys são reservadas, nunca atribuídas a presets
- `src/core/rbac/seed.ts`: Owner recebe todas exceto `master:*`, `isMaster` skipa acesso por clínica
- `src/modules/core/actions/set-module-contract.ts`: usa `master:manage_modules`

## Achado

O flag `isMaster` fornece bypass total (`can: () => true`) — conflita com ADR-BASE-14.
As `master:*` permission keys existem e são o mecanismo correto (scoped, assignable, revocable).

## Recomendação

1. Remover coluna `isMaster` do schema `users` (migration)
2. Substituir bypass em `resolve.ts` por verificação de `master:*` permissions
3. Atualizar seed/migration scripts para usar grants explícitos
4. Operador Synkroo recebe role com `master:*` permissions, não flag `isMaster`

## Ação

Decisão pendente do owner. Implementação requer migration + atualização de scripts.
