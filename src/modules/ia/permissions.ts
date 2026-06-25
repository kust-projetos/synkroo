import type { PermissionEntry } from '@/core/rbac/catalog';

export const iaAccessPermissions: PermissionEntry[] = [
  { key: 'ia:chat', module: 'ia', label: 'Conversar com o Agente IA' },
  { key: 'ia:manage', module: 'ia', label: 'Gerenciar o Agente IA' },
];
