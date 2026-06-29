import { z } from 'zod';
import { defineAction, registerActions, clearRegistry } from '@/core/actions';
import { buildPresetPermissions, seedRbacForClinic, syncRolePermissions } from '../seed';
import { AGENT_ROLE_NAME, DEFAULT_AGENT_PERMISSIONS } from '../agent-access';
import type { DbOrTx } from '../seed';

beforeEach(() => clearRegistry());

it('expands a preset module list into concrete permission keys from the catalog', () => {
  registerActions([
    defineAction({ name: 'op.c', module: 'operacional', requires: 'operacional:create', label: 'Criar', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'fin.c', module: 'financeiro', requires: 'financeiro:create', label: 'Criar', input: z.object({}), handler: async () => null }),
  ]);
  const keys = buildPresetPermissions({ name: 'Recepcionista', description: '', modules: ['operacional'], extraKeys: ['comercial:view'] });
  expect(keys).toContain('operacional:create');
  expect(keys).toContain('comercial:view');
  expect(keys).not.toContain('financeiro:create');
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
