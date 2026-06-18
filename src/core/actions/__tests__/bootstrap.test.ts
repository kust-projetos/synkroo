import { bootstrapActions } from '../bootstrap';
import { getActions, clearRegistry } from '../registry';

it('registers all module actions deterministically and idempotently', () => {
  clearRegistry();
  bootstrapActions();
  const names = getActions().map((a) => a.name);
  expect(names).toContain('core.assignUserAccess');
  expect(names).toContain('master.setModuleContract');
  const count = getActions().length;
  bootstrapActions();                         // idempotente (não duplica)
  expect(getActions().length).toBe(count);
});
