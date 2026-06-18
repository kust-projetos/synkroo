import { getActions } from '@/core/actions';

export interface PermissionEntry { key: string; module: string; label: string; }

// Permissões de acesso/visualização declaradas por módulos (W3.4+). Vazio por enquanto.
const accessPermissions: PermissionEntry[] = [];

export function registerAccessPermissions(entries: PermissionEntry[]): void {
  accessPermissions.push(...entries);
}

export function getPermissionCatalog(): PermissionEntry[] {
  const map = new Map<string, PermissionEntry>();
  for (const a of getActions()) {
    if (!map.has(a.requires)) map.set(a.requires, { key: a.requires, module: a.module, label: a.label });
  }
  for (const p of accessPermissions) if (!map.has(p.key)) map.set(p.key, p);
  return [...map.values()];
}
