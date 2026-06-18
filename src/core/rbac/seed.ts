import { getDb } from '@/lib/db/client';
import { roles, rolePermissions, permissions } from '@/lib/db/schema/rbac';
import { getPermissionCatalog } from './catalog';
import { SYSTEM_PRESETS, RESERVED_ROLE_OWNER, type PresetDef } from './presets';

export function buildPresetPermissions(preset: PresetDef): string[] {
  const catalog = getPermissionCatalog();
  const keys = new Set<string>();
  // permissões 'master:*' NUNCA entram em presets/perfis (só o principal master, por bypass).
  for (const p of catalog) if (preset.modules.includes(p.module) && !p.key.startsWith('master:')) keys.add(p.key);
  for (const k of preset.extraKeys ?? []) if (!k.startsWith('master:')) keys.add(k);
  return [...keys];
}

// Cria os perfis de sistema (incl. Owner) e suas permissões para uma clínica.
export async function seedRbacForClinic(clinicId: string): Promise<void> {
  const db = getDb();
  // espelho de permissões (idempotente)
  const catalog = getPermissionCatalog();
  if (catalog.length) {
    await db.insert(permissions).values(catalog).onConflictDoNothing();
  }
  // Owner: role reservado com todas as permissões (resolveAccess dá bypass; gravamos p/ consistência)
  const presets: Array<{ name: string; description: string; keys: string[] }> = [
    { name: RESERVED_ROLE_OWNER, description: 'Dono da clínica.', keys: catalog.map((p) => p.key).filter((k) => !k.startsWith('master:')) },
    ...SYSTEM_PRESETS.map((p) => ({ name: p.name, description: p.description, keys: buildPresetPermissions(p) })),
  ];
  for (const preset of presets) {
    const [row] = await db.insert(roles)
      .values({ clinicId, name: preset.name, description: preset.description, isSystem: true })
      .returning({ id: roles.id });
    if (preset.keys.length) {
      await db.insert(rolePermissions).values(preset.keys.map((permissionKey) => ({ roleId: row.id, permissionKey })));
    }
  }
}
