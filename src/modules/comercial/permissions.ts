import type { PermissionEntry } from '@/core/rbac/catalog';

export const comercialAccessPermissions: PermissionEntry[] = [
  { key: 'comercial:view', module: 'comercial', label: 'Visualizar Comercial' },
  { key: 'comercial:capture_leads', module: 'comercial', label: 'Capturar leads' },
  { key: 'comercial:edit_leads', module: 'comercial', label: 'Editar leads' },
  { key: 'comercial:manage_pipeline', module: 'comercial', label: 'Gerenciar pipeline' },
  { key: 'comercial:manage_tasks', module: 'comercial', label: 'Gerenciar tasks' },
  { key: 'comercial:manage_hot_leads', module: 'comercial', label: 'Gerenciar leads quentes' },
];
