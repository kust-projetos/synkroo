import type { PermissionEntry } from '@/core/rbac/catalog';

export const followupAccessPermissions: PermissionEntry[] = [
  { key: 'followup:view', module: 'followup', label: 'Visualizar follow-up' },
  { key: 'followup:manage_followups', module: 'followup', label: 'Gerenciar follow-ups' },
  { key: 'followup:manage_campaigns', module: 'followup', label: 'Gerenciar campanhas' },
  { key: 'followup:manage_segments', module: 'followup', label: 'Gerenciar segmentos' },
];
