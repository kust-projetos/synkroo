import { z } from 'zod';
import { defineAction, registerActions, clearRegistry } from '@/core/actions';
import { buildPresetPermissions } from '../seed';

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
