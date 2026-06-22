import { bootstrapActions } from '../bootstrap';
import { getActions, clearRegistry } from '../registry';

it('registers all core actions deterministically and idempotently', async () => {
  clearRegistry();
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
