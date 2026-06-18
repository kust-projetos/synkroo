import { buildUserContext, buildDelegatedContext, buildSystemContext } from '../context';

const rbac = {
  isMaster: async () => false,
  getAccess: async () => ({ roleId: 'r', roleName: 'Recepcionista', isSystem: true }),
  getRolePermissions: async () => ['operacional:create'],
  getOverrides: async () => [],
};
const manifest = { enabledModules: async () => new Set(['operacional']) };

it('buildUserContext: user principal with can/hasModule and audit', async () => {
  const ctx = await buildUserContext('clinic-1', {
    loadProfile: async () => ({ id: 'u1', email: 'a@b.c', name: 'A', clinic_id: 'clinic-1' } as any),
    rbac, manifest,
  });
  expect(ctx.source).toBe('user');
  expect(ctx.clinicId).toBe('clinic-1');
  expect(ctx.can('operacional:create')).toBe(true);
  expect(ctx.hasModule('operacional')).toBe(true);  // hasModule é síncrono (Set pré-resolvido)
  expect(ctx.audit.actor).toBe('u1');
});

it('buildDelegatedContext: agent on behalf of staff, uses delegate permissions', async () => {
  const ctx = await buildDelegatedContext('u1', 'clinic-1', { rbac, manifest });
  expect(ctx.source).toBe('agent_delegated');
  expect(ctx.audit).toEqual({ actor: 'agente', onBehalfOf: 'u1' });
  expect(ctx.can('operacional:create')).toBe(true);
});

it('buildSystemContext: no user, agent permission set', async () => {
  const ctx = await buildSystemContext('clinic-1', {
    manifest, agentAccess: { getAgentPermissions: async () => ['operacional:create'] },
  });
  expect(ctx.source).toBe('system');
  expect(ctx.user).toBeUndefined();
  expect(ctx.can('operacional:create')).toBe(true);
  expect(ctx.can('financeiro:delete')).toBe(false);
  expect(ctx.audit.actor).toBe('agente (sistema)');
});
