import { z } from 'zod';
import { defineAction, registerActions, clearRegistry } from '@/core/actions';
import { buildPresetPermissions, seedRbacForClinic, syncRolePermissions, type RoleFinder } from '../seed';
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
