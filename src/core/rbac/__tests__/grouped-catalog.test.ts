import { z } from 'zod';
import { defineAction, registerActions, clearRegistry } from '@/core/actions';
import { getGroupedCatalog } from '../grouped-catalog';

beforeEach(() => clearRegistry());

it('groups permissions by module with friendly labels', () => {
  registerActions([
    defineAction({ name: 'op.create', module: 'operacional', requires: 'operacional:create', label: 'Criar agendamento', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'op.cancel', module: 'operacional', requires: 'operacional:cancel', label: 'Cancelar agendamento', input: z.object({}), handler: async () => null }),
  ]);
  const groups = getGroupedCatalog();
  const op = groups.find((g) => g.module === 'operacional')!;
  expect(op.permissions.map((p) => p.label)).toEqual(['Criar agendamento', 'Cancelar agendamento']);
});
