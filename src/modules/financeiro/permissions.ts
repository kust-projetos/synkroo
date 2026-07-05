import type { PermissionEntry } from '@/core/rbac/catalog';

export const financeiroAccessPermissions: PermissionEntry[] = [
  { key: 'financeiro:view', module: 'financeiro', label: 'Visualizar Financeiro' },
  { key: 'financeiro:create_budget', module: 'financeiro', label: 'Criar orçamento' },
  { key: 'financeiro:manage_budget', module: 'financeiro', label: 'Gerenciar orçamento' },
  { key: 'financeiro:record_payment', module: 'financeiro', label: 'Registrar pagamento' },
  { key: 'financeiro:manage_collections', module: 'financeiro', label: 'Gerenciar cobranças' },
  { key: 'financeiro:manage_gateways', module: 'financeiro', label: 'Gerenciar gateways' },
];
