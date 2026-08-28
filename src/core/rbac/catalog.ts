import { getActions } from '@/core/actions/registry';

export interface PermissionEntry { key: string; module: string; label: string; }

// Permissões de acesso/visualização declaradas por módulos — idempotente por chave
const accessPermissions = new Map<string, PermissionEntry>();

export function registerAccessPermissions(entries: PermissionEntry[]): void {
  for (const e of entries) {
    if (!accessPermissions.has(e.key)) accessPermissions.set(e.key, e);
  }
}
export function clearPermissionsForTests(): void {
  accessPermissions.clear();
}

export function getPermissionCatalog(): PermissionEntry[] {
  const map = new Map<string, PermissionEntry>();
  for (const a of getActions()) {
    if (!map.has(a.requires)) map.set(a.requires, { key: a.requires, module: a.module, label: a.label });
  }
  for (const p of accessPermissions.values()) if (!map.has(p.key)) map.set(p.key, p);
  return [...map.values()];
}
