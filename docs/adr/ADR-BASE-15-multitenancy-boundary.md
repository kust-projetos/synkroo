# ADR-BASE-15: Boundary de Tenancy (sessão → membership → ActionContext)

**Status:** ✅ Implementado
**Data:** 2026-09-14 (hardening V1, trilhas C2/D1)

## Contexto

Todo acesso a dados de clínica precisa provar, em cada chamada, *quem* está agindo e *em qual clínica*. O risco central é cross-tenant: um `findById(id)` sem escopo retorna (ou altera) o recurso de outra clínica. A auditoria do hardening V1 classificou o núcleo como ALREADY_COMPLIANT, com um único gap real: repositórios legados com assinaturas não-escopadas (trilha C2).

## Decisão

O boundary de tenancy é uma cadeia fechada, sem atalho:

1. **Sessão → membership:** `src/lib/auth/session.ts` resolve a sessão e deriva o acesso via `resolveAccess(userId, clinicId, repo)` (`src/core/rbac/resolve.ts`).
2. **Membership → ActionContext:** os builders em `src/core/actions/context.ts` (`buildUserContext`, `buildDelegatedContext`, `buildSystemContext`, `buildCronContext`) produzem o `ActionContext` (`src/core/actions/types.ts`) já vinculado a `clinicId` + permissões resolvidas.
3. **ActionContext → repositórios escopados:** acesso a dados passa por repositórios com assinatura `(clinicId, id)` (ex.: `src/modules/operacional/repositories/*`); o guard de escopo de tenant vive em `src/core/actions/tenant-scope.ts`.
4. **Repositórios legados não-escopados removidos/restritos:** as assinaturas sem `clinicId` em `src/repositories/appointments`, `src/repositories/dentists` e `src/repositories/procedures` foram migradas para as variantes escopadas dos modules e depois deprecadas/removidas. Exceção legítima sem escopo (ex.: signup) precisa ser documentada explicitamente no código chamador.
5. **Testes cross-tenant como gate:** fluxos migrados têm testes negativos (clínica A → recurso da clínica B → 404), ex.: `src/modules/operacional/actions/__tests__/appointment-relational-tenancy.test.ts`, `src/modules/comercial/__tests__/comercial-actions-tenancy.test.ts`.

## Evidência

- `src/lib/auth/session.ts` — sessão → `resolveAccess`
- `src/core/rbac/resolve.ts` (+ `src/core/rbac/__tests__/resolve.test.ts`) — resolução de acesso
- `src/core/actions/context.ts`, `src/core/actions/types.ts`, `src/core/actions/tenant-scope.ts` — construção e guard do contexto
- Repositórios escopados em `src/modules/operacional/repositories/*`
- Constraint de agenda tenant-agnóstica porém consistente com o boundary: `appointments_no_overlap` (ver `docs/ops/w11-rollout-runbook.md`)

## Alternativas rejeitadas

- Confiar apenas no filtro de `clinicId` no service chamador: frágil — cada novo chamador precisa lembrar de filtrar; o guard no boundary + assinatura escopada torna o erro impossível por construção.
- RLS no Postgres como mecanismo primário: não adotado em v1 — o enforcement vive na Action Layer (ADR-BASE-06); RLS permanece alternativa futura, não substituta.

## Consequências

- Novo acesso a dados multi-tenant **precisa** nascer escopado (`clinicId` obrigatório na key/assinatura); shims `@deprecated` sem consumidores são removidos (trilha F3) somente com prova de zero referências.
- Exceções sem escopo são explícitas e raras, nunca o default.
