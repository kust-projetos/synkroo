import { syncRolePermissions, type DbOrTx } from '../seed';

it('syncRolePermissions inserts keys with onConflictDoNothing (idempotent)', async () => {
  const inserted: Array<{ roleId: string; permissionKey: string }> = [];
  const mockDb = {
    insert: () => ({
      values: (vals: unknown) => {
        const rows = Array.isArray(vals) ? vals : [vals];
        for (const row of rows as Array<{ roleId: string; permissionKey: string }>) {
          inserted.push(row);
        }
        return { onConflictDoNothing: async () => undefined };
      },
    }),
  } as unknown as DbOrTx;

  await syncRolePermissions(mockDb, 'role-1', ['perm:a', 'perm:b']);
  expect(inserted).toHaveLength(2);
  expect(inserted[0]).toEqual({ roleId: 'role-1', permissionKey: 'perm:a' });
  expect(inserted[1]).toEqual({ roleId: 'role-1', permissionKey: 'perm:b' });
});

it('syncRolePermissions skips empty key list', async () => {
  const mockDb = { insert: () => { throw new Error('should not be called'); } } as unknown as DbOrTx;
  await expect(syncRolePermissions(mockDb, 'role-1', [])).resolves.toBeUndefined();
});
