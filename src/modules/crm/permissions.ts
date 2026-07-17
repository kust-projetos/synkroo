import type { PermissionEntry } from '@/core/rbac/catalog';

export const crmPermissions = [
  'crm:view',
  'crm:manage_notes',
  'crm:manage_tags',
  'crm:review_duplicates',
  'crm:merge_patients',
  'crm:merge_leads',
] as const;

export type CrmPermission = (typeof crmPermissions)[number];

const permissionLabels: Record<CrmPermission, string> = {
  'crm:view': 'Visualizar CRM',
  'crm:manage_notes': 'Gerenciar notas de contatos',
  'crm:manage_tags': 'Gerenciar tags de contatos',
  'crm:review_duplicates': 'Revisar possíveis duplicidades',
  'crm:merge_patients': 'Mesclar pacientes duplicados',
  'crm:merge_leads': 'Mesclar leads duplicados',
};

export const crmAccessPermissions: PermissionEntry[] = crmPermissions.map(
  (key) => ({ key, module: 'crm', label: permissionLabels[key] }),
);
