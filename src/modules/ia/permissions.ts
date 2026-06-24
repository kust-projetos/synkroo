import type { PermissionEntry } from '@/core/rbac/catalog';

export const iaAccessPermissions: PermissionEntry[] = [
  { key: 'ia:chat', module: 'ia', label: 'Usar chat IA' },
  { key: 'ia:manage', module: 'ia', label: 'Gerenciar IA' },
];
