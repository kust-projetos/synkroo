import { z } from 'zod';
import { defineAction, registerActions, clearRegistry } from '@/core/actions';
import { getPermissionCatalog } from '../catalog';

beforeEach(() => clearRegistry());

it('derives permission catalog from registered actions', () => {
  registerActions([
    defineAction({ name: 'op.create', module: 'op', requires: 'op:create', label: 'Criar', input: z.object({}), handler: async () => null }),
  ]);
  const cat = getPermissionCatalog();
  expect(cat).toContainEqual({ key: 'op:create', module: 'op', label: 'Criar' });
});

it('dedupes permissions shared by multiple actions', () => {
  registerActions([
    defineAction({ name: 'op.a', module: 'op', requires: 'op:read', label: 'Ver', input: z.object({}), handler: async () => null }),
    defineAction({ name: 'op.b', module: 'op', requires: 'op:read', label: 'Ver', input: z.object({}), handler: async () => null }),
  ]);
  expect(getPermissionCatalog().filter((p) => p.key === 'op:read')).toHaveLength(1);
});
