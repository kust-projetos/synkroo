# Eixo 2 — CRM/Contatos (E-04) Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Implementar CRM/Contatos MVP A como lente unificada sobre Patients e Leads.
**Architecture:** `route/UI → crm action → service → read-model repository/owner action`. CRM owns no schema. Only `contact-read-repository.ts` may SELECT/COUNT across owner schemas.
**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, Drizzle ORM, PostgreSQL, Jest.
**Spec:** `docs/superpowers/specs/2026-07-05-eixo2-crm-modulo-design.md`.
**Agent Orchestration:** Supervisor-Workers — one worker per task, planner reviews after each handoff.
---
## Context
- MVP: list/detail/timeline/notes/tags.
- Non-goals: contact create/edit/archive, segmentação, merge, budgets, Atendimento message timeline.
- Pitfall applied: no new CRM tables, no RLS expansion.
## Stack
| Pkg | Versão | Uso |
|---|---:|---|
| Next.js | 15 | route handlers + `/dashboard/contatos` |
| React | 19 | existing contacts UI |
| TypeScript | 5.6 | action contracts |
| Drizzle | repo | SELECT/COUNT read model |
| Jest | repo | unit/route tests |
## Architecture
```
src/modules/crm/{actions,repositories,services,ui,manifest.ts,permissions.ts,types.ts,index.ts}
```
Rules:
- Only `src/modules/crm/repositories/contact-read-repository.ts` imports owner schemas.
- CRM repository never writes.
- Notes/tags writes call owner actions.
- `/api/contacts/*` routes call CRM actions.
## Endpoints
| Route | Result |
|---|---|
| `GET /api/contacts` | `crm.listarContatos` |
| `POST /api/contacts` | `405 { error:'crm_mvp_read_only' }` |
| `GET /api/contacts/:id?type=...` | `crm.obterContato` |
| `PUT /api/contacts/:id` | `405 { error:'crm_mvp_read_only' }` |
| `PATCH /api/contacts/:id` | `405 { error:'crm_mvp_read_only' }` |
| `GET /api/contacts/:id/timeline?type=...` | `crm.listarTimelineContato` |
| `GET /api/contacts/:id/notes?type=...` | `crm.listarNotasContato` |
| `POST /api/contacts/:id/notes?type=...` | `crm.adicionarNotaContato` |
| `PUT /api/contacts/:id/tags?type=...` | `crm.atualizarTagsContato` |
## Tests
| Type | Tool | Scope |
|---|---|---|
| Unit | Jest | mapping, global sort/page, tag normalization |
| Route | Jest | gates, 405, `type` required |
| Snapshot | Jest | contacts list/detail states |
| Mutation | Stryker | mapping/timeline target ≥70% |
---
## Task 1 — Scaffold CRM module + boundary exception
**Files:**
- Create: `src/modules/crm/permissions.ts`, `manifest.ts`, `types.ts`, `index.ts`, `ui/route-adapter.ts`
- Modify: `.eslintrc.json`
- Test: `src/modules/crm/__tests__/manifest.test.ts`
- [ ] **Step 1: RED test**
```ts
import { crmManifest } from '../manifest';
import { crmPermissions } from '../permissions';
it('defines crm menu and permissions', () => {
  expect(crmManifest.id).toBe('crm');
  expect(crmManifest.menu[0]).toMatchObject({ path: '/dashboard/contatos', permission: 'crm:view' });
  expect(crmPermissions).toEqual(['crm:view', 'crm:manage_notes', 'crm:manage_tags']);
});
```
Run: `npx jest src/modules/crm/__tests__/manifest.test.ts --runInBand`
Expected: FAIL.
- [ ] **Step 2: Create files**
```ts
// src/modules/crm/permissions.ts
export const crmPermissions = ['crm:view', 'crm:manage_notes', 'crm:manage_tags'] as const;
export type CrmPermission = (typeof crmPermissions)[number];
```
```ts
// src/modules/crm/manifest.ts
export const crmManifest = { id: 'crm' as const, name: 'CRM', alwaysOn: false, menu: [{ moduleId: 'crm', permission: 'crm:view', label: 'Contatos', path: '/dashboard/contatos', icon: 'UsersIcon' }] };
```
```ts
// src/modules/crm/types.ts
export type CrmContactType = 'patient' | 'lead';
export type CrmContactId = { type: CrmContactType; id: string };
export type CrmContactSummary = CrmContactId & { clinicId: string; name: string; phone: string | null; email: string | null; status: string; tags: string[]; source: string | null; temperature: string | null; updatedAt: string; patientId?: string | null };
export type CrmTimelineEvent = { id: string; contact: CrmContactId; kind: 'note' | 'appointment' | 'lead_activity' | 'conversion'; title: string; description: string | null; occurredAt: string; actorId: string | null };
export type CrmContactListResult = { data: CrmContactSummary[]; total: number; page: number; limit: number };
```
```ts
// src/modules/crm/index.ts
import './actions';
export * from './manifest';
export * from './permissions';
export * from './types';
```
- [ ] **Step 3: Create route adapter**
```ts
import { NextResponse } from 'next/server';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import type { ActionDefinition } from '@/core/actions/types';
const statusByCode: Record<string, number> = { unauthenticated: 401, forbidden: 403, not_found: 404, conflict: 409, invalid_input: 422, module_disabled: 404, internal: 500 };
export async function runCrmAction(action: ActionDefinition<any, any>, input: unknown, opts?: { okStatus?: number }) {
  try {
    const ctx = await buildUserContext();
    const merged = { ...((input as Record<string, unknown>) || {}), clinicId: ctx.clinicId };
    const result = await runAction(action, merged, ctx);
    if (result.ok) return NextResponse.json(result.data, { status: opts?.okStatus ?? 200 });
    return NextResponse.json({ error: result.error.message }, { status: statusByCode[result.error.code] ?? 500 });
  } catch (err) {
    const unauth = err instanceof Error && err.message === 'unauthenticated';
    return NextResponse.json({ error: unauth ? 'Unauthorized' : 'Authentication error' }, { status: unauth ? 401 : 500 });
  }
}
export function crmReadOnlyResponse() { return NextResponse.json({ error: 'crm_mvp_read_only' }, { status: 405 }); }
```
- [ ] **Step 4: Add `.eslintrc.json` override**
```json
{ "files": ["src/modules/crm/repositories/contact-read-repository.ts"], "rules": { "boundaries/dependencies": "off" } }
```
- [ ] **Step 5: Verify + commit**
Run: `npx jest src/modules/crm/__tests__/manifest.test.ts --runInBand`
Expected: PASS.
Run: `npm run lint -- --file src/modules/crm/manifest.ts --file src/modules/crm/permissions.ts`
Expected: PASS.
Commit: `git add .eslintrc.json src/modules/crm && git commit -m "feat(crm): scaffold module shell"`
---
## Task 2 — Owner bridge actions for notes/tags
**Files:**
- Modify: `src/modules/operacional/repositories/patients-repository.ts`, `src/modules/operacional/actions/index.ts`
- Create: `src/modules/operacional/actions/registrar-observacao-paciente.ts`, `atualizar-tags-paciente.ts`
- Modify: `src/modules/comercial/repositories/activities-repository.ts`, `leads-repository.ts`, `actions/index.ts`
- Create: `src/modules/comercial/actions/registrar-nota-lead.ts`, `atualizar-tags-lead.ts`
- Test: `src/modules/crm/__tests__/owner-bridge-actions.test.ts`
- [ ] **Step 1: RED test**
```ts
import { registrarObservacaoPaciente, atualizarTagsPaciente } from '@/modules/operacional/actions';
import { registrarNotaLead, atualizarTagsLead } from '@/modules/comercial/actions';
it('registers owner bridge actions', () => {
  expect(registrarObservacaoPaciente.name).toBe('operacional.registrarObservacaoPaciente');
  expect(atualizarTagsPaciente.requires).toBe('operacional:manage_patients');
  expect(registrarNotaLead.name).toBe('comercial.registrarNotaLead');
  expect(registrarNotaLead.requires).toBe('comercial:edit_leads');
  expect(atualizarTagsLead.requires).toBe('comercial:edit_leads');
  expect(atualizarTagsLead.input.safeParse({ leadId: crypto.randomUUID(), clinicId: crypto.randomUUID(), tags: [' VIP ', 'vip', ''] }).success).toBe(true);
});
```
Run: `npx jest src/modules/crm/__tests__/owner-bridge-actions.test.ts --runInBand`
Expected: FAIL.
- [ ] **Step 2: Add Operacional repository helpers**
```ts
import { patientObservations } from '@/modules/operacional/schema/patients';
export async function insertPatientObservation(input: { clinicId: string; patientId: string; content: string; createdBy?: string | null }) {
  const db = getDb();
  const [row] = await db.insert(patientObservations).values({ clinicId: input.clinicId, patientId: input.patientId, content: input.content, createdBy: input.createdBy ?? null }).returning();
  return row;
}
export async function updatePatientTags(clinicId: string, id: string, tags: string[]) {
  const db = getDb();
  const [row] = await db.update(patients).set({ tags, updatedAt: new Date() } as any).where(and(eq(patients.id, id), eq(patients.clinicId, clinicId))).returning({ id: patients.id, tags: patients.tags });
  return row ?? null;
}
```
- [ ] **Step 3: Create Operacional actions**
```ts
// registrar-observacao-paciente.ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import { insertPatientObservation } from '../repositories/patients-repository';
export const registrarObservacaoPaciente = defineAction({ name: 'operacional.registrarObservacaoPaciente', module: 'operacional', requires: 'operacional:manage_patients', label: 'Registrar observação de paciente', input: z.object({ id: z.string().uuid(), content: z.string().min(1) }), handler: async (input, ctx) => insertPatientObservation({ clinicId: ctx.clinicId, patientId: input.id, content: input.content, createdBy: ctx.user?.id ?? null }) });
```
```ts
// atualizar-tags-paciente.ts
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import { ActionError } from '@/core/actions/types';
import { updatePatientTags } from '../repositories/patients-repository';
function normalizeTags(tags: string[]) { const seen = new Set<string>(); return tags.reduce<string[]>((acc, value) => { const tag = value.trim(); const key = tag.toLocaleLowerCase('pt-BR'); if (!tag || seen.has(key)) return acc; seen.add(key); acc.push(tag); return acc; }, []); }
export const atualizarTagsPaciente = defineAction({ name: 'operacional.atualizarTagsPaciente', module: 'operacional', requires: 'operacional:manage_patients', label: 'Atualizar tags de paciente', input: z.object({ id: z.string().uuid(), tags: z.array(z.string()) }), handler: async (input, ctx) => { const row = await updatePatientTags(ctx.clinicId, input.id, normalizeTags(input.tags)); if (!row) throw new ActionError('not_found', 'Paciente não encontrado.'); return row; } });
```
- [ ] **Step 4: Add Comercial helpers/actions**
```ts
// activities-repository.ts
export async function insertLeadNote(input: { leadId: string; content: string; performedBy?: string | null }) {
  const db = getDb();
  const [row] = await db.insert(leadActivities).values({ leadId: input.leadId, activityType: 'note', description: input.content, performedBy: input.performedBy ?? null, performedAt: new Date() } as any).returning();
  return row;
}
```
```ts
// leads-repository.ts
export async function updateLeadTags(leadId: string, clinicId: string, tags: string[]) { return updateLead(leadId, clinicId, { tags }); }
```
```ts
// registrar-nota-lead.ts + atualizar-tags-lead.ts shape
export const registrarNotaLead = defineAction({ name: 'comercial.registrarNotaLead', module: 'comercial', requires: 'comercial:edit_leads', label: 'Registrar nota de lead', input: z.object({ leadId: z.string().uuid(), clinicId: z.string().uuid(), content: z.string().min(1) }), handler: async (input, ctx) => { const lead = await findLeadByIdForClinic(input.leadId, input.clinicId); if (!lead) throw new ActionError('not_found', 'Lead não encontrado.'); return insertLeadNote({ leadId: input.leadId, content: input.content, performedBy: ctx.user?.id ?? null }); } });
export const atualizarTagsLead = defineAction({ name: 'comercial.atualizarTagsLead', module: 'comercial', requires: 'comercial:edit_leads', label: 'Atualizar tags de lead', input: z.object({ leadId: z.string().uuid(), clinicId: z.string().uuid(), tags: z.array(z.string()) }), handler: async (input) => { const updated = await updateLeadTags(input.leadId, input.clinicId, normalizeTags(input.tags)); if (!updated) throw new ActionError('not_found', 'Lead não encontrado.'); return updated; } });
```
- [ ] **Step 5: Register owner actions**
```ts
// src/modules/operacional/actions/index.ts: add imports near other patient actions
import { registrarObservacaoPaciente } from './registrar-observacao-paciente';
import { atualizarTagsPaciente } from './atualizar-tags-paciente';
export * from './registrar-observacao-paciente';
export * from './atualizar-tags-paciente';
// append at end of existing registerActions([...]) array, after listarTratamentosIncompletos
registrarObservacaoPaciente,
atualizarTagsPaciente,
```
```ts
// src/modules/comercial/actions/index.ts: add imports near atualizarLead
import { registrarNotaLead } from './registrar-nota-lead';
import { atualizarTagsLead } from './atualizar-tags-lead';
export * from './registrar-nota-lead';
export * from './atualizar-tags-lead';
// append at end of existing registerActions([...]) array, after processarNotificacoesLeadsQuentes
registrarNotaLead,
atualizarTagsLead,
```
- [ ] **Step 6: Verify + commit**
Run: `npx jest src/modules/crm/__tests__/owner-bridge-actions.test.ts --runInBand`
Expected: PASS.
Commit: `git add src/modules/operacional src/modules/comercial src/modules/crm/__tests__/owner-bridge-actions.test.ts && git commit -m "feat(crm): add owner note tag bridges"`
---
## Task 3 — CRM read model and actions
**Files:**
- Create: `src/modules/crm/repositories/contact-read-repository.ts`, `services/*.ts`, `actions/*.ts`
- Test: `src/modules/crm/__tests__/contact-read-model.test.ts`, `actions.test.ts`
- [ ] **Step 1: RED tests**
```ts
import { sortContacts, pageContacts, mapTags } from '../services/contact-list-service';
import { listarContatos, obterContato, listarNotasContato, atualizarTagsContato } from '../actions';
it('sorts contacts globally and pages after merge', () => {
  const rows = [{ id: 'b', type: 'lead', updatedAt: '2026-01-02T00:00:00.000Z' }, { id: 'a', type: 'patient', updatedAt: '2026-01-02T00:00:00.000Z' }, { id: 'c', type: 'lead', updatedAt: '2026-01-01T00:00:00.000Z' }] as any[];
  expect(pageContacts(sortContacts(rows), 1, 2).data.map((x) => `${x.type}:${x.id}`)).toEqual(['lead:b', 'patient:a']);
  expect(mapTags([' VIP ', 'vip', '', 'Lead'])).toEqual(['VIP', 'Lead']);
});
it('defines crm actions with permissions', () => {
  expect(listarContatos).toMatchObject({ name: 'crm.listarContatos', module: 'crm', requires: 'crm:view' });
  expect(obterContato.input.safeParse({ clinicId: crypto.randomUUID(), id: crypto.randomUUID(), type: 'lead' }).success).toBe(true);
  expect(listarNotasContato.requires).toBe('crm:view');
  expect(atualizarTagsContato.requires).toBe('crm:manage_tags');
});
```
Run: `npx jest src/modules/crm/__tests__/contact-read-model.test.ts src/modules/crm/__tests__/actions.test.ts --runInBand`
Expected: FAIL.
- [ ] **Step 2: Implement list helpers**
```ts
export function sortContacts<T extends { updatedAt: string; type: string; id: string }>(rows: T[]) { return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id)); }
export function pageContacts<T>(rows: T[], page = 1, limit = 20) { const safePage = Math.max(page, 1); const safeLimit = Math.max(limit, 1); const offset = (safePage - 1) * safeLimit; return { data: rows.slice(offset, offset + safeLimit), total: rows.length, page: safePage, limit: safeLimit }; }
export function mapTags(tags: string[] | null | undefined) { const seen = new Set<string>(); return (tags ?? []).reduce<string[]>((acc, value) => { const tag = value.trim(); const key = tag.toLocaleLowerCase('pt-BR'); if (!tag || seen.has(key)) return acc; seen.add(key); acc.push(tag); return acc; }, []); }
```
- [ ] **Step 3: Implement repository contract**
```ts
export async function listContactPage(input: ListInput) {
  const db = getDb();
  const limit = Math.max(input.limit ?? 20, 1);
  const offset = (Math.max(input.page ?? 1, 1) - 1) * limit;
  const rows = await db.execute(sql`
    SELECT 'patient' AS type, id, clinic_id, name, phone, email, status, tags, NULL AS source, NULL AS temperature, updated_at, NULL AS patient_id
    FROM patients
    WHERE clinic_id = ${input.clinicId} AND deleted_at IS NULL
    UNION ALL
    SELECT 'lead' AS type, id, clinic_id, name, phone, email, status, tags, source, temperature, updated_at, patient_id
    FROM leads
    WHERE clinic_id = ${input.clinicId} AND patient_id IS NULL AND COALESCE(status, '') <> 'converted'
    ORDER BY updated_at DESC, type ASC, id ASC
    LIMIT ${limit} OFFSET ${offset}
  `);
  const countRows = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM (
      SELECT id FROM patients WHERE clinic_id = ${input.clinicId} AND deleted_at IS NULL
      UNION ALL
      SELECT id FROM leads WHERE clinic_id = ${input.clinicId} AND patient_id IS NULL AND COALESCE(status, '') <> 'converted'
    ) contacts
  `);
  return { data: rows.rows.map(mapContactRow), total: Number(countRows.rows[0]?.total ?? 0), page: input.page ?? 1, limit };
}
export async function findContactRow(clinicId: string, id: CrmContactId) { return id.type === 'patient' ? findPatientContact(clinicId, id.id) : findLeadContact(clinicId, id.id); }
export async function listTimelineRows(clinicId: string, id: CrmContactId) { return id.type === 'patient' ? listPatientTimeline(clinicId, id.id) : listLeadTimeline(clinicId, id.id); }
export async function listNoteRows(clinicId: string, id: CrmContactId) { return id.type === 'patient' ? listPatientNotes(clinicId, id.id) : listLeadNotes(clinicId, id.id); }
```
`listContactPage` is the required global `UNION ALL` read model. Search/status/tags filters must be appended inside both SELECT branches with parameterized `sql` fragments, never string interpolation.
- [ ] **Step 4: Implement services + actions**
```ts
export async function listarContatosService(input: ListInput) { return listContactPage(input); }
export async function obterContatoService(input: { clinicId: string; type: 'patient' | 'lead'; id: string }) { const row = await findContactRow(input.clinicId, input); if (!row) throw new ActionError('not_found', 'Contato não encontrado.'); return row; }
export async function listarTimelineContatoService(input: ContactInput) { return (await listTimelineRows(input.clinicId, input)).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)); }
export async function listarNotasContatoService(input: ContactInput) { return listNoteRows(input.clinicId, input); }
export const listarContatos = defineAction({ name: 'crm.listarContatos', module: 'crm', requires: 'crm:view', label: 'Listar contatos', input: listInput, handler: listarContatosService });
export const obterContato = defineAction({ name: 'crm.obterContato', module: 'crm', requires: 'crm:view', label: 'Obter contato', input: contactInput, handler: obterContatoService });
export const listarTimelineContato = defineAction({ name: 'crm.listarTimelineContato', module: 'crm', requires: 'crm:view', label: 'Listar timeline', input: contactInput, handler: listarTimelineContatoService });
export const listarNotasContato = defineAction({ name: 'crm.listarNotasContato', module: 'crm', requires: 'crm:view', label: 'Listar notas', input: contactInput, handler: listarNotasContatoService });
```
```ts
export const adicionarNotaContato = defineAction({ name: 'crm.adicionarNotaContato', module: 'crm', requires: 'crm:manage_notes', label: 'Adicionar nota', input: noteInput, handler: adicionarNotaContatoService });
export const atualizarTagsContato = defineAction({ name: 'crm.atualizarTagsContato', module: 'crm', requires: 'crm:manage_tags', label: 'Atualizar tags', input: tagsInput, handler: atualizarTagsContatoService });
registerActions([listarContatos, obterContato, listarTimelineContato, listarNotasContato, adicionarNotaContato, atualizarTagsContato]);
```
- [ ] **Step 5: Verify + commit**
Run: `npx jest src/modules/crm/__tests__/contact-read-model.test.ts src/modules/crm/__tests__/actions.test.ts --runInBand`
Expected: PASS.
Commit: `git add src/modules/crm && git commit -m "feat(crm): add contact read model actions"`
---
## Task 4 — API route adapters and gates
**Files:**
- Modify: `src/app/api/contacts/route.ts`, `[id]/route.ts`, `[id]/notes/route.ts`, `[id]/timeline/route.ts`
- Create: `src/app/api/contacts/[id]/tags/route.ts`
- Test: `src/modules/crm/__tests__/routes.test.ts`
- [ ] **Step 1: RED route tests**
```ts
const mockIsEnabled = jest.fn().mockResolvedValue(true);
jest.mock('@/core/modules/manifest', () => ({ moduleManifest: { isEnabled: mockIsEnabled } }));
it('returns 405 for legacy contact mutations', async () => { const { POST } = await import('@/app/api/contacts/route'); const response = await POST(mockRequest('POST', 'http://localhost/api/contacts')); expect(response.status).toBe(405); await expect(response.json()).resolves.toEqual({ error: 'crm_mvp_read_only' }); });
it('requires type for contact detail', async () => { const id = crypto.randomUUID(); const { GET } = await import('@/app/api/contacts/[id]/route'); const response = await GET(mockRequest('GET', `http://localhost/api/contacts/${id}`), { params: Promise.resolve({ id }) }); expect(response.status).toBe(400); });
it('returns 404 when crm module is disabled', async () => { mockIsEnabled.mockResolvedValue(false); const { GET } = await import('@/app/api/contacts/route'); const response = await GET(mockRequest('GET', 'http://localhost/api/contacts')); expect(response.status).toBe(404); });
```
Run: `npx jest src/modules/crm/__tests__/routes.test.ts --runInBand`
Expected: FAIL.
- [ ] **Step 2: Use gated route pattern in every contacts route**
```ts
import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runCrmAction, crmReadOnlyResponse } from '@/modules/crm/ui/route-adapter';
const wrappedGET = withModuleRoute('crm', moduleManifest)(handleGET);
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { return wrappedGET(req, ctx); }
export async function PUT() { return crmReadOnlyResponse(); }
export async function PATCH() { return crmReadOnlyResponse(); }
```
- [ ] **Step 3: Route handler mapping**
```ts
// /api/contacts GET handleGET
const { searchParams } = new URL(request.url);
return runCrmAction(listarContatos, { type: searchParams.get('type') ?? 'all', search: searchParams.get('search') ?? undefined, tags: searchParams.get('tags')?.split(',').filter(Boolean), status: searchParams.get('status') ?? undefined, page: Number(searchParams.get('page') ?? 1), limit: Number(searchParams.get('limit') ?? 20) });
// /api/contacts/[id] GET handleGET
const type = searchParams.get('type');
if (type !== 'patient' && type !== 'lead') return NextResponse.json({ error: 'type query parameter required' }, { status: 400 });
return runCrmAction(obterContato, { id, type });
// /api/contacts/[id]/timeline GET handleGET
return runCrmAction(listarTimelineContato, { id, type, cursor: searchParams.get('cursor') ?? undefined, limit: Number(searchParams.get('limit') ?? 20) });
// /api/contacts/[id]/notes GET/POST handlers
return method === 'GET' ? runCrmAction(listarNotasContato, { id, type }) : runCrmAction(adicionarNotaContato, { id, type, content: (await request.json()).content }, { okStatus: 201 });
// /api/contacts/[id]/tags PUT handlePUT
return runCrmAction(atualizarTagsContato, { id, type, tags: (await request.json()).tags });
```
- [ ] **Step 4: Verify + commit**
Run: `npx jest src/modules/crm/__tests__/routes.test.ts --runInBand`
Expected: PASS.
Run: `npm run lint -- --file src/app/api/contacts/route.ts --file src/app/api/contacts/[id]/route.ts`
Expected: PASS.
Commit: `git add src/app/api/contacts src/modules/crm/__tests__/routes.test.ts && git commit -m "feat(crm): route contacts through actions"`
---
## Task 5 — UI MVP reactivation and tags editing
**Files:**
- Modify: `src/app/dashboard/contatos/page.tsx`, `src/components/contacts/contact-list-panel.tsx`, `contact-detail-panel.tsx`, `contact-notes-tab.tsx`, `src/lib/hooks/use-queries.ts`
- Test: `src/components/contacts/__tests__/contact-list-panel.test.tsx`
- [ ] **Step 1: RED UI test**
```tsx
import { render, screen } from '@testing-library/react';
import { ContactListPanel } from '../contact-list-panel';
jest.mock('@/lib/hooks/use-queries', () => ({ useContacts: () => ({ data: { data: [] }, isLoading: false }) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
it('does not render create contact button in CRM MVP', () => { render(<ContactListPanel selectedId={null} selectedType={null} />); expect(screen.queryByText('Novo Contato')).not.toBeInTheDocument(); });
```
Run: `npx jest src/components/contacts/__tests__/contact-list-panel.test.tsx --runInBand`
Expected: FAIL.
- [ ] **Step 2: Reactivate page and hide out-of-scope UI**
```tsx
// src/app/dashboard/contatos/page.tsx
import { ContactSplitView } from '@/components/contacts/contact-split-view';
export default function ContatosPage() { return <ContactSplitView />; }
```
Remove from `contact-list-panel.tsx`: `ContactCreateDialog`, `PlusIcon`, `createOpen`, footer button. Remove from `contact-detail-panel.tsx`: edit/archive mutations/buttons, Custom/WhatsApp/Financeiro tabs/imports.
- [ ] **Step 3: Add tags API helper and editor**
```ts
// src/lib/hooks/use-queries.ts
export async function updateContactTags(id: string, type: 'patient' | 'lead', tags: string[]) { const res = await fetch(`/api/contacts/${id}/tags?type=${type}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags }) }); if (!res.ok) throw new Error('Failed to update tags'); return res.json(); }
```
```tsx
// inside ContactDetailPanel info tab
const [tagText, setTagText] = useState('');
const tagsMutation = useMutation({ mutationFn: (tags: string[]) => updateContactTags(contactId!, contactType!, tags), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts', contactId, contactType] }) });
<Button size="sm" onClick={() => tagsMutation.mutate(tagText.split(',').map((t) => t.trim()))}>Salvar tags</Button>
```
- [ ] **Step 4: Converted lead badge**
```tsx
{contact.type === 'lead' && contact.patient_id && (<Badge variant="secondary">Convertido em paciente</Badge>)}
```
- [ ] **Step 5: Verify + commit**
Run: `npx jest src/components/contacts/__tests__/contact-list-panel.test.tsx --runInBand`
Expected: PASS.
Commit: `git add src/app/dashboard/contatos src/components/contacts src/lib/hooks/use-queries.ts && git commit -m "feat(crm): restore contacts mvp ui"`
---
## Task 6 — Legacy cleanup and final verification
**Files:**
- Modify/delete: `src/services/contacts/contacts.service.ts`, `src/services/contacts/timeline.service.ts`
- [ ] **Step 1: Verify no route bypass remains**
Run: `rg "@/services/contacts/contacts.service|@/services/contacts/timeline.service" src/app/api/contacts src/modules/crm src/components/contacts`
Expected: no matches.
- [ ] **Step 2: Remove or quarantine legacy services**
Delete both legacy service files when no imports remain. If tests outside CRM still import them, keep files with top comment `// LEGACY: not used by /api/contacts; remove after dependent tests migrate` and keep `/api/contacts` import-free.
- [ ] **Step 3: Focused verification**
Run: `npx jest src/modules/crm/__tests__/manifest.test.ts src/modules/crm/__tests__/owner-bridge-actions.test.ts src/modules/crm/__tests__/contact-read-model.test.ts src/modules/crm/__tests__/actions.test.ts src/modules/crm/__tests__/routes.test.ts src/components/contacts/__tests__/contact-list-panel.test.tsx --runInBand`
Expected: PASS.
Run: `npm run typecheck`
Expected: PASS.
Run: `npm run lint`
Expected: PASS.
- [ ] **Step 4: DoD grep checks**
Run: `rg "crm_mvp_read_only|crm\.listarNotasContato|crm\.atualizarTagsContato|contact-read-repository" src docs/superpowers/specs/2026-07-05-eixo2-crm-modulo-design.md`
Expected: contracts found.
Run: `rg "ContactCreateDialog|Novo Contato|ContactFinancialTab|ContactCustomFieldsTab|MessageComposer" src/components/contacts/contact-list-panel.tsx src/components/contacts/contact-detail-panel.tsx`
Expected: no matches.
- [ ] **Step 5: Final commit**
Commit: `git add src docs && git commit -m "chore(crm): remove legacy contacts bypasses"`
---
## Spec coverage self-review
| Req | Task |
|---|---|
| REQ-CRM-01 | Task 3 read model + Task 4 GET `/api/contacts` |
| REQ-CRM-02 | Task 3 filters + global read model + Task 4 GET `/api/contacts` |
| REQ-CRM-03 | Task 3 detail + Task 4 `[id]` route |
| REQ-CRM-04 | Task 3 timeline + Task 4 timeline route |
| REQ-CRM-05 | Task 2 owner note bridges + Task 4 notes route |
| REQ-CRM-06 | Task 2 owner tag bridges + Task 4 tags route + Task 5 UI tags editor |
| REQ-CRM-07 | Task 4 `withModuleRoute('crm')` |
| REQ-CRM-08 | Task 3 clinic-scoped repository |
| REQ-CRM-09 | Task 4 legacy detail contract |
| REQ-CRM-10 | Task 2 bridge actions |
## Execution options
Recommended: **Subagent-Driven** with one worker per task and planner review after each handoff.
Alternative: **Inline Execution** using `superpowers:executing-plans`, batching Tasks 1-2, 3-4, 5, then 6.
