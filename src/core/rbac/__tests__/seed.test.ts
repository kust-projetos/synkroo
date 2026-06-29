import { z } from 'zod';
import { defineAction, registerActions, clearRegistry } from '@/core/actions';
import { buildPresetPermissions } from '../seed';
import { AGENT_ROLE_NAME, DEFAULT_AGENT_PERMISSIONS } from '../agent-access';

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
