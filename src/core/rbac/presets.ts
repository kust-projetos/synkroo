// 'Owner' é role reservado (bypass total via resolveAccess); aqui só nomeamos.
export const RESERVED_ROLE_OWNER = 'Owner';

export interface PresetDef {
  name: string;
  description: string;
  // critério de inclusão de permissão: por módulos liberados e/ou keys explícitas.
  modules: string[];          // libera todas as permissões desses módulos (via modulePermissions)
  extraKeys?: string[];       // permissões avulsas adicionais
}

export interface PermissionEntry {
  key: string;
  module: string;
  label: string;
}

interface PolicyFile {
  version: string;
  modulePermissions: Record<string, PermissionEntry[]>;
  presets: PresetDef[];
  reservedRole: string;
  agentRoleName: string;
  agentPermissions: string[];
  owner: {
    excludePrefixes: string[];
    includeModules: string[];
  };
}

// Importa o preset-policy.json como fonte canônica via import direto (não fs.readFile).
// O JSON é a única fonte de verdade; presets.ts deriva os presets dinamicamente.
// resolveJsonModule: true no tsconfig permite import de arquivos .json.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const policy: PolicyFile = require('@/core/rbac/preset-policy.json');

export const SYSTEM_PRESETS: PresetDef[] = policy.presets;

/**
 * modulePermissions é a fonte canônica de PermissionEntry por módulo.
 * Cada entrada contém {key, module, label} conforme a tabela `permissions` no DB.
 * Presets derivam seus grants a partir daqui (não do runtime action registry).
 */
export const MODULE_PERMISSIONS: Readonly<Record<string, ReadonlyArray<PermissionEntry>>> = policy.modulePermissions;

/**
 * Deriva a lista de permission keys de um preset a partir do JSON canônico:
 *   - Para cada `module` em `preset.modules`, coleta as `.key` de cada PermissionEntry.
 *   - Adiciona `preset.extraKeys` verbatim.
 *   - Filtra `master:*` (nunca atribuído a presets/perfis).
 * Retorna lista deduplicada, ordem estável.
 */
export function getPresetPermissionKeys(preset: PresetDef): string[] {
  const keys = new Set<string>();
  for (const mod of preset.modules) {
    const entries = policy.modulePermissions[mod] ?? [];
    for (const entry of entries) keys.add(entry.key);
  }
  for (const k of preset.extraKeys ?? []) {
    if (!k.startsWith('master:')) keys.add(k);
  }
  return [...keys];
}

export function getPolicyOwner(): PolicyFile['owner'] {
  return policy.owner;
}

export function getPolicyReservedRole(): string {
  return policy.reservedRole;
}

export function getPolicyAgentRoleName(): string {
  return policy.agentRoleName;
}

export function getPolicyAgentPermissions(): string[] {
  return policy.agentPermissions;
}
