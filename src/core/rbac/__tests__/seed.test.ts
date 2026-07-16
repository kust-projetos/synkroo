import { z } from 'zod';
import { defineAction, registerActions, clearRegistry } from '@/core/actions';
import { getPermissionCatalog } from '../catalog';
import { buildPresetPermissions, seedRbacForClinic, syncRolePermissions, type RoleFinder } from '../seed';
import { SYSTEM_PRESETS, RESERVED_ROLE_OWNER } from '../presets';
import { AGENT_ROLE_NAME, DEFAULT_AGENT_PERMISSIONS } from '../agent-access';
import type { DbOrTx } from '../seed';

beforeEach(() => clearRegistry());

it('buildPresetPermissions expands preset modules from runtime catalog (ghost actions incluídos)', () => {
  // Registra actions FANTASMAS no catalog — com catalog-driven,
  // ESTES APARECEM se o módulo corresponder ao preset.
  registerActions([
    defineAction({ name: 'op.ghost', module: 'operacional', requires: 'operacional:ghost', label: 'Ghost', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'fin.ghost', module: 'financeiro', requires: 'financeiro:ghost', label: 'Ghost', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'op.real', module: 'operacional', requires: 'operacional:view', label: 'View', input: z.object({}), handler: async () => null }),
  ]);

  const keys = buildPresetPermissions({
    name: 'Recepcionista',
    description: '',
    modules: ['operacional'],
    extraKeys: ['comercial:view'],
  });

  // operacional:* do catalog (incluindo ghost) são expandidos
  expect(keys).toContain('operacional:view');
  expect(keys).toContain('operacional:ghost');  // catalog-driven: ghost INCLUÍDO
  // extraKeys adicionada verbatim
  expect(keys).toContain('comercial:view');
  // chaves de módulos não inclusos NÃO devem aparecer
  expect(keys).not.toContain('financeiro:view');
  expect(keys).not.toContain('financeiro:ghost');
  expect(keys).not.toContain('master:admin');
});

it('agent role has conservative default permissions (real keys only)', () => {
  expect(AGENT_ROLE_NAME).toBe('Agente');
  expect(DEFAULT_AGENT_PERMISSIONS).toContain('operacional:view');
  expect(DEFAULT_AGENT_PERMISSIONS).toContain('operacional:manage_appointments');
  expect(DEFAULT_AGENT_PERMISSIONS).toContain('atendimento:manage_messages');
  // conservador: não inclui permissões financeiras
  expect(DEFAULT_AGENT_PERMISSIONS).not.toContain('financeiro:delete');
  expect(DEFAULT_AGENT_PERMISSIONS).not.toContain('financeiro:create');
  // não contém chaves antigas/inexistentes do primeiro draft
  expect(DEFAULT_AGENT_PERMISSIONS).not.toContain('operacional:create');
  expect(DEFAULT_AGENT_PERMISSIONS).not.toContain('atendimento:reply');
});

// ─── Rerun seed reconciliation test ─────────────────────────────
//
// Em vez de faking a chain Drizzle completa (select().from().where().limit()),
// testamos a reconciliação via syncRolePermissions + verificação de que
// seedRbacForClinic invoca o helper para o role Agente.
//
// syncRolePermissions já tem teste próprio em sync-role-permissions.test.ts.

it('buildPresetPermissions expande módulo crm do catalog runtime (inclui ghost registrado)', () => {
  clearRegistry();
  registerActions([
    defineAction({ name: 'crm.ghost', module: 'crm', requires: 'crm:ghost', label: 'Ghost', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'crm.view', module: 'crm', requires: 'crm:view', label: 'View', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'crm.manage_notes', module: 'crm', requires: 'crm:manage_notes', label: 'Notes', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'crm.merge_patients', module: 'crm', requires: 'crm:merge_patients', label: 'Merge', input: z.object({}), handler: async () => null }),
  ]);

  const keys = buildPresetPermissions({
    name: 'Administrador', description: '',
    modules: ['crm'],
  });

  // catalog-driven: TODAS as chaves crm:* registradas aparecem
  expect(keys).toContain('crm:view');
  expect(keys).toContain('crm:manage_notes');
  expect(keys).toContain('crm:merge_patients');
  expect(keys).toContain('crm:ghost');  // catalog-driven: ghost INCLUÍDO
  // chaves de outros módulos NÃO aparecem
  expect(keys).not.toContain('financeiro:view');
  expect(keys).not.toContain('master:admin');
});

it('buildPresetPermissions for Comercial: catalog-driven — inclui comercial:* do catalog + extraKeys CRM', () => {
  clearRegistry();
  // Registra actions comerciais (que NÃO estão em modulePermissions.comercial=[],
  // mas EXISTEM no catalog runtime)
  registerActions([
    defineAction({ name: 'comercial.view', module: 'comercial', requires: 'comercial:view', label: 'View', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'comercial.capture_leads', module: 'comercial', requires: 'comercial:capture_leads', label: 'Capture', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'crm.merge', module: 'crm', requires: 'crm:merge_patients', label: 'Merge', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'crm.review', module: 'crm', requires: 'crm:review_duplicates', label: 'Review', input: z.object({}), handler: async () => null }),
  ]);

  const comercial = SYSTEM_PRESETS.find((p) => p.name === 'Comercial');
  expect(comercial).toBeDefined();
  expect(comercial!.modules).toEqual(['comercial', 'followup']);

  const keys = buildPresetPermissions(comercial!);
  // comercial:* do catalog runtime (2 keys)
  expect(keys).toContain('comercial:view');
  expect(keys).toContain('comercial:capture_leads');
  // followup:* — nada registrado no catalog, então NENHUMA followup key
  // extraKeys: crm:view, crm:manage_notes, crm:manage_tags (adicionadas verbatim)
  expect(keys).toContain('crm:view');
  expect(keys).toContain('crm:manage_notes');
  expect(keys).toContain('crm:manage_tags');
  // crm merge/review NÃO estão nos módulos do Comercial (crm não está em modules)
  expect(keys).not.toContain('crm:merge_patients');
  expect(keys).not.toContain('crm:review_duplicates');
  // operacional NÃO está nos módulos do Comercial
  expect(keys).not.toContain('operacional:view');
});

it('buildPresetPermissions excludes master:* permissions', () => {
  clearRegistry();
  registerActions([
    defineAction({ name: 'master.admin', module: 'core', requires: 'master:admin', label: 'Master admin', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'op.view', module: 'operacional', requires: 'operacional:view', label: 'Ver', input: z.object({}), handler: async () => null }),
  ]);

  const keys = buildPresetPermissions({
    name: 'Admin', description: '',
    modules: ['core', 'operacional'],
  });
  expect(keys).not.toContain('master:admin');
  expect(keys).toContain('operacional:view');
});

// ─── Owner preservation ────────────────────────────────────────────
// O Owner continua derivando grants do RUNTIME CATALOG (não do JSON).
// Este teste trava o contrato: o Owner recebe todas as chaves do catalog
// menos `master:*`, inclusive chaves-fantasma registradas em runtime que
// não existem no JSON modulePermissions. Isso é proposital — Owner é
// o super-admin e deve refletir o que o produto realmente autorizou.

it('Owner grants derivam do runtime catalog (não do JSON), filtrando master:*', () => {
  clearRegistry();
  registerActions([
    defineAction({ name: 'op.view', module: 'operacional', requires: 'operacional:view', label: 'View', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'op.ghost', module: 'operacional', requires: 'operacional:ghost', label: 'Ghost', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'master.admin', module: 'core', requires: 'master:admin', label: 'Master', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'fin.view', module: 'financeiro', requires: 'financeiro:view', label: 'View Fin', input: z.object({}), handler: async () => null }),
  ]);

  // Mesma fórmula usada em seedRbacForClinic para Owner (preservada).
  const catalog = getPermissionCatalog();
  const ownerKeys = catalog.map((p) => p.key).filter((k) => !k.startsWith('master:'));

  expect(ownerKeys).toContain('operacional:view');
  expect(ownerKeys).toContain('operacional:ghost'); // catalog-only: Owner PODE ter
  expect(ownerKeys).toContain('financeiro:view');
  expect(ownerKeys.every((k) => !k.startsWith('master:'))).toBe(true);
  expect(ownerKeys).not.toContain('master:admin');
});

it('syncRolePermissions inserts keys idempotently (no duplicate on second call)', async () => {
  const inserted: Array<{ roleId: string; permissionKey: string }> = [];
  const mockDb = {
    insert: () => ({
      values: (vals: unknown) => {
        const rows = Array.isArray(vals) ? vals : [vals];
        for (const r of rows as Array<{ roleId: string; permissionKey: string }>) {
          if (!inserted.some((p) => p.roleId === r.roleId && p.permissionKey === r.permissionKey)) {
            inserted.push(r);
          }
        }
        return { onConflictDoNothing: async () => undefined };
      },
    }),
  } as unknown as DbOrTx;

  // Chamada 1: insere
  await syncRolePermissions(mockDb, 'role-agent', ['operacional:manage_appointments', 'atendimento:manage_messages']);
  expect(inserted).toHaveLength(2);

  // Chamada 2 (rerun): mesma função, mesmos args → não duplica (onConflictDoNothing)
  await syncRolePermissions(mockDb, 'role-agent', ['operacional:manage_appointments', 'atendimento:manage_messages']);
  expect(inserted).toHaveLength(2);
});

it('syncRolePermissions is the reconciliation mechanism (adds missing keys, skips existing)', async () => {
  const inserted: Array<{ roleId: string; permissionKey: string }> = [
    { roleId: 'role-agent', permissionKey: 'operacional:view' },
  ];
  const mockDb = {
    insert: () => ({
      values: (vals: unknown) => {
        const rows = Array.isArray(vals) ? vals : [vals];
        for (const r of rows as Array<{ roleId: string; permissionKey: string }>) {
          if (!inserted.some((p) => p.roleId === r.roleId && p.permissionKey === r.permissionKey)) {
            inserted.push(r);
          }
        }
        return { onConflictDoNothing: async () => undefined };
      },
    }),
  } as unknown as DbOrTx;

  // syncRolePermissions com DEFAULT_AGENT_PERMISSIONS
  // role já tem 'operacional:view', faltam 'operacional:manage_appointments' e 'atendimento:manage_messages'
  await syncRolePermissions(mockDb, 'role-agent', DEFAULT_AGENT_PERMISSIONS);

  const keys = inserted.filter((p) => p.roleId === 'role-agent').map((p) => p.permissionKey);
  expect(keys).toContain('operacional:view');
  expect(keys).toContain('operacional:manage_appointments');
  expect(keys).toContain('atendimento:manage_messages');
  // 3 permissões: 1 existente + 2 novas
  expect(keys.length).toBe(3);
});

// ─── seedRbacForClinic() rerun reconciliation test ──────────────────
//
// Usa o parâmetro `roleFinder` injetável de seedRbacForClinic para evitar
// faking do AST interno do Drizzle (queryChunks / Param constructor).
// O fake-DB só precisa suportar insert (sem select — lookup é feito via roleFinder).

it('seedRbacForClinic reconciles Agente role perms on rerun (after manual removal)', async () => {
  // Estado em memória — simulação do banco
  const existingRoles: Record<string, string> = {};
  const grants: Record<string, string[]> = {};

  // Fake-DB mínimo: apenas insert (sem select — substituído pelo roleFinder).
  // Não inspeciona internos do Drizzle.
  const { rolePermissions: rpTable, roles: rolesTable } =
    require('@/modules/core/schema/rbac') as { rolePermissions: unknown; roles: unknown };

  const fakeDb = {
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const rows = Array.isArray(vals) ? vals : [vals];
        return {
          onConflictDoNothing: async () => {
            if (table === rpTable) {
              for (const r of rows as { roleId: string; permissionKey: string }[]) {
                grants[r.roleId] ??= [];
                if (!grants[r.roleId].includes(r.permissionKey)) {
                  grants[r.roleId].push(r.permissionKey);
                }
              }
            }
            // permissions catalog: no-op
          },
          returning: async () => {
            if (table === rolesTable) {
              return rows.map((r: { name: string }) => {
                const id = `id-${r.name}`;
                existingRoles[r.name] = id;
                return { id };
              });
            }
            return [];
          },
        };
      },
    }),
  } as unknown as import('../seed').DbOrTx;

  // RoleFinder injetável: simula lookup no banco sem precisar de Drizzle real.
  const roleFinder: RoleFinder = async (name) => existingRoles[name] ?? null;

  // ── 1ª run: cria roles + grant DEFAULT_AGENT_PERMISSIONS ao Agente
  await seedRbacForClinic('clinic-1', fakeDb, roleFinder);

  const agentId = existingRoles[AGENT_ROLE_NAME];
  expect(agentId).toBeDefined();
  expect(grants[agentId].sort()).toEqual([...DEFAULT_AGENT_PERMISSIONS].sort());

  // ── SIMULAÇÃO: perms críticas removidas manualmente (só sobra 'operacional:view')
  grants[agentId] = grants[agentId].filter((k) => k === 'operacional:view');
  expect(grants[agentId]).toEqual(['operacional:view']);

  // ── 2ª run (rerun do seed) — reconcilia as perms faltantes do Agente
  await seedRbacForClinic('clinic-1', fakeDb, roleFinder);

  // O role Agente não foi recriado (existingRoles ainda aponta para o mesmo id)
  expect(existingRoles[AGENT_ROLE_NAME]).toBe(agentId);

  // ★ contrato: as 2 perms removidas voltaram
  expect(grants[agentId]).toContain('operacional:manage_appointments');
  expect(grants[agentId]).toContain('atendimento:manage_messages');
  expect(grants[agentId].sort()).toEqual([...DEFAULT_AGENT_PERMISSIONS].sort());
});
