import { z } from 'zod';
import { defineAction, registerActions, clearRegistry } from '@/core/actions';
import { buildPresetPermissions, seedRbacForClinic, syncRolePermissions, type RoleFinder } from '../seed';
import { SYSTEM_PRESETS } from '../presets';
import { AGENT_ROLE_NAME, DEFAULT_AGENT_PERMISSIONS } from '../agent-access';
import type { DbOrTx } from '../seed';

beforeEach(() => clearRegistry());

it('buildPresetPermissions deriva permissões do SYSTEM_PRESETS a partir do JSON canônico', () => {
  // Registra actions FANTASMAS no catalog — com catalog-driven,
  // ESTES APARECEM se o módulo corresponder ao preset.
  registerActions([
    defineAction({ name: 'op.ghost', module: 'operacional', requires: 'operacional:ghost', label: 'Ghost', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'fin.ghost', module: 'financeiro', requires: 'financeiro:ghost', label: 'Ghost', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'op.real', module: 'operacional', requires: 'operacional:view', label: 'View', input: z.object({}), handler: async () => null }),
  ]);

  // ★ Deriva do SYSTEM_PRESETS (fonte: preset-policy.json) — NÃO hardcoded.
  // Este teste FALHA se presets.ts voltar a divergir do JSON canônico.
  const recepcionista = SYSTEM_PRESETS.find(p => p.name === 'Recepcionista');
  if (!recepcionista) throw new Error('Recepcionista preset ausente de SYSTEM_PRESETS');

  const keys = buildPresetPermissions(recepcionista);

  // operacional:* do catalog (incluindo ghost) são expandidos
  expect(keys).toContain('operacional:view');
  expect(keys).toContain('operacional:ghost');  // catalog-driven: ghost INCLUÍDO
  // extraKeys do JSON canônico (Recepcionista: crm:view)
  expect(keys).toContain('crm:view');
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
  // role já tem 'operacional:view'; faltam as demais permissões default do Agente
  await syncRolePermissions(mockDb, 'role-agent', DEFAULT_AGENT_PERMISSIONS);

  const keys = inserted.filter((p) => p.roleId === 'role-agent').map((p) => p.permissionKey);
  expect(keys).toContain('operacional:view');
  expect(keys).toContain('operacional:manage_appointments');
  expect(keys).toContain('atendimento:manage_messages');
  expect(keys).toContain('atendimento:manage_webhooks');
  // 4 permissões: a existente + 3 novas
  expect(keys.length).toBe(4);
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
  // requireCatalog: false — teste usa fakeDb e catálogo controlado (clearRegistry no beforeEach)
  await seedRbacForClinic('clinic-1', fakeDb, roleFinder, { requireCatalog: false });

  const agentId = existingRoles[AGENT_ROLE_NAME];
  expect(agentId).toBeDefined();
  expect(grants[agentId].sort()).toEqual([...DEFAULT_AGENT_PERMISSIONS].sort());

  // ── SIMULAÇÃO: perms críticas removidas manualmente (só sobra 'operacional:view')
  grants[agentId] = grants[agentId].filter((k) => k === 'operacional:view');
  expect(grants[agentId]).toEqual(['operacional:view']);

  // ── 2ª run (rerun do seed) — reconcilia as perms faltantes do Agente
  await seedRbacForClinic('clinic-1', fakeDb, roleFinder, { requireCatalog: false });

  // O role Agente não foi recriado (existingRoles ainda aponta para o mesmo id)
  expect(existingRoles[AGENT_ROLE_NAME]).toBe(agentId);

  // ★ contrato: as 2 perms removidas voltaram
  expect(grants[agentId]).toContain('operacional:manage_appointments');
  expect(grants[agentId]).toContain('atendimento:manage_messages');
  expect(grants[agentId].sort()).toEqual([...DEFAULT_AGENT_PERMISSIONS].sort());
});

// ─── Guard: seedRbacForClinic NÃO aceita catálogo vazio sem opt-out ──────────

it('seedRbacForClinic throws quando catálogo vazio e requireCatalog não é false', async () => {
  // clearRegistry foi chamado no beforeEach — catálogo está vazio.
  await expect(seedRbacForClinic('clinic-guard')).rejects.toThrow(
    /Catálogo de permissões vazio/,
  );
});

it('seedRbacForClinic NÃO throw quando requireCatalog é explicitamente false', async () => {
  // Fake-DB completo que suporta select + insert (catálogo vazio após clearRegistry é OK com opt-out).
  const fakeDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: async () => {},
        returning: async () => [{ id: 'r1' }],
      }),
    }),
  } as unknown as DbOrTx;

  // Com requireCatalog: false, mesmo catálogo vazio após clearRegistry não lança erro.
  await expect(
    seedRbacForClinic('clinic-guard', fakeDb, { requireCatalog: false }),
  ).resolves.toBeUndefined();
});

// ─── Administrador preset recebe permissões quando catálogo está populado ─────

it('buildPresetPermissions para Administrador retorna permissões não-vazias com catálogo populado', () => {
  // Simula catálogo populado (como após bootstrapActions)
  registerActions([
    defineAction({ name: 'op.view', module: 'operacional', requires: 'operacional:view', label: 'View Ops', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'op.appt', module: 'operacional', requires: 'operacional:manage_appointments', label: 'Appts', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'fin.view', module: 'financeiro', requires: 'financeiro:view', label: 'View Fin', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'crm.view', module: 'crm', requires: 'crm:view', label: 'View CRM', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'core.mu', module: 'core', requires: 'core:manage_users', label: 'Manage Users', input: z.object({}), handler: async () => null }),
  ]);

  const admin = SYSTEM_PRESETS.find(p => p.name === 'Administrador');
  if (!admin) throw new Error('Administrador preset ausente');

  const keys = buildPresetPermissions(admin);

  // Administrador tem módulos: core, operacional, comercial, crm, financeiro, followup, ia, atendimento
  // Com catálogo populado, deve conter permissões de todos esses módulos.
  expect(keys.length).toBeGreaterThan(0);
  expect(keys).toContain('core:manage_users');
  expect(keys).toContain('operacional:view');
  expect(keys).toContain('financeiro:view');
  expect(keys).toContain('crm:view');
});

it('buildPresetPermissions retorna apenas extraKeys com catálogo vazio', () => {
  // clearRegistry já foi chamado no beforeEach — catálogo vazio.
  // Não registramos ações adicionais aqui.
  const recepcionista = SYSTEM_PRESETS.find(p => p.name === 'Recepcionista');
  if (!recepcionista) throw new Error('Recepcionista preset ausente');

  const keys = buildPresetPermissions(recepcionista);

  // Com catálogo vazio, só extraKeys sobrevivem (crm:view para Recepcionista).
  // NÃO deve conter operacional:* (que viriam do catálogo).
  expect(keys).toContain('crm:view');
  expect(keys).not.toContain('operacional:view');
});
