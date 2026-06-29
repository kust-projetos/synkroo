import { DEFAULT_AGENT_PERMISSIONS } from '../agent-access';

it('agent defaults cover the actions it must run (real permission keys)', () => {
  expect(DEFAULT_AGENT_PERMISSIONS).toContain('operacional:view');
  expect(DEFAULT_AGENT_PERMISSIONS).toContain('operacional:manage_appointments');
  expect(DEFAULT_AGENT_PERMISSIONS).toContain('atendimento:manage_messages');
  // não contém chaves antigas/inexistentes do primeiro draft
  expect(DEFAULT_AGENT_PERMISSIONS).not.toContain('operacional:create');
  expect(DEFAULT_AGENT_PERMISSIONS).not.toContain('operacional:confirm');
  expect(DEFAULT_AGENT_PERMISSIONS).not.toContain('atendimento:reply');
  // conservador: não inclui permissões financeiras
  expect(DEFAULT_AGENT_PERMISSIONS).not.toContain('financeiro:delete');
  expect(DEFAULT_AGENT_PERMISSIONS).not.toContain('financeiro:create');
});
