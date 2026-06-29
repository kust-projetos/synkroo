import { getDb } from '@/lib/db/client';
import { roles, rolePermissions, permissions } from '@/modules/core/schema/rbac';
import { getPermissionCatalog } from './catalog';
import { and, eq } from 'drizzle-orm';
import { SYSTEM_PRESETS, RESERVED_ROLE_OWNER, type PresetDef } from './presets';
import { AGENT_ROLE_NAME, DEFAULT_AGENT_PERMISSIONS } from './agent-access';

// Executor aceito: o db compartilhado OU uma transação Drizzle (ambos expõem insert/select).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbOrTx = ReturnType<typeof getDb> | any;

export function buildPresetPermissions(preset: PresetDef): string[] {
  const catalog = getPermissionCatalog();
  const keys = new Set<string>();
  // permissões 'master:*' NUNCA entram em presets/perfis (só o principal master, por bypass).
  for (const p of catalog) if (preset.modules.includes(p.module) && !p.key.startsWith('master:')) keys.add(p.key);
  for (const k of preset.extraKeys ?? []) if (!k.startsWith('master:')) keys.add(k);
  return [...keys];
}

// Insere permissões de role de forma idempotente (ON CONFLICT DO NOTHING).
export async function syncRolePermissions(
  db: DbOrTx,
  roleId: string,
  keys: string[],
): Promise<void> {
  if (!keys.length) return;
  await db
    .insert(rolePermissions)
    .values(
      keys.map((permissionKey) => ({ roleId, permissionKey })),
    )
    .onConflictDoNothing();
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
    // Resolve roleId: usa existente ou cria novo
    const existing = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.clinicId, clinicId), eq(roles.name, preset.name)))
      .limit(1);

    const roleId =
      existing[0]?.id ??
      (
        await db
          .insert(roles)
          .values({
            clinicId,
            name: preset.name,
            description: preset.description,
            isSystem: true,
          })
          .returning({ id: roles.id })
      )[0].id;

    // Agente: sempre reconcilia permissões mínimas (mesmo em rerun).
    // Roles de staff existentes são preservados; o Agente é role de sistema operacional
    // que precisa receber novas permissões quando o produto evolui.
    if (preset.name === AGENT_ROLE_NAME) {
      await syncRolePermissions(db, roleId, DEFAULT_AGENT_PERMISSIONS);
      continue;
    }

    // Owner e staff: preserva roles existentes (só cria se não existir)
    if (existing.length) continue;
    await syncRolePermissions(db, roleId, preset.keys);
  }
}
