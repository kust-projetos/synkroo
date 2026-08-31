import { buildUserContext, buildDelegatedContext, buildSystemContext, buildCronContext } from '../context';

const rbac = {
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

it('buildCronContext: explicit allowlist with no agent-role permissions', async () => {
  const ctx = await buildCronContext('clinic-a', {
    manifest: { enabledModules: async () => new Set(['followup']) },
  });
  expect(ctx.source).toBe('system');
  expect(ctx.clinicId).toBe('clinic-a');
  expect(ctx.can('followup:manage_followups')).toBe(true);
  expect(ctx.can('followup:manage_campaigns')).toBe(true);
  expect(ctx.can('financeiro:view')).toBe(false);
  expect(ctx.can('operacional:create')).toBe(false);
  expect(ctx.audit.actor).toBe('cron');
});

it('buildCronContext: uses fixed allowlist, not caller-supplied permissions', async () => {
  const ctx = await buildCronContext('clinic-b', {
    manifest: { enabledModules: async () => new Set(['followup']) },
  });
  // Fixed allowlist only: followup:manage_followups + followup:manage_campaigns
  // No agent-role permissions are loaded
  expect(ctx.can('followup:manage_followups')).toBe(true);
  expect(ctx.can('followup:manage_campaigns')).toBe(true);
  expect(ctx.can('financeiro:view')).toBe(false);
  expect(ctx.can('operacional:create')).toBe(false);
  expect(ctx.can('agent:delegate')).toBe(false);
});
