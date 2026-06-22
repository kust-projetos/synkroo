# Eixo 2 — Módulo Operacional (E-02) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar o sistema de agendamento maduro para o template canônico do Core (`app → action → service → repository → Drizzle`), cobrindo o bounded context Operacional completo (Agendamentos + Pacientes + Dentistas + Procedimentos) com anti-overbooking DB-enforced e gates reais.

**Architecture:** Toda operação passa pela Action Layer (`runAction`): rotas REST viram adapters finos sobre Actions; invariantes no service; queries no repository; `withModuleRoute` em todas as rotas do bounded context; constraint `EXCLUDE` no Postgres como fonte de verdade de "0 overbooking".

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.6, Drizzle ORM, PostgreSQL (btree_gist), Jest unit/integration, ESLint boundaries.

**Spec:** `docs/superpowers/specs/2026-06-22-eixo2-operacional-modulo-design.md` (fases F1–F6).

**Agent Orchestration:** Single-Agent Looped — tarefas sequenciais e acopladas; cada tarefa fecha teste→implementação→verificação antes da próxima.

---

## Convenções verificadas (APIs do projeto — não reinventar)

- `defineAction({ name, module, requires, label, input: z.object({...}), handler: async (input, ctx) => data })` — de `@/core/actions`.
- `runAction(action, input, ctx)` — de `@/core/actions/run`. Retorna `{ ok: true, data } | { ok: false, error: { code, message } }`.
- `buildUserContext(activeClinicId?)` — de `@/core/actions/context`. Retorna `ctx` com `{ clinicId, can(key), hasModule(id), source }`.
- `ActionError('conflict' | 'not_found' | 'forbidden' | 'unauthorized' | ..., message)` — de `@/core/actions/types`.
- Gates de `@/core/modules/gates`: `withModuleRoute(moduleId, manifest)(handler)`, `assertModuleForJob(moduleId, manifest)`.
- Manifesto runtime: `moduleManifest` de `@/core/modules/manifest` (tem `isEnabled(id)`).
- `getDb()` de `@/lib/db/client`. **Proibido** em `actions/` e em `route.ts` (adapters).
- Registro central de actions: `bootstrapActions()` em `@/core/actions/bootstrap` lê `operacionalActions` de `@/modules/operacional`.

---

## File Structure

| Path | Role |
|---|---|
| `src/modules/operacional/schema/appointments.ts` | Move de `lib/db/schema/appointments.ts` (6 tabelas) |
| `src/modules/operacional/schema/patients.ts` | Extraído de `core.ts`: patients, observations, preferences, riskScores, feedback |
| `src/modules/operacional/schema/clinical.ts` | Extraído de `core.ts`: dentists, procedures, procedureGuidelines |
| `src/modules/operacional/schema/index.ts` | Seam público (local + re-export clinics/users do Core) |
| `src/modules/operacional/repositories/appointments-repository.ts` | Queries de agendamento (insert/reschedule/list/availability) |
| `src/modules/operacional/repositories/patients-repository.ts` | Queries de pacientes + dedup lookup |
| `src/modules/operacional/repositories/catalog-repository.ts` | Queries de dentistas + procedimentos |
| `src/modules/operacional/services/scheduling-service.ts` | Invariante overbooking (traduz 23P01), waitlist on cancel |
| `src/modules/operacional/services/availability-service.ts` | Slots livres |
| `src/modules/operacional/services/patients-service.ts` | Dedup por telefone/CPF |
| `src/modules/operacional/services/reminders-service.ts` | Confirmação 24h / lembrete 2h (migrado) |
| `src/modules/operacional/actions/*.ts` | Actions (agendar, remarcar, confirmar, cancelar, no-show, list, disponibilidade, pacientes, catálogo) |
| `src/modules/operacional/manifest.ts` | `operacionalManifest` (alwaysOn:false) |
| `src/modules/operacional/permissions.ts` | `operacional:*` |
| `src/modules/operacional/index.ts` | `operacionalActions`, `operacionalManifest`, `operacionalAccessPermissions` |
| `src/lib/db/schema/core.ts` | Fica só com clinics/users/userCredentials |
| `src/lib/db/schema/index.ts` | Re-exporta schema operacional p/ agregação Drizzle |
| `src/lib/db/migrations/XXXX_appointments_no_overlap.sql` | Migration manual da constraint EXCLUDE |
| `src/app/api/{appointments,patients,dentists,procedures,waitlist,reminders}/**` | Vira adapter sobre `runAction` + `withModuleRoute` |
| `src/app/api/cron/reminders/route.ts` | `assertModuleForJob('operacional')` |
| `src/lib/ui/sidebar.tsx` | Remove os 5 navItems operacionais estáticos |
| `src/core/actions/bootstrap.ts` | Registra `operacionalActions` |

---

## Task 1 — F1: Separar schema do Operacional

**Files:**
- Move: `src/lib/db/schema/appointments.ts` → `src/modules/operacional/schema/appointments.ts`
- Create: `src/modules/operacional/schema/patients.ts`, `clinical.ts`, `index.ts`
- Modify: `src/lib/db/schema/core.ts` (remove 8 tabelas), `src/lib/db/schema/index.ts`
- Modify imports: todos os importadores das tabelas movidas

- [ ] **Step 1: Mover appointments.ts (arquivo limpo)**

```bash
mkdir -p src/modules/operacional/schema
git mv src/lib/db/schema/appointments.ts src/modules/operacional/schema/appointments.ts
```

- [ ] **Step 2: Criar `clinical.ts` e `patients.ts` (recortar de core.ts)**

Mover de `src/lib/db/schema/core.ts` para `src/modules/operacional/schema/clinical.ts` os blocos `dentists`, `procedures`, `procedureGuidelines` (definições `pgTable` íntegras, com seus imports `pgTable, uuid, ...` do `drizzle-orm/pg-core`). No topo do arquivo:

```ts
import { clinics } from '@/lib/db/schema/core';
```

(dentists/procedures referenciam `clinics`; manter as colunas/refs exatamente como estavam.)

Mover para `src/modules/operacional/schema/patients.ts` os blocos `patients`, `patientObservations`, `patientPreferences`, `patientRiskScores`, `patientFeedback`. No topo:

```ts
import { clinics } from '@/lib/db/schema/core';
import { dentists } from './clinical';
```

(ajustar refs internas: se `patients` referenciava `dentists`/`procedures`, importar de `./clinical`.)

- [ ] **Step 3: Limpar core.ts**

Em `src/lib/db/schema/core.ts`, remover as 8 tabelas movidas. Deve restar **apenas** `clinics`, `users`, `userCredentials` (e seus imports). Remover imports agora não usados.

- [ ] **Step 4: Corrigir import do appointments.ts movido**

Em `src/modules/operacional/schema/appointments.ts`, trocar:

```ts
import { clinics, dentists, patients, procedures, users } from './core';
```

por:

```ts
import { clinics, users } from '@/lib/db/schema/core';
import { dentists, procedures } from './clinical';
import { patients } from './patients';
```

- [ ] **Step 5: Criar o seam público**

Create `src/modules/operacional/schema/index.ts`:

```ts
export * from './appointments';
export * from './clinical';
export * from './patients';
// Re-export do Core para o módulo ter superfície única de schema:
export { clinics, users } from '@/lib/db/schema/core';
```

- [ ] **Step 6: Preservar agregação Drizzle**

Em `src/lib/db/schema/index.ts`, substituir a linha `export * from './appointments';` por:

```ts
export * from '../../../modules/operacional/schema/appointments';
export * from '../../../modules/operacional/schema/clinical';
export * from '../../../modules/operacional/schema/patients';
```

(Mantém todas as tabelas Operacional capturadas pelo `drizzle-kit generate`.)

- [ ] **Step 7: Atualizar importadores do path antigo**

```bash
rg -l "@/lib/db/schema/appointments|from './appointments'|from '\.\./appointments'" src scripts \
  | xargs -r perl -0pi -e "s#@/lib/db/schema/appointments#@/modules/operacional/schema/appointments#g"
```

Para as tabelas que saíram de `core.ts` (patients/dentists/procedures/...), localizar importadores que as puxavam **de `@/lib/db/schema/core`** e redirecioná-los ao seam do módulo. Importadores de `clinics`/`users` permanecem em `@/lib/db/schema/core`.

```bash
rg -n "from '@/lib/db/schema/core'" src scripts
# Para cada arquivo que importa patients/dentists/procedures/patientObservations/
# patientPreferences/patientRiskScores/patientFeedback/procedureGuidelines:
#   trocar o import dessas tabelas para '@/modules/operacional/schema'
#   (clinics/users continuam vindo de '@/lib/db/schema/core')
```

- [ ] **Step 8: Verificar typecheck e geração de schema**

Run:

```bash
npm run typecheck
npm run db:generate
```

Expected: `typecheck` 0 erros. `db:generate` → **"No schema changes, nothing to migrate"** (move de path não altera o schema lógico). Se gerar migration, inspecionar; descartar se for falso-diff só por caminho.

- [ ] **Step 9: Rodar suíte (garantir que o move não quebrou nada)**

```bash
npm test
```

Expected: PASS (mesmo conjunto de antes).

- [ ] **Step 10: Commit**

```bash
git add src/modules/operacional/schema src/lib/db/schema src scripts
git add -u src/lib/db/schema/appointments.ts
git commit -m "refactor(operacional): own bounded-context schema seam"
```

---

## Task 2 — F2a: Constraint anti-overbooking (migration manual)

**Files:**
- Create: `src/lib/db/migrations/XXXX_appointments_no_overlap.sql` (via drizzle-kit custom)
- Create: `src/modules/operacional/repositories/__tests__/overbooking.integration.test.ts`

- [ ] **Step 1: Gerar migration custom vazia**

```bash
npx drizzle-kit generate --custom --name=appointments_no_overlap
```

Isso cria um `.sql` numerado vazio em `src/lib/db/migrations/` **e** a entrada no `meta/_journal.json`.

- [ ] **Step 2: Escrever o SQL (preflight + extensão + constraint + rollback comentado)**

No arquivo `.sql` criado:

```sql
-- Preflight: aborta se já existirem overlaps ativos (Pitfall 7).
-- Se esta query retornar linhas, normalizar os dados ANTES de aplicar.
DO $$
DECLARE overlap_count int;
BEGIN
  SELECT count(*) INTO overlap_count FROM (
    SELECT a.id
    FROM appointments a
    JOIN appointments b
      ON a.dentist_id = b.dentist_id
     AND a.id <> b.id
     AND a.status IN ('scheduled','confirmed','in_progress')
     AND b.status IN ('scheduled','confirmed','in_progress')
     AND tstzrange(a.scheduled_at, a.scheduled_at + (a.duration_minutes * interval '1 minute'))
         && tstzrange(b.scheduled_at, b.scheduled_at + (b.duration_minutes * interval '1 minute'))
  ) t;
  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'Existem % agendamentos sobrepostos ativos. Normalizar antes de criar a constraint.', overlap_count;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    dentist_id WITH =,
    tstzrange(scheduled_at, scheduled_at + (duration_minutes * interval '1 minute')) WITH &&
  ) WHERE (status IN ('scheduled','confirmed','in_progress'));

-- ROLLBACK (manual):
--   ALTER TABLE appointments DROP CONSTRAINT appointments_no_overlap;
--   (a extensão btree_gist pode permanecer)
```

> **Nota dentist_id nulo:** `EXCLUDE` ignora linhas com `dentist_id` NULL — esses não conflitam. Decisão registrada: aceitar (agendamento sem dentista não bloqueia slot). Se o produto exigir, tornar `dentist_id` obrigatório em outra migration.

- [ ] **Step 3: Aplicar a migration**

```bash
npm run db:migrate
```

Expected: aplica sem erro (preflight passa em DB limpo/seed).

- [ ] **Step 4: Escrever teste de integração concorrente (RED → GREEN)**

Create `src/modules/operacional/repositories/__tests__/overbooking.integration.test.ts`:

```ts
/** @jest-environment node */
jest.unmock('@/lib/db/client');

import { getDb } from '@/lib/db/client';
import { appointments } from '@/modules/operacional/schema/appointments';
import { clinics, users } from '@/lib/db/schema/core';
import { patients, dentists } from '@/modules/operacional/schema';
import { eq } from 'drizzle-orm';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
const CLINIC = '00000000-0000-0000-0000-000000000001';

describeOrSkip('appointments_no_overlap constraint (DB real)', () => {
  it('dois inserts simultâneos no mesmo slot/dentista: 1 sucede, 1 falha 23P01', async () => {
    const db = getDb();
    const tag = String(Date.now()).slice(-6);
    const dentistId = `00000000-0000-0000-0000-0000000d${tag}`;
    const patientId = `00000000-0000-0000-0000-0000000e${tag}`;
    const slot = new Date('2030-01-01T13:00:00Z');

    await db.insert(dentists).values({ id: dentistId, clinicId: CLINIC, name: 'Dr Teste' }).onConflictDoNothing();
    await db.insert(patients).values({ id: patientId, clinicId: CLINIC, name: 'Paciente Teste', phone: `+5511${tag}` }).onConflictDoNothing();

    const mk = () => db.insert(appointments).values({
      clinicId: CLINIC, patientId, dentistId, scheduledAt: slot, durationMinutes: 30, status: 'scheduled',
    });

    const results = await Promise.allSettled([mk(), mk()]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0].reason as { code?: string }).code).toBe('23P01');

    // cleanup
    await db.delete(appointments).where(eq(appointments.dentistId, dentistId));
    await db.delete(patients).where(eq(patients.id, patientId));
    await db.delete(dentists).where(eq(dentists.id, dentistId));
  });
});
```

Run:

```bash
RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/repositories/__tests__/overbooking.integration.test.ts
```

Expected: PASS (a constraint, já aplicada, garante o comportamento).

- [ ] **Step 5: Verificar `db:reset` reaplica a constraint**

```bash
npm run db:reset && npm run db:migrate
RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/repositories/__tests__/overbooking.integration.test.ts
```

Expected: PASS após reset (a migration manual é versionada e reaplicada).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/migrations src/modules/operacional/repositories/__tests__/overbooking.integration.test.ts
git commit -m "feat(operacional): db-enforced no-overlap constraint"
```

---

## Task 3 — F3: Repository + scheduling service + Actions de agendamento

**Files:**
- Create: `src/modules/operacional/repositories/appointments-repository.ts`
- Create: `src/modules/operacional/services/scheduling-service.ts`
- Create: `src/modules/operacional/actions/{agendar,remarcar,confirmar,cancelar,registrar-no-show,listar-consultas}-consulta.ts`
- Test: `src/modules/operacional/actions/__tests__/scheduling.integration.test.ts`

- [ ] **Step 1: Criar o repository (queries Drizzle)**

Create `src/modules/operacional/repositories/appointments-repository.ts`:

```ts
import { getDb } from '@/lib/db/client';
import { appointments } from '../schema/appointments';
import { and, eq } from 'drizzle-orm';

export interface AppointmentInput {
  clinicId: string; patientId: string; dentistId?: string | null;
  procedureId?: string | null; scheduledAt: Date; durationMinutes: number;
}

export async function insertAppointment(input: AppointmentInput) {
  const [row] = await getDb().insert(appointments).values({
    clinicId: input.clinicId, patientId: input.patientId, dentistId: input.dentistId ?? null,
    procedureId: input.procedureId ?? null, scheduledAt: input.scheduledAt,
    durationMinutes: input.durationMinutes, status: 'scheduled',
  }).returning({ id: appointments.id });
  return { id: row.id };
}

export async function findById(clinicId: string, id: string) {
  const [row] = await getDb().select().from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId))).limit(1);
  return row ?? null;
}

export async function setStatus(clinicId: string, id: string, status: 'confirmed' | 'cancelled' | 'no_show', extra: Partial<{ cancellationReason: string }> = {}) {
  const [row] = await getDb().update(appointments)
    .set({ status, updatedAt: new Date(), ...(extra.cancellationReason ? { cancellationReason: extra.cancellationReason, cancelledAt: new Date() } : {}) })
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
    .returning({ id: appointments.id });
  return row ?? null;
}

export async function moveSlot(clinicId: string, id: string, scheduledAt: Date, durationMinutes: number) {
  const [row] = await getDb().update(appointments)
    .set({ scheduledAt, durationMinutes, rescheduledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
    .returning({ id: appointments.id });
  return row ?? null;
}

export async function listByClinic(clinicId: string) {
  return getDb().select().from(appointments).where(eq(appointments.clinicId, clinicId));
}
```

- [ ] **Step 2: Criar o scheduling service (invariante overbooking + waitlist)**

Create `src/modules/operacional/services/scheduling-service.ts`:

```ts
import { ActionError } from '@/core/actions/types';
import * as repo from '../repositories/appointments-repository';

function isOverlapError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23P01';
}

export async function agendarConsulta(input: repo.AppointmentInput) {
  try {
    return await repo.insertAppointment(input);
  } catch (e) {
    if (isOverlapError(e)) throw new ActionError('conflict', 'Horário indisponível para este dentista.');
    throw e;
  }
}

export async function remarcarConsulta(input: { clinicId: string; id: string; scheduledAt: Date; durationMinutes: number }) {
  const existing = await repo.findById(input.clinicId, input.id);
  if (!existing) throw new ActionError('not_found', 'Agendamento não encontrado.');
  try {
    const row = await repo.moveSlot(input.clinicId, input.id, input.scheduledAt, input.durationMinutes);
    return { id: row!.id };
  } catch (e) {
    if (isOverlapError(e)) throw new ActionError('conflict', 'Novo horário indisponível para este dentista.');
    throw e;
  }
}

export async function confirmarConsulta(input: { clinicId: string; id: string }) {
  const row = await repo.setStatus(input.clinicId, input.id, 'confirmed');
  if (!row) throw new ActionError('not_found', 'Agendamento não encontrado.');
  return { id: row.id };
}

export async function cancelarConsulta(input: { clinicId: string; id: string; reason?: string }) {
  const existing = await repo.findById(input.clinicId, input.id);
  if (!existing) throw new ActionError('not_found', 'Agendamento não encontrado.');
  const row = await repo.setStatus(input.clinicId, input.id, 'cancelled', { cancellationReason: input.reason });
  return { id: row!.id };
}

export async function registrarNoShow(input: { clinicId: string; id: string }) {
  const row = await repo.setStatus(input.clinicId, input.id, 'no_show');
  if (!row) throw new ActionError('not_found', 'Agendamento não encontrado.');
  return { id: row.id };
}

export async function listarConsultas(clinicId: string) {
  return repo.listByClinic(clinicId);
}
```

> **Waitlist on cancel:** o efeito de notificar a waitlist (hoje em `appointment-actions.service.ts`) deve ser portado para `cancelarConsulta` em uma iteração subsequente desta task (chamar o service de waitlist após o `setStatus('cancelled')`). Mantê-lo coberto pelo teste existente de cancelamento.

- [ ] **Step 3: Criar as Actions (delegam ao service)**

Create `src/modules/operacional/actions/agendar-consulta.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as scheduling from '../services/scheduling-service';

export const agendarConsulta = defineAction({
  name: 'operacional.agendarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Agendar consulta',
  input: z.object({
    patientId: z.string().uuid(),
    dentistId: z.string().uuid().optional(),
    procedureId: z.string().uuid().optional(),
    scheduledAt: z.coerce.date(),
    durationMinutes: z.number().int().positive().default(30),
  }),
  handler: async (input, ctx) => scheduling.agendarConsulta({ clinicId: ctx.clinicId, ...input }),
});
```

Create `src/modules/operacional/actions/remarcar-consulta.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as scheduling from '../services/scheduling-service';

export const remarcarConsulta = defineAction({
  name: 'operacional.remarcarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Remarcar consulta',
  input: z.object({ id: z.string().uuid(), scheduledAt: z.coerce.date(), durationMinutes: z.number().int().positive().default(30) }),
  handler: async (input, ctx) => scheduling.remarcarConsulta({ clinicId: ctx.clinicId, ...input }),
});
```

Create `src/modules/operacional/actions/confirmar-consulta.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as scheduling from '../services/scheduling-service';

export const confirmarConsulta = defineAction({
  name: 'operacional.confirmarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Confirmar consulta',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx) => scheduling.confirmarConsulta({ clinicId: ctx.clinicId, id: input.id }),
});
```

Create `src/modules/operacional/actions/cancelar-consulta.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as scheduling from '../services/scheduling-service';

export const cancelarConsulta = defineAction({
  name: 'operacional.cancelarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Cancelar consulta',
  input: z.object({ id: z.string().uuid(), reason: z.string().optional() }),
  handler: async (input, ctx) => scheduling.cancelarConsulta({ clinicId: ctx.clinicId, ...input }),
});
```

Create `src/modules/operacional/actions/registrar-no-show.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as scheduling from '../services/scheduling-service';

export const registrarNoShow = defineAction({
  name: 'operacional.registrarNoShow',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Registrar falta',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx) => scheduling.registrarNoShow({ clinicId: ctx.clinicId, id: input.id }),
});
```

Create `src/modules/operacional/actions/listar-consultas.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as scheduling from '../services/scheduling-service';

export const listarConsultas = defineAction({
  name: 'operacional.listarConsultas',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Listar consultas',
  input: z.object({}),
  handler: async (_input, ctx) => scheduling.listarConsultas(ctx.clinicId),
});
```

- [ ] **Step 4: Teste de integração do fluxo (agendar → conflito → confirmar → noShow)**

Create `src/modules/operacional/actions/__tests__/scheduling.integration.test.ts`:

```ts
/** @jest-environment node */
jest.unmock('@/lib/db/client');

import { runAction } from '@/core/actions/run';
import type { ActionContext } from '@/core/actions/types';
import { getDb } from '@/lib/db/client';
import { appointments } from '@/modules/operacional/schema/appointments';
import { patients, dentists } from '@/modules/operacional/schema';
import { agendarConsulta } from '../agendar-consulta';
import { confirmarConsulta } from '../confirmar-consulta';
import { registrarNoShow } from '../registrar-no-show';
import { eq } from 'drizzle-orm';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
const CLINIC = '00000000-0000-0000-0000-000000000001';
const ctx: ActionContext = { source: 'user', clinicId: CLINIC, can: () => true, hasModule: () => true } as ActionContext;

describeOrSkip('scheduling flow (DB real)', () => {
  it('agenda, bloqueia overlap, confirma e marca no-show', async () => {
    const db = getDb();
    const tag = String(Date.now()).slice(-6);
    const dentistId = `00000000-0000-0000-0000-0000001d${tag}`;
    const patientId = `00000000-0000-0000-0000-0000001e${tag}`;
    const slot = new Date('2030-02-02T14:00:00Z').toISOString();
    await db.insert(dentists).values({ id: dentistId, clinicId: CLINIC, name: 'Dr Flow' }).onConflictDoNothing();
    await db.insert(patients).values({ id: patientId, clinicId: CLINIC, name: 'Pac Flow', phone: `+5511${tag}` }).onConflictDoNothing();

    const first = await runAction(agendarConsulta, { patientId, dentistId, scheduledAt: slot, durationMinutes: 30 }, ctx);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const clash = await runAction(agendarConsulta, { patientId, dentistId, scheduledAt: slot, durationMinutes: 30 }, ctx);
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.error.code).toBe('conflict');

    const confirmed = await runAction(confirmarConsulta, { id: first.data.id }, ctx);
    expect(confirmed.ok).toBe(true);

    const noShow = await runAction(registrarNoShow, { id: first.data.id }, ctx);
    expect(noShow.ok).toBe(true);

    await db.delete(appointments).where(eq(appointments.dentistId, dentistId));
    await db.delete(patients).where(eq(patients.id, patientId));
    await db.delete(dentists).where(eq(dentists.id, dentistId));
  });
});
```

Run:

```bash
RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/actions/__tests__/scheduling.integration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Converter `/api/appointments/route.ts` (e sub-rotas) para adapter**

Substituir a lógica direta de `src/app/api/appointments/route.ts` (POST que faz `getDb()` + checagem de conflito, linhas ~121-158) por adapter sobre a Action:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { agendarConsulta } from '@/modules/operacional/actions/agendar-consulta';
import { listarConsultas } from '@/modules/operacional/actions/listar-consultas';

export const POST = withModuleRoute('operacional', moduleManifest)(async (request: NextRequest) => {
  const ctx = await buildUserContext();
  const body = await request.json();
  const result = await runAction(agendarConsulta, body, ctx);
  if (!result.ok) {
    const status = result.error.code === 'conflict' ? 409 : result.error.code === 'forbidden' ? 403 : 400;
    return NextResponse.json({ error: result.error.code, message: result.error.message }, { status });
  }
  return NextResponse.json(result.data, { status: 201 });
});

export const GET = withModuleRoute('operacional', moduleManifest)(async () => {
  const ctx = await buildUserContext();
  const result = await runAction(listarConsultas, {}, ctx);
  if (!result.ok) return NextResponse.json({ error: result.error.code }, { status: 400 });
  return NextResponse.json(result.data);
});
```

Converter analogamente as sub-rotas `[id]/confirm`, `[id]/cancel`, `[id]/noshow`, `[id]/reschedule` (cada uma → `runAction` da Action correspondente, embrulhada por `withModuleRoute`). **Nenhum `getDb()` em `route.ts`.**

- [ ] **Step 6: Verificar ausência de DB direto nas rotas de appointments**

```bash
rg -n "getDb\(|@/repositories|@/services/appointments" src/app/api/appointments
```

Expected: vazio (só imports de actions/gates/context).

- [ ] **Step 7: typecheck + testes**

```bash
npm run typecheck
RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/actions
```

Expected: 0 erros; PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/operacional src/app/api/appointments
git commit -m "feat(operacional): scheduling actions via action layer + route adapters"
```

---

## Task 4 — F2b: Disponibilidade reconectada

**Files:**
- Create: `src/modules/operacional/services/availability-service.ts`
- Modify: `src/modules/operacional/repositories/appointments-repository.ts` (add `freeSlots`)
- Create: `src/modules/operacional/actions/consultar-disponibilidade.ts`
- Modify: `src/app/api/appointments/availability/route.ts` (adapter; remove `TODO W5.3`)
- Test: `src/modules/operacional/actions/__tests__/availability.integration.test.ts`

- [ ] **Step 1: Adicionar geração de slots no repository**

Em `src/modules/operacional/repositories/appointments-repository.ts`, adicionar função que retorna os slots ocupados (appointments ativos) e blocos de agenda para um dentista/data, reaproveitando a lógica existente em `src/repositories/appointments/index.ts:403-468` (portar a query de overlap de slots):

```ts
import { scheduleBlocks } from '../schema/appointments';

export async function bookedSlots(clinicId: string, dentistId: string, dayStart: Date, dayEnd: Date) {
  return getDb().select({ scheduledAt: appointments.scheduledAt, durationMinutes: appointments.durationMinutes })
    .from(appointments)
    .where(and(
      eq(appointments.clinicId, clinicId),
      eq(appointments.dentistId, dentistId),
      // ativos no dia
    ));
  // NOTA: portar o filtro temporal e de status ('scheduled','confirmed','in_progress')
  // exatamente como em src/repositories/appointments/index.ts:455-468
}
```

- [ ] **Step 2: Service de disponibilidade**

Create `src/modules/operacional/services/availability-service.ts`:

```ts
import * as repo from '../repositories/appointments-repository';

export interface SlotQuery { clinicId: string; dentistId: string; date: string; slotMinutes?: number }

export async function consultarDisponibilidade(q: SlotQuery): Promise<string[]> {
  const dayStart = new Date(`${q.date}T00:00:00Z`);
  const dayEnd = new Date(`${q.date}T23:59:59Z`);
  const booked = await repo.bookedSlots(q.clinicId, q.dentistId, dayStart, dayEnd);
  // Gerar grade do dia (ex.: 08:00–18:00 a cada slotMinutes) e remover os 'booked'.
  // Reaproveitar a grade de src/repositories/appointments/index.ts:403-450.
  // Retornar lista de horários ISO livres.
  return computeFreeSlots(q, booked);
}

function computeFreeSlots(q: SlotQuery, booked: Array<{ scheduledAt: Date; durationMinutes: number | null }>): string[] {
  const step = q.slotMinutes ?? 30;
  const out: string[] = [];
  for (let h = 8; h < 18; h++) {
    for (let m = 0; m < 60; m += step) {
      const t = new Date(`${q.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
      const clash = booked.some((b) => {
        const start = b.scheduledAt.getTime();
        const end = start + (b.durationMinutes ?? 30) * 60000;
        return t.getTime() < end && t.getTime() + step * 60000 > start;
      });
      if (!clash) out.push(t.toISOString());
    }
  }
  return out;
}
```

- [ ] **Step 3: Read-action**

Create `src/modules/operacional/actions/consultar-disponibilidade.ts`:

```ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as availability from '../services/availability-service';

export const consultarDisponibilidade = defineAction({
  name: 'operacional.consultarDisponibilidade',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Consultar disponibilidade',
  input: z.object({ dentistId: z.string().uuid(), date: z.string(), slotMinutes: z.number().int().positive().optional() }),
  handler: async (input, ctx) => availability.consultarDisponibilidade({ clinicId: ctx.clinicId, ...input }),
});
```

- [ ] **Step 4: Adapter da rota (remove TODO W5.3)**

Substituir `src/app/api/appointments/availability/route.ts` por adapter `GET` que lê query params (`dentistId`, `date`) → `runAction(consultarDisponibilidade, ...)`, embrulhado por `withModuleRoute('operacional', moduleManifest)`. Remover o objeto stub `{ available:false, todo:'TODO(W5.3)...' }`.

- [ ] **Step 5: Teste de integração de disponibilidade**

Create `src/modules/operacional/actions/__tests__/availability.integration.test.ts`: seed de 1 appointment ativo num slot; assert que `consultarDisponibilidade` **não** retorna esse horário e **retorna** um horário livre adjacente. (Mesmo scaffold de seed/cleanup das tasks anteriores.)

Run:

```bash
RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/actions/__tests__/availability.integration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/operacional src/app/api/appointments/availability
git commit -m "feat(operacional): reconnect availability (resolve W5.3)"
```

---

## Task 5 — F4: Pacientes (CRUD + dedup)

**Files:**
- Create: `src/modules/operacional/repositories/patients-repository.ts`
- Create: `src/modules/operacional/services/patients-service.ts`
- Create: `src/modules/operacional/actions/{criar,atualizar,listar}-paciente.ts`
- Modify: `src/app/api/patients/**` (adapters)
- Test: `src/modules/operacional/services/__tests__/patients-service.test.ts` (unit, dedup) + integração

- [ ] **Step 1: Repository de pacientes**

Create `src/modules/operacional/repositories/patients-repository.ts`:

```ts
import { getDb } from '@/lib/db/client';
import { patients } from '../schema/patients';
import { and, eq } from 'drizzle-orm';

export async function findByPhone(clinicId: string, phone: string) {
  const [row] = await getDb().select({ id: patients.id }).from(patients)
    .where(and(eq(patients.clinicId, clinicId), eq(patients.phone, phone))).limit(1);
  return row ?? null;
}

export async function insertPatient(input: { clinicId: string; name: string; phone: string; email?: string | null }) {
  const [row] = await getDb().insert(patients)
    .values({ clinicId: input.clinicId, name: input.name, phone: input.phone, email: input.email ?? null })
    .returning({ id: patients.id });
  return { id: row.id };
}

export async function updatePatient(clinicId: string, id: string, patch: { name?: string; phone?: string; email?: string | null }) {
  const [row] = await getDb().update(patients).set({ ...patch, updatedAt: new Date() })
    .where(and(eq(patients.id, id), eq(patients.clinicId, clinicId))).returning({ id: patients.id });
  return row ?? null;
}

export async function listPatients(clinicId: string) {
  return getDb().select({ id: patients.id, name: patients.name, phone: patients.phone, email: patients.email })
    .from(patients).where(eq(patients.clinicId, clinicId));
}
```

> Conferir os nomes reais das colunas de `patients` em `src/modules/operacional/schema/patients.ts` (ex.: se o telefone é `phone` ou `phoneNumber`) e ajustar.

- [ ] **Step 2: Unit test do dedup (RED)**

Create `src/modules/operacional/services/__tests__/patients-service.test.ts`:

```ts
jest.mock('../../repositories/patients-repository', () => ({
  findByPhone: jest.fn(), insertPatient: jest.fn(), updatePatient: jest.fn(), listPatients: jest.fn(),
}));
import { ActionError } from '@/core/actions/types';
import { criarPaciente } from '../patients-service';
import * as repo from '../../repositories/patients-repository';

const mocked = jest.mocked(repo);
beforeEach(() => jest.resetAllMocks());

it('cria paciente quando telefone não existe', async () => {
  mocked.findByPhone.mockResolvedValue(null);
  mocked.insertPatient.mockResolvedValue({ id: 'p1' });
  await expect(criarPaciente({ clinicId: 'c1', name: 'A', phone: '+5511999' })).resolves.toEqual({ id: 'p1' });
});

it('rejeita duplicado por telefone', async () => {
  mocked.findByPhone.mockResolvedValue({ id: 'existing' });
  await expect(criarPaciente({ clinicId: 'c1', name: 'A', phone: '+5511999' })).rejects.toBeInstanceOf(ActionError);
});
```

Run: `npm test -- src/modules/operacional/services/__tests__/patients-service.test.ts` → Expected: FAIL (service inexistente).

- [ ] **Step 3: Service com dedup (GREEN)**

Create `src/modules/operacional/services/patients-service.ts`:

```ts
import { ActionError } from '@/core/actions/types';
import * as repo from '../repositories/patients-repository';

export async function criarPaciente(input: { clinicId: string; name: string; phone: string; email?: string }) {
  const existing = await repo.findByPhone(input.clinicId, input.phone);
  if (existing) throw new ActionError('conflict', 'Já existe um paciente com este telefone.');
  return repo.insertPatient(input);
}

export async function atualizarPaciente(input: { clinicId: string; id: string; name?: string; phone?: string; email?: string }) {
  const { clinicId, id, ...patch } = input;
  const row = await repo.updatePatient(clinicId, id, patch);
  if (!row) throw new ActionError('not_found', 'Paciente não encontrado.');
  return { id: row.id };
}

export async function listarPacientes(clinicId: string) {
  return repo.listPatients(clinicId);
}
```

Run the unit test again → Expected: PASS.

- [ ] **Step 4: Actions**

Create `criar-paciente.ts`, `atualizar-paciente.ts`, `listar-paciente.ts` seguindo **exatamente** o shape das actions da Task 3 (Step 3). Definições:

- `operacional.criarPaciente` — `requires:'operacional:manage_patients'` — input `{ name: z.string().min(1), phone: z.string().min(8), email: z.string().email().optional() }` — handler `criarPaciente({ clinicId: ctx.clinicId, ...input })`.
- `operacional.atualizarPaciente` — `requires:'operacional:manage_patients'` — input `{ id: z.string().uuid(), name: z.string().optional(), phone: z.string().optional(), email: z.string().email().optional() }`.
- `operacional.listarPacientes` — `requires:'operacional:view'` — input `z.object({})` — handler `listarPacientes(ctx.clinicId)`.

- [ ] **Step 5: Converter `/api/patients/**` para adapters**

Cada rota em `src/app/api/patients/` (route.ts, [id]/route.ts, [id]/observations, [id]/preferences, deduplicate, inactive, tags, [id]/history) vira adapter sobre a Action correspondente, embrulhada por `withModuleRoute('operacional', moduleManifest)`. Rotas sem Action equivalente nesta onda (ex.: `tags`, `history`): ou recebem read-action mínima, ou são **deprecadas** explicitamente (retornar 410/404 com nota), **nunca** deixadas com `getDb()` direto.

- [ ] **Step 6: Verificar e testar**

```bash
rg -n "getDb\(" src/app/api/patients
npm run typecheck
npm test -- src/modules/operacional/services/__tests__/patients-service.test.ts
```

Expected: rotas sem `getDb()`; 0 erros; PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/operacional src/app/api/patients
git commit -m "feat(operacional): patients crud with dedup + route adapters"
```

---

## Task 6 — F4: Dentistas + Procedimentos (catálogo)

**Files:**
- Create: `src/modules/operacional/repositories/catalog-repository.ts`
- Create: `src/modules/operacional/actions/{criar,listar}-dentista.ts`, `{criar,listar}-procedimento.ts`
- Modify: `src/app/api/dentists/**`, `src/app/api/procedures/**` (adapters)

- [ ] **Step 1: Repository de catálogo**

Create `src/modules/operacional/repositories/catalog-repository.ts` com funções `insertDentist`/`listDentists`/`insertProcedure`/`listProcedures`, escopadas por `clinicId`, sobre `dentists`/`procedures` de `../schema/clinical`. Seguir o shape do `patients-repository.ts` (Task 5, Step 1). Conferir nomes de colunas em `clinical.ts`.

- [ ] **Step 2: Actions**

Criar as actions seguindo o shape da Task 3:
- `operacional.criarDentista` / `operacional.listarDentistas` — `requires:'operacional:manage_catalog'` / `'operacional:view'`.
- `operacional.criarProcedimento` / `operacional.listarProcedimentos` — idem.

Handlers delegam direto ao repository (catálogo não tem invariante complexa; service opcional — manter action→repository simples, mas **sem `getDb()` na action**: criar `services/catalog-service.ts` fino que reexporta as funções do repo, para manter o padrão `action→service→repository`).

- [ ] **Step 3: Adapters de rota**

`src/app/api/dentists/**` e `src/app/api/procedures/**` → adapters sobre as actions, com `withModuleRoute('operacional', moduleManifest)`. Sem `getDb()` direto.

- [ ] **Step 4: Verificar + typecheck**

```bash
rg -n "getDb\(" src/app/api/dentists src/app/api/procedures
npm run typecheck
```

Expected: vazio; 0 erros.

- [ ] **Step 5: Commit**

```bash
git add src/modules/operacional src/app/api/dentists src/app/api/procedures
git commit -m "feat(operacional): dentists and procedures catalog + adapters"
```

---

## Task 7 — F5: Gates completos + crons (reminders/confirmação)

**Files:**
- Modify: `src/app/api/waitlist/route.ts`, `src/app/api/reminders/config/route.ts` (adapter + gate)
- Modify: `src/app/api/cron/reminders/route.ts` (assertModuleForJob)
- Create: `src/modules/operacional/services/reminders-service.ts` (migra `services/reminders` + `confirmation-handler`)
- Test: `src/modules/operacional/__tests__/gates.integration.test.ts`

- [ ] **Step 1: Gate nas rotas restantes do bounded context**

Embrulhar `waitlist/route.ts` e `reminders/config/route.ts` com `withModuleRoute('operacional', moduleManifest)` e converter a lógica para adapter sobre Action (waitlist: criar `operacional.entrarWaitlist`/`listarWaitlist` se ainda não houver; reminders/config: action de leitura/escrita de `appointmentReminderConfigs`). Sem `getDb()` direto.

- [ ] **Step 2: Migrar reminders/confirmation para o módulo**

Portar `src/services/reminders/reminder.service.ts` (`processAllReminders`) e `src/services/appointments/confirmation-handler.service.ts` para `src/modules/operacional/services/reminders-service.ts`, mantendo a lógica de confirmação 24h / lembrete 2h / processamento de resposta. Atualizar importadores.

- [ ] **Step 3: Gate no cron**

Em `src/app/api/cron/reminders/route.ts`, após a verificação de `CRON_SECRET` e antes de `processAllReminders()`:

```ts
import { assertModuleForJob } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { ModuleDisabledError } from '@/core/modules/gates';
// ...
try {
  await assertModuleForJob('operacional', moduleManifest);
} catch (e) {
  if (e instanceof ModuleDisabledError) {
    return NextResponse.json({ skipped: 'operacional disabled' }, { status: 200 });
  }
  throw e;
}
await processAllReminders(); // agora importado de @/modules/operacional/services/reminders-service
```

- [ ] **Step 4: Teste de integração dos gates**

Create `src/modules/operacional/__tests__/gates.integration.test.ts`: com `operacional` **não** contratado em `instanceModules`, a rota `POST /api/appointments` (via handler exportado) retorna 404; com contratado, segue. Usar `makeManifest` com repo stub para controlar `isEnabled` sem depender do estado real do banco, OU semear/limpar `instanceModules`.

Run:

```bash
RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/__tests__/gates.integration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/operacional src/app/api/waitlist src/app/api/reminders src/app/api/cron/reminders
git commit -m "feat(operacional): full bounded-context gates + reminder crons"
```

---

## Task 8 — F6: Manifesto, permissões, registro e menu

**Files:**
- Create: `src/modules/operacional/manifest.ts`, `permissions.ts`, `index.ts`
- Modify: `src/core/actions/bootstrap.ts`
- Modify: `src/lib/ui/sidebar.tsx` (remove 5 navItems)
- Test: `src/core/actions/__tests__/bootstrap.test.ts` (estende guard)

- [ ] **Step 1: Manifest + permissions**

Create `src/modules/operacional/manifest.ts`:

```ts
export const operacionalManifest = {
  id: 'operacional',
  name: 'Operacional',
  alwaysOn: false,
  menu: [
    { moduleId:'operacional', permission:'operacional:view',                label:'Agendamentos',   path:'/dashboard/agendamentos', icon:'CalendarDaysIcon' },
    { moduleId:'operacional', permission:'operacional:view',                label:'Pacientes',      path:'/dashboard/pacientes',    icon:'UsersIcon' },
    { moduleId:'operacional', permission:'operacional:manage_appointments', label:'Lista de Espera', path:'/dashboard/lista-espera', icon:'ClockIcon' },
    { moduleId:'operacional', permission:'operacional:manage_catalog',      label:'Dentistas',      path:'/dashboard/dentistas',    icon:'IdentificationIcon' },
    { moduleId:'operacional', permission:'operacional:manage_catalog',      label:'Procedimentos',  path:'/dashboard/procedimentos', icon:'WrenchScrewdriverIcon' },
  ],
  jobs: ['operacional.reminders'] as string[],
};
```

Create `src/modules/operacional/permissions.ts`:

```ts
import type { PermissionEntry } from '@/core/rbac/catalog';

export const operacionalAccessPermissions: PermissionEntry[] = [
  { key:'operacional:view',                module:'operacional', label:'Ver agenda e pacientes' },
  { key:'operacional:manage_appointments', module:'operacional', label:'Gerenciar consultas' },
  { key:'operacional:manage_patients',     module:'operacional', label:'Gerenciar pacientes' },
  { key:'operacional:manage_catalog',      module:'operacional', label:'Gerenciar dentistas e procedimentos' },
];
```

- [ ] **Step 2: index.ts (agrega actions)**

Create `src/modules/operacional/index.ts` importando **todas** as actions criadas (agendar, remarcar, confirmar, cancelar, registrarNoShow, listarConsultas, consultarDisponibilidade, criar/atualizar/listar Paciente, criar/listar Dentista, criar/listar Procedimento, waitlist/reminders-config se viraram actions) e exportando:

```ts
export const operacionalActions = [ /* ...todas as actions... */ ];
export { operacionalManifest } from './manifest';
export { operacionalAccessPermissions } from './permissions';
```

- [ ] **Step 3: Registrar no bootstrap**

Em `src/core/actions/bootstrap.ts`, no `Promise.all`, importar também `@/modules/operacional` e registrar suas actions + permissões:

```ts
const [{ registerAccessPermissions }, core, operacional] = await Promise.all([
  import('@/core/rbac/catalog'),
  import('@/modules/core'),
  import('@/modules/operacional'),
]);
registerActions([...core.coreActions, ...operacional.operacionalActions].filter((a) => !getAction(a.name)));
registerAccessPermissions([...core.coreAccessPermissions, ...operacional.operacionalAccessPermissions]);
```

- [ ] **Step 4: Estender o teste-guarda do registry**

Em `src/core/actions/__tests__/bootstrap.test.ts`, adicionar ao `arrayContaining` os nomes das actions do Operacional (`operacional.agendarConsulta`, `operacional.confirmarConsulta`, `operacional.listarPacientes`, etc.), garantindo que todas são descobríveis via `getActions()` após `bootstrapActions()`.

Run: `npm test -- src/core/actions/__tests__/bootstrap.test.ts` → Expected: PASS.

- [ ] **Step 5: Remover os 5 navItems estáticos**

Em `src/lib/ui/sidebar.tsx`, remover as linhas 84-90 (Pacientes, Agendamentos, Lista de Espera, Dentistas, Procedimentos). O menu desses itens passa a vir do `operacionalManifest` via o pipeline manifesto+RBAC já existente (`buildMenu`/`filterMenuByAccess`), condicionado a `isEnabled('operacional')`.

> Conferir como o Core injeta `coreManifest.menu` no pipeline e replicar para `operacionalManifest.menu` (provável ponto: o agregador de manifestos consumido por `getVisibleCoreMenu`/`buildMenu`).

- [ ] **Step 6: Gate final completo**

```bash
npm run typecheck
npm run lint
npm test
RUN_INTEGRATION_TESTS=1 npm run test:integration
npm run db:generate
```

Expected: typecheck 0; lint 0 (boundaries em `error`); unit verde; integração verde; `db:generate` "No schema changes" (a constraint é migration manual, invisível ao Drizzle).

- [ ] **Step 7: Verificação anti-bypass final**

```bash
rg -n "getDb\(" src/app/api/appointments src/app/api/patients src/app/api/dentists src/app/api/procedures src/app/api/waitlist src/app/api/reminders
```

Expected: **vazio**.

- [ ] **Step 8: Commit**

```bash
git add src/modules/operacional src/core/actions/bootstrap.ts src/core/actions/__tests__/bootstrap.test.ts src/lib/ui/sidebar.tsx
git commit -m "feat(operacional): register module, manifest menu, remove static navitems"
```

---

## Self-Review Checklist

- **F1** coberto por Task 1: schema movido (appointments) + extraído (patients/clinical) + seam + agregação Drizzle; `db:generate` limpo.
- **F2** coberto por Tasks 2 e 4: constraint EXCLUDE via migration manual (preflight/extension/alter/rollback) + teste concorrente; disponibilidade reconectada.
- **F3** coberto por Task 3: actions agendar/remarcar/confirmar/cancelar/noShow + list, `action→service→repository`, rotas `/api/appointments/*` viram adapters; sem `getDb()` em actions/rotas.
- **F4** coberto por Tasks 5 e 6: pacientes (dedup) + dentistas + procedimentos via template + adapters.
- **F5** coberto por Task 7: `withModuleRoute` em todas as rotas do bounded context + `assertModuleForJob` no cron + reminders/confirmação migrados.
- **F6** coberto por Task 8: manifesto + permissões + index + bootstrap + menu via manifesto + teste-guarda.
- **Sem bypass:** verificação `rg getDb` nas Tasks 3/5/6/8.
- **Gates de build:** typecheck/lint/unit/integração/`db:generate` na Task 8.

> **Atenção do executor:** confirmar nomes reais de colunas em `patients.ts`/`clinical.ts` antes de escrever as queries dos repositories (o spec lista as tabelas, mas os nomes de coluna devem ser lidos do schema movido). Portar fielmente a lógica de slots de `src/repositories/appointments/index.ts:403-468` na Task 4. Cobrir o efeito waitlist-on-cancel (Task 3, Step 2) com o teste de cancelamento existente.
