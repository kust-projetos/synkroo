import type { PermissionEntry } from '@/core/rbac/catalog';

export const operacionalAccessPermissions: PermissionEntry[] = [
  { key: 'operacional:view', module: 'operacional', label: 'Visualizar operacional' },
  { key: 'operacional:manage_appointments', module: 'operacional', label: 'Gerenciar consultas' },
  { key: 'operacional:manage_patients', module: 'operacional', label: 'Gerenciar pacientes' },
  { key: 'operacional:manage_catalog', module: 'operacional', label: 'Gerenciar catálogo' },
  { key: 'operacional:manage_waitlist', module: 'operacional', label: 'Gerenciar lista de espera' },
  { key: 'operacional:manage_reminders', module: 'operacional', label: 'Gerenciar lembretes' },
];
