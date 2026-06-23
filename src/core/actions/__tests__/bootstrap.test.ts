import { bootstrapActions, resetBootstrapForTests } from '../bootstrap';
import { getActions, clearRegistry } from '../registry';

beforeEach(() => {
  clearRegistry();
  resetBootstrapForTests();
});

it('registers all core actions deterministically and idempotently', async () => {
  await bootstrapActions();
  const names = getActions().map((a) => a.name);
  expect(names).toEqual(expect.arrayContaining([
    'core.assignUserAccess',
    'core.createRole',
    'master.setModuleContract',
    'core.listClinicUsers',
    'core.listClinicRoles',
    'core.removeUserAccess',
    'core.deactivateUser',
  ]));
  const count = getActions().length;
  await bootstrapActions();
  expect(getActions().length).toBe(count);
});

it('registers all operacional actions', async () => {
  await bootstrapActions();
  const names = getActions().map((a) => a.name);
  expect(names).toContain('operacional.agendarConsulta');
  expect(names).toContain('operacional.confirmarConsulta');
  expect(names).toContain('operacional.listarPacientes');
  expect(names).toContain('operacional.consultarDisponibilidade');
  expect(names).toContain('operacional.criarDentista');
  expect(names).toContain('operacional.listarDentistas');
  expect(names).toContain('operacional.listarWaitlist');
  expect(names).toContain('operacional.listarConfigsLembrete');
});

it('registers followup access permissions in the catalog', async () => {
  await bootstrapActions();
  const { getPermissionCatalog } = await import('@/core/rbac/catalog');
  const catalog = getPermissionCatalog();
  const keys = catalog.map((p) => p.key);
  expect(keys).toContain('followup:view');
  expect(keys).toContain('followup:manage_followups');
  expect(keys).toContain('followup:manage_campaigns');
  expect(keys).toContain('followup:manage_segments');
});

it('registers atendimento access permissions in the catalog', async () => {
  await bootstrapActions();
  const { getPermissionCatalog } = await import('@/core/rbac/catalog');
  const catalog = getPermissionCatalog();
  const keys = catalog.map((p) => p.key);
  expect(keys).toContain('atendimento:view');
  expect(keys).toContain('atendimento:manage_messages');
  expect(keys).toContain('atendimento:manage_conversations');
  expect(keys).toContain('atendimento:manage_webhooks');
  expect(keys).toContain('atendimento:manage_templates');
  expect(keys).toContain('atendimento:escalate');
});

it('registers operacional access permissions in the catalog', async () => {
  await bootstrapActions();
  const { getPermissionCatalog } = await import('@/core/rbac/catalog');
  const catalog = getPermissionCatalog();
  const keys = catalog.map((p) => p.key);
  expect(keys).toContain('operacional:view');
  expect(keys).toContain('operacional:manage_appointments');
  expect(keys).toContain('operacional:manage_patients');
  expect(keys).toContain('operacional:manage_catalog');
  expect(keys).toContain('operacional:manage_waitlist');
  expect(keys).toContain('operacional:manage_reminders');
});

it('is idempotent for both core and operacional', async () => {
  await bootstrapActions();
  const count1 = getActions().length;
  await bootstrapActions();
  const count2 = getActions().length;
  expect(count2).toBe(count1);
});
