import { getPermissionCatalog, type PermissionEntry } from './catalog';

// Rótulo amigável por módulo (pt-BR). Default: capitaliza o id.
const MODULE_LABELS: Record<string, string> = {
  core: 'Configurações', operacional: 'Atendimento e agenda', comercial: 'Vendas',
  financeiro: 'Financeiro', campanhas: 'Campanhas', analytics: 'Relatórios',
};

export interface PermissionGroup { module: string; moduleLabel: string; permissions: PermissionEntry[]; }

export function getGroupedCatalog(): PermissionGroup[] {
  const byModule = new Map<string, PermissionEntry[]>();
  for (const p of getPermissionCatalog()) {
    if (!byModule.has(p.module)) byModule.set(p.module, []);
    byModule.get(p.module)!.push(p);
  }
  return [...byModule.entries()].map(([module, permissions]) => ({
    module, moduleLabel: MODULE_LABELS[module] ?? module, permissions,
  }));
}
