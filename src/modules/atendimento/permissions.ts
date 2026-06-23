import type { PermissionEntry } from '@/core/rbac/catalog';

export const atendimentoAccessPermissions: PermissionEntry[] = [
  { key: 'atendimento:view', module: 'atendimento', label: 'Visualizar atendimento' },
  { key: 'atendimento:manage_messages', module: 'atendimento', label: 'Gerenciar mensagens' },
  { key: 'atendimento:manage_conversations', module: 'atendimento', label: 'Gerenciar conversas' },
  { key: 'atendimento:manage_webhooks', module: 'atendimento', label: 'Gerenciar webhooks' },
  { key: 'atendimento:manage_templates', module: 'atendimento', label: 'Gerenciar templates' },
  { key: 'atendimento:escalate', module: 'atendimento', label: 'Escalar para humano' },
];
