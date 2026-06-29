// 'Owner' é role reservado (bypass total via resolveAccess); aqui só nomeamos.
export const RESERVED_ROLE_OWNER = 'Owner';

export interface PresetDef {
  name: string;
  description: string;
  // critério de inclusão de permissão: por módulos liberados e/ou keys explícitas.
  modules: string[];          // libera todas as permissões desses módulos
  extraKeys?: string[];       // permissões avulsas adicionais
}

// Presets conservadores; ajustáveis pelo owner depois (clonando).
export const SYSTEM_PRESETS: PresetDef[] = [
  { name: 'Administrador', description: 'Acesso amplo de gestão da clínica.',
    modules: ['core', 'operacional', 'atendimento', 'comercial', 'financeiro', 'analytics', 'followup', 'ia'] },
  { name: 'Recepcionista', description: 'Atendimento e agenda.',
    modules: ['operacional', 'atendimento'], extraKeys: ['comercial:view', 'ia:chat'] },
  { name: 'Comercial', description: 'Vendas e relacionamento.',
    modules: ['comercial', 'followup'], extraKeys: ['operacional:view'] },
  { name: 'Dentista', description: 'Agenda e prontuário próprios.',
    modules: ['operacional', 'atendimento'], extraKeys: ['followup:view', 'ia:chat'] },
];
