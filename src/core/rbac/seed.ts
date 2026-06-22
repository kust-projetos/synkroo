import { getDb } from '@/lib/db/client';
import { roles, rolePermissions, permissions } from '@/modules/core/schema/rbac';
import { getPermissionCatalog } from './catalog';
import { and, eq } from 'drizzle-orm';
import { SYSTEM_PRESETS, RESERVED_ROLE_OWNER, type PresetDef } from './presets';
import { AGENT_ROLE_NAME, DEFAULT_AGENT_PERMISSIONS } from './agent-access';

// Executor aceito: o db compartilhado OU uma transação Drizzle (ambos expõem insert/select).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = ReturnType<typeof getDb> | any;

export function buildPresetPermissions(preset: PresetDef): string[] {
  const catalog = getPermissionCatalog();
  const keys = new Set<string>();
  // permissões 'master:*' NUNCA entram em presets/perfis (só o principal master, por bypass).
  for (const p of catalog) if (preset.modules.includes(p.module) && !p.key.startsWith('master:')) keys.add(p.key);
  for (const k of preset.extraKeys ?? []) if (!k.startsWith('master:')) keys.add(k);
  return [...keys];
}

// Cria os perfis de sistema (incl. Owner) e suas permissões para uma clínica.
// Aceita um executor opcional (db ou tx) para permitir execução dentro da transação de signup.
export async function seedRbacForClinic(clinicId: string, executor?: DbOrTx): Promise<void> {
  const db = executor ?? getDb();
  // espelho de permissões (idempotente)
  const catalog = getPermissionCatalog();
  if (catalog.length) {
    await db.insert(permissions).values(catalog).onConflictDoNothing();
  }
  // Owner: role reservado com todas as permissões (resolveAccess dá bypass; gravamos p/ consistência)
  // Agente: role de sistema para o principal `system` (IA autônoma)
  const presets: Array<{ name: string; description: string; keys: string[] }> = [
    { name: RESERVED_ROLE_OWNER, description: 'Dono da clínica.', keys: catalog.map((p) => p.key).filter((k) => !k.startsWith('master:')) },
    { name: AGENT_ROLE_NAME, description: 'Agente de IA (autônomo).', keys: DEFAULT_AGENT_PERMISSIONS },
    ...SYSTEM_PRESETS.map((p) => ({ name: p.name, description: p.description, keys: buildPresetPermissions(p) })),
  ];
  for (const preset of presets) {
    // Idempotência: verifica se o role já existe antes de inserir
    const existing = await db.select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.clinicId, clinicId), eq(roles.name, preset.name)))
      .limit(1);
    if (existing.length) continue;

    const [row] = await db.insert(roles)
      .values({ clinicId, name: preset.name, description: preset.description, isSystem: true })
      .returning({ id: roles.id });
    if (preset.keys.length) {
      await db.insert(rolePermissions).values(preset.keys.map((permissionKey) => ({ roleId: row.id, permissionKey })));
    }
  }
}
