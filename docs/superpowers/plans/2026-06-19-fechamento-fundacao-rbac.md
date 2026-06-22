# Fechamento da Fundação — Integridade de RBAC (signup seed + anti-lockout) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que toda clínica criada via signup nasça com os perfis RBAC semeados e o dono com acesso Owner, e impedir o rebaixamento do último Owner — fechando o blocker de fundação antes do Eixo 2.

**Architecture:** O fluxo de signup (`createUserWithClinic`, uma transação Postgres) passa a chamar `seedRbacForClinic` **dentro da mesma transação** (atomicidade — a FK `roles.clinic_id` exige a clínica visível na mesma conexão) e a inserir `user_clinic_access` do dono com o role reservado `Owner`. A Action `core.assignUserAccess` ganha uma guarda anti-lockout que bloqueia rebaixar o último Owner. Tudo verificado por testes de integração contra Postgres real (mesma infra do Gate A).

**Tech Stack:** Drizzle ORM + `pg`, Zod, Jest (config de integração `jest.integration.config.js`), Postgres local via Docker.

**Spec:** `docs/superpowers/plans/2026-06-19-revisao-fechamento-eixo1.md` (Bloco 1, itens 1–2); roadmap-mestre §5 (Action Layer), §8 W3.4. Decisões de RBAC em `docs/superpowers/plans/2026-06-17-w3-2-rbac.md`.

**Pré-requisitos:** W3.1–3.5 implementados (Action Layer, RBAC, seed). Postgres local rodando (`npm run db:up` + `npm run db:migrate`).

> **Fora de escopo (deferido, com razão):** o wiring de **menu com RBAC real** (`sidebar.tsx:83` `can=()=>true`) **não** entra aqui — todo o dashboard é `'use client'` (`app/dashboard/layout.tsx`, `lib/ui/dashboard-layout.tsx`, `lib/ui/sidebar.tsx` são todos client) e expor o `can` real exige plumbing de contexto server→client. Isso pertence ao acabamento do W6/Core no Eixo 2. Este plano cobre só a integridade de dados RBAC, que é o blocker.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `src/core/rbac/seed.ts` | Semear perfis de sistema por clínica | Modificar: aceitar handle de DB/tx |
| `src/repositories/auth/index.ts` | Criar clínica + usuário + credenciais (signup) | Modificar: semear RBAC + conceder acesso Owner na mesma tx |
| `src/repositories/auth/__tests__/integration.test.ts` | Provar signup → RBAC semeado + dono com acesso | Criar |
| `src/modules/core/actions/assign-user-access.ts` | Action de concessão de acesso | Modificar: guarda anti-lockout |
| `src/modules/core/actions/__tests__/integration.test.ts` | Provar que o último Owner não pode ser rebaixado | Criar |

> O `testMatch` da config de integração é `**/__tests__/**/integration.test.ts` — os dois arquivos de teste novos **precisam** ter exatamente esse nome dentro de um `__tests__/`.

---

## Task 1: `seedRbacForClinic` aceita handle de DB/transação

**Files:**
- Modify: `src/core/rbac/seed.ts:17-19`

**Contexto:** hoje `seedRbacForClinic(clinicId)` faz `const db = getDb();` internamente. Para rodar dentro da transação do signup, precisa receber o executor (`db` ou `tx`). Só usa `.insert`/`.select`, presentes em ambos.

- [ ] **Step 1: Adicionar o tipo `DbOrTx` e parametrizar a função**

Em `src/core/rbac/seed.ts`, logo após os imports, adicione o tipo:

```ts
import { getDb } from '@/lib/db/client';

// Executor aceito: o db compartilhado OU uma transação Drizzle (ambos expõem insert/select).
type DbOrTx =
  | ReturnType<typeof getDb>
  | Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
```

Troque a assinatura e remova o `getDb()` interno:

```ts
// ANTES:
// export async function seedRbacForClinic(clinicId: string): Promise<void> {
//   const db = getDb();

// DEPOIS:
export async function seedRbacForClinic(clinicId: string, db: DbOrTx = getDb()): Promise<void> {
```

O corpo da função permanece idêntico (já usa a variável `db`). Esse padrão `db | tx` é o usual no Drizzle (ambos herdam `.insert`/`.select` de `PgDatabase`) e compila. **Escape-hatch:** se o TS reclamar da chamada `.insert`/`.select` sobre o tipo união, mantenha o parâmetro tipado, mas no corpo faça uma só ligação local `const x = db as ReturnType<typeof getDb>;` e use `x` (seguro — só usamos métodos compartilhados).

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 3: Verificar que os testes existentes seguem verdes**

Run: `npm test 2>&1 | tail -3`
Expected: `0 failed` (a mudança é retrocompatível — o default `getDb()` preserva os callers atuais: `scripts/migrate-userrole-to-rbac.ts`, `clinic-provisioning.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/core/rbac/seed.ts
git commit -m "refactor(rbac): seedRbacForClinic aceita handle de DB/tx (atomicidade no signup)"
```

---

## Task 2: Signup semeia RBAC e concede acesso Owner ao dono

**Files:**
- Modify: `src/repositories/auth/index.ts` (imports + transação em `createUserWithClinic`, ~linha 116-163)
- Test: `src/repositories/auth/__tests__/integration.test.ts` (criar)

- [ ] **Step 1: Escrever o teste de integração que falha**

Crie `src/repositories/auth/__tests__/integration.test.ts`:

```ts
/** @jest-environment node */

// Integration: usa DB real — desativa o mock do jest.setup.ts
jest.unmock('@/lib/db/client');
process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

import { createUserWithClinic } from '../index';
import { getDb } from '@/lib/db/client';
import { clinics, users, userCredentials } from '@/lib/db/schema';
import { roles, rolePermissions, userClinicAccess } from '@/lib/db/schema/rbac';
import { resolveAccess } from '@/core/rbac/resolve';
import { drizzleRbacRepo } from '@/core/rbac/repository';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { eq, and } from 'drizzle-orm';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

describeOrSkip('Signup — provisiona RBAC (DB real)', () => {
  const unique = Date.now();
  const email = `owner+${unique}@signup-test.local`;
  const clinicName = `Signup Test ${unique}`;
  let clinicId: string;
  let ownerId: string;

  afterAll(async () => {
    const db = getDb();
    // Limpeza explícita em ordem de dependência (FKs).
    if (clinicId) {
      await db.delete(userClinicAccess).where(eq(userClinicAccess.clinicId, clinicId));
      await db.delete(userCredentials).where(eq(userCredentials.userId, ownerId));
      await db.delete(users).where(eq(users.clinicId, clinicId));
      const roleRows = await db.select({ id: roles.id }).from(roles).where(eq(roles.clinicId, clinicId));
      for (const r of roleRows) await db.delete(rolePermissions).where(eq(rolePermissions.roleId, r.id));
      await db.delete(roles).where(eq(roles.clinicId, clinicId));
      await db.delete(clinics).where(eq(clinics.id, clinicId));
    }
    const { closeDb } = await import('@/lib/db/client');
    await closeDb();
  });

  it('cria clínica com perfis de sistema e dono com acesso Owner', async () => {
    const profile = await createUserWithClinic({
      email, password: 'senha-forte-123', name: 'Dr. Owner', clinicName,
    });
    ownerId = profile.id;
    clinicId = profile.clinicId;

    // 1. Perfis de sistema semeados (Owner + Agente + 4 presets = 6).
    const systemRoles = await getDb().select({ name: roles.name })
      .from(roles).where(and(eq(roles.clinicId, clinicId), eq(roles.isSystem, true)));
    const names = systemRoles.map((r) => r.name);
    expect(names).toContain(RESERVED_ROLE_OWNER);
    expect(names).toContain('Agente');
    expect(systemRoles.length).toBeGreaterThanOrEqual(6);

    // 2. Dono tem exatamente um acesso, com o role Owner.
    const [ownerRole] = await getDb().select({ id: roles.id }).from(roles)
      .where(and(eq(roles.clinicId, clinicId), eq(roles.name, RESERVED_ROLE_OWNER))).limit(1);
    const access = await getDb().select().from(userClinicAccess)
      .where(eq(userClinicAccess.userId, ownerId));
    expect(access).toHaveLength(1);
    expect(access[0].roleId).toBe(ownerRole.id);

    // 3. Prova do fim do lockout: o dono pode gerir usuários.
    const resolved = await resolveAccess(ownerId, clinicId, drizzleRbacRepo);
    expect(resolved.can('core:manage_users')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run db:up && RUN_INTEGRATION_TESTS=1 npx jest --config jest.integration.config.js src/repositories/auth 2>&1 | tail -20`
Expected: FAIL — `access` tem length 0 (signup ainda não semeia nem concede acesso).

- [ ] **Step 3: Adicionar imports em `src/repositories/auth/index.ts`**

Na linha 1-3, estenda os imports:

```ts
import { eq, sql, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { clinics, users, userCredentials } from '@/lib/db/schema';
import { roles, userClinicAccess } from '@/lib/db/schema/rbac';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
```

- [ ] **Step 4: Semear RBAC + conceder acesso Owner dentro da transação**

Em `createUserWithClinic`, dentro do `db.transaction(async (tx) => { ... })`, **após** a criação das credenciais (passo "3. Create credentials", ~linha 160) e **antes** do `return { user, clinic };`, insira:

```ts
    // 4. Seed dos perfis de sistema (idempotente) na MESMA tx — atomicidade da FK roles.clinic_id.
    await seedRbacForClinic(clinic.id, tx);

    // 5. Concede ao dono o acesso com role Owner (sem isso, resolveAccess → can:()=>false = lockout).
    const [ownerRole] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.clinicId, clinic.id), eq(roles.name, RESERVED_ROLE_OWNER)))
      .limit(1);
    if (!ownerRole) throw new Error('[signup] perfil Owner não foi semeado');
    await tx.insert(userClinicAccess).values({
      userId: user.id,
      clinicId: clinic.id,
      roleId: ownerRole.id,
    });
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `RUN_INTEGRATION_TESTS=1 npx jest --config jest.integration.config.js src/repositories/auth 2>&1 | tail -20`
Expected: PASS (1 passed).

- [ ] **Step 6: Confirmar typecheck + unit verdes**

Run: `npm run typecheck 2>&1 | grep -c "error TS"` → Expected: `0`
Run: `npm test 2>&1 | tail -3` → Expected: `0 failed`

- [ ] **Step 7: Aposentar o caminho órfão `provisionClinic`**

`src/modules/core/services/clinic-provisioning.ts` (`provisionClinic`) ficou redundante e divergente (insere clínica sem dono/credenciais e sem conceder acesso). Como não tem caller, **delete o arquivo** para não deixar dois caminhos de criação de clínica:

```bash
git rm src/modules/core/services/clinic-provisioning.ts
```

Confirme que nada o importava (esperado: vazio):

Run: `grep -rn "clinic-provisioning\|provisionClinic" src` → Expected: sem resultados.
Run: `npm run typecheck 2>&1 | grep -c "error TS"` → Expected: `0`

- [ ] **Step 8: Commit**

```bash
git add src/repositories/auth/index.ts src/repositories/auth/__tests__/integration.test.ts
git commit -m "fix(rbac): signup semeia RBAC e concede acesso Owner ao dono (fecha lockout) + remove provisionClinic orfao"
```

---

## Task 3: Guarda anti-lockout em `assignUserAccess`

**Files:**
- Modify: `src/modules/core/actions/assign-user-access.ts`
- Test: `src/modules/core/actions/__tests__/integration.test.ts` (criar)

**Contexto:** `assignUserAccess` faz upsert do role de um usuário. Se o usuário atual é o **único** Owner e está sendo movido para outro role, a clínica fica sem Owner (lockout). Guarda: bloquear esse caso com `ActionError('conflict', ...)` (o `runAction` mapeia para `result:'error'`, `errorCode:'conflict'`).

- [ ] **Step 1: Escrever o teste de integração que falha**

Crie `src/modules/core/actions/__tests__/integration.test.ts`:

```ts
/** @jest-environment node */

jest.unmock('@/lib/db/client');
process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

import { runAction } from '@/core/actions/run';
import { assignUserAccess } from '../assign-user-access';
import type { ActionContext } from '@/core/actions/types';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { getDb } from '@/lib/db/client';
import { clinics, users } from '@/lib/db/schema';
import { roles, userClinicAccess } from '@/lib/db/schema/rbac';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { eq, and } from 'drizzle-orm';

const CLINIC = '00000000-0000-0000-0000-000000000001'; // Test Clinic (seed-test-clinic.mjs)
const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const adminCtx: ActionContext = {
  source: 'user', clinicId: CLINIC,
  user: { id: 'admin-runner', email: 'a@a', name: 'A' },
  can: () => true, hasModule: () => true,
  audit: { actor: 'admin-runner' },
};

describeOrSkip('assignUserAccess — anti-lockout (DB real)', () => {
  const u = Date.now();
  const ownerUserId = `00000000-0000-0000-0000-0000000a${String(u).slice(-4)}`;
  let ownerRoleId: string;
  let recepRoleId: string;

  beforeAll(async () => {
    const db = getDb();
    await db.insert(clinics).values({
      id: CLINIC, name: 'Test Clinic', slug: 'test-clinic', phone: '', email: 't@t.local',
    }).onConflictDoNothing();
    await seedRbacForClinic(CLINIC); // idempotente
    [ownerRoleId] = (await db.select({ id: roles.id }).from(roles)
      .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, RESERVED_ROLE_OWNER))).limit(1))
      .map((r) => r.id);
    [recepRoleId] = (await db.select({ id: roles.id }).from(roles)
      .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, 'Recepcionista'))).limit(1))
      .map((r) => r.id);
    // Único Owner da clínica.
    await db.insert(users).values({
      id: ownerUserId, clinicId: CLINIC, email: `owner+${u}@t.local`, name: 'Owner', role: 'owner', isActive: true,
    }).onConflictDoNothing();
    await db.insert(userClinicAccess).values({ userId: ownerUserId, clinicId: CLINIC, roleId: ownerRoleId })
      .onConflictDoUpdate({ target: [userClinicAccess.userId, userClinicAccess.clinicId], set: { roleId: ownerRoleId } });
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, ownerUserId));
    await db.delete(users).where(eq(users.id, ownerUserId));
    const { closeDb } = await import('@/lib/db/client');
    await closeDb();
  });

  it('bloqueia rebaixar o último Owner', async () => {
    const r = await runAction(assignUserAccess,
      { userId: ownerUserId, clinicId: CLINIC, roleId: recepRoleId }, adminCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('conflict');

    // O acesso permanece Owner (não foi alterado).
    const [acc] = await getDb().select({ roleId: userClinicAccess.roleId }).from(userClinicAccess)
      .where(eq(userClinicAccess.userId, ownerUserId)).limit(1);
    expect(acc.roleId).toBe(ownerRoleId);
  });

  it('permite reatribuir o próprio Owner a Owner (no-op idempotente)', async () => {
    const r = await runAction(assignUserAccess,
      { userId: ownerUserId, clinicId: CLINIC, roleId: ownerRoleId }, adminCtx);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `RUN_INTEGRATION_TESTS=1 npx jest --config jest.integration.config.js src/modules/core/actions 2>&1 | tail -20`
Expected: FAIL no 1º caso — sem guarda, o rebaixamento sucede (`r.ok === true`).

- [ ] **Step 3: Implementar a guarda anti-lockout**

Substitua o conteúdo de `src/modules/core/actions/assign-user-access.ts` por:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import { ActionError } from '@/core/actions/types';
import { getDb } from '@/lib/db/client';
import { roles, userClinicAccess } from '@/lib/db/schema/rbac';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { and, eq } from 'drizzle-orm';

export const assignUserAccess = defineAction({
  name: 'core.assignUserAccess',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Conceder acesso de usuário a uma clínica',
  input: z.object({ userId: z.string().min(1), clinicId: z.string().min(1), roleId: z.string().min(1) }),
  handler: async (input) => {
    const db = getDb();

    // Anti-lockout: não rebaixar o ÚLTIMO Owner da clínica.
    const [ownerRole] = await db.select({ id: roles.id }).from(roles)
      .where(and(eq(roles.clinicId, input.clinicId), eq(roles.name, RESERVED_ROLE_OWNER), eq(roles.isSystem, true)))
      .limit(1);
    if (ownerRole) {
      const [current] = await db.select({ roleId: userClinicAccess.roleId }).from(userClinicAccess)
        .where(and(eq(userClinicAccess.userId, input.userId), eq(userClinicAccess.clinicId, input.clinicId)))
        .limit(1);
      const isCurrentlyOwner = current?.roleId === ownerRole.id;
      const isBecomingOwner = input.roleId === ownerRole.id;
      if (isCurrentlyOwner && !isBecomingOwner) {
        const owners = await db.select({ userId: userClinicAccess.userId }).from(userClinicAccess)
          .where(and(eq(userClinicAccess.clinicId, input.clinicId), eq(userClinicAccess.roleId, ownerRole.id)));
        if (owners.length <= 1) {
          throw new ActionError('conflict', 'Não é possível rebaixar o último Owner da clínica.');
        }
      }
    }

    await db.insert(userClinicAccess)
      .values({ userId: input.userId, clinicId: input.clinicId, roleId: input.roleId })
      .onConflictDoUpdate({ target: [userClinicAccess.userId, userClinicAccess.clinicId], set: { roleId: input.roleId } });
    return { ok: true };
  },
});
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `RUN_INTEGRATION_TESTS=1 npx jest --config jest.integration.config.js src/modules/core/actions 2>&1 | tail -20`
Expected: PASS (2 passed).

- [ ] **Step 5: Confirmar typecheck + unit + suíte de integração completa**

Run: `npm run typecheck 2>&1 | grep -c "error TS"` → Expected: `0`
Run: `npm test 2>&1 | tail -3` → Expected: `0 failed`
Run: `npm run test:integration 2>&1 | tail -6` → Expected: todas as suítes `integration.test.ts` passam (Action Layer + signup + anti-lockout).

- [ ] **Step 6: Commit**

```bash
git add src/modules/core/actions/assign-user-access.ts src/modules/core/actions/__tests__/integration.test.ts
git commit -m "feat(rbac): guarda anti-lockout em assignUserAccess (nao rebaixar ultimo Owner)"
```

---

## Self-Review

**Spec coverage (review §Bloco 1):**
- Item 1 (seed RBAC + acesso Owner no signup, atomicidade da tx) → Tasks 1+2 ✓
- Item 2 (anti-lockout) → Task 3 ✓
- Item 3 (menu RBAC real) → **fora de escopo, deferido com razão** (dashboard 100% client; precisa de plumbing server→client) — registrado no cabeçalho.
- Remoção do `provisionClinic` órfão → Task 2 Step 7 ✓

**Placeholder scan:** sem TBD/TODO. Todo step de código mostra o código real; comandos com saída esperada.

**Type consistency:** `seedRbacForClinic(clinicId, db?)` (Task 1) consumido com `tx` no signup (Task 2 Step 4) e com default em testes (Tasks 2/3). `RESERVED_ROLE_OWNER` (`'Owner'`), `roles`/`userClinicAccess` e `ActionError('conflict', …)` consistentes com `src/core/actions/types.ts` (código `conflict` existe) e `src/core/rbac/presets.ts`. `userClinicAccess` PK `(userId, clinicId)` → `onConflictDoUpdate` no par bate com o schema.

**Dependências/ordem:** Task 1 (assinatura) antes da Task 2 (uso com `tx`). Task 3 independe das anteriores, mas o teste reusa `seedRbacForClinic` (idempotente). Todos os testes exigem Postgres local (`npm run db:up` + migrations aplicadas).

**Risco:** o anti-lockout cobre só a superfície existente (`assignUserAccess`). Quando um `removeUserAccess`/desativação de usuário for criado (Eixo 2), **deve repetir a mesma guarda** — anotar no plano do módulo Core.
