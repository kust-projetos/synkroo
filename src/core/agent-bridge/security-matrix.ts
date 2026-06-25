import type { SecurityLevel } from './types';

// Classificação explícita por action.name. Deny-by-default: o que não está
// mapeado em níveis menos restritivos cai em 'proibido' (escala humano).
// No chat interno (delegated) esta matriz NÃO se aplica: lá vale só o RBAC do usuário.
const LIVRE = new Set<string>([
  'operacional.consultarDisponibilidade',
  'operacional.listarProcedimentos',
  'operacional.obterProcedimento',
]);

const CONFIRMACAO = new Set<string>([
  'operacional.agendarConsulta',
  'operacional.confirmarConsulta',
  'operacional.entrarWaitlist',
]);

const VERIFICACAO_FORTE = new Set<string>([
  'operacional.obterPaciente',
  'operacional.atualizarPaciente',
]);

export function classifyActionLevel(actionName: string): SecurityLevel {
  if (LIVRE.has(actionName)) return 'livre';
  if (CONFIRMACAO.has(actionName)) return 'confirmacao';
  if (VERIFICACAO_FORTE.has(actionName)) return 'verificacao_forte';
  return 'proibido';
}

export interface SystemActionFlags {
  confirmed: boolean;
  identityVerified?: boolean;
}

export interface AllowResult {
  allowed: boolean;
  level: SecurityLevel;
  reason?: 'needs_confirmation' | 'needs_identity' | 'escalate_human';
}

// Enforcement server-side para source='system' (WhatsApp autônomo).
export function assertSystemAllowed(
  actionName: string,
  flags: SystemActionFlags,
): AllowResult {
  const level = classifyActionLevel(actionName);
  switch (level) {
    case 'livre':
      return { allowed: true, level };
    case 'confirmacao':
      return flags.confirmed
        ? { allowed: true, level }
        : { allowed: false, level, reason: 'needs_confirmation' };
    case 'verificacao_forte':
      return flags.identityVerified
        ? { allowed: true, level }
        : { allowed: false, level, reason: 'needs_identity' };
    case 'proibido':
    default:
      return { allowed: false, level, reason: 'escalate_human' };
  }
}
