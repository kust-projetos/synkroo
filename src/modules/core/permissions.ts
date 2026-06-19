import type { PermissionEntry } from '@/core/rbac/catalog';

export const coreAccessPermissions: PermissionEntry[] = [
  { key: 'core:view', module: 'core', label: 'Acessar configurações' },
  { key: 'core:manage_users', module: 'core', label: 'Gerenciar usuários e acessos' },
];
