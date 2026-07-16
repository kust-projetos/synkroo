import { getDb } from '@/lib/db/client';
import { roles, rolePermissions, permissions } from '@/modules/core/schema/rbac';
import { getPermissionCatalog } from './catalog';
import { and, eq } from 'drizzle-orm';
import { SYSTEM_PRESETS, RESERVED_ROLE_OWNER, type PresetDef } from './presets';
import { AGENT_ROLE_NAME, DEFAULT_AGENT_PERMISSIONS } from './agent-access';

// Executor aceito: o db compartilhado OU uma transação Drizzle (ambos expõem insert/select).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbOrTx = ReturnType<typeof getDb> | any;

/**
 * Deriva permission keys de um preset a partir do RUNTIME CATALOG.
 *   - Expande `preset.modules` via `getPermissionCatalog()` (action registry),
 *     filtrando `master:*`.
 *   - Adiciona `preset.extraKeys` verbatim do JSON policy.
 *
 * O backfill (scripts/backfill-rbac-permissions.mjs) usa o mesmo padrão,
 * mas contra a tabela DB `permissions` (seed policy → permissions → query).
 * Ambos expandem módulos do catálogo — seed usa runtime, backfill usa DB.
 */
export function buildPresetPermissions(preset: PresetDef): string[] {
  const catalog = getPermissionCatalog();
  const keys = new Set<string>();
  for (const p of catalog) {
    if (preset.modules.includes(p.module) && !p.key.startsWith('master:')) keys.add(p.key);
  }
  for (const k of preset.extraKeys ?? []) {
    if (!k.startsWith('master:')) keys.add(k);
  }
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

// Lookup de role por nome — injetável para testes (evita fake do AST do Drizzle).
export type RoleFinder = (name: string) => Promise<string | null>;

async function defaultRoleFinder(db: DbOrTx, clinicId: string, name: string): Promise<string | null> {
  const existing = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.clinicId, clinicId), eq(roles.name, name)))
    .limit(1);
  return existing[0]?.id ?? null;
}

// Cria os perfis de sistema (incl. Owner) e suas permissões para uma clínica.
// Aceita um executor opcional (db ou tx) para permitir execução dentro da transação de signup.
// roleFinder é injetado apenas em testes; em produção usa defaultRoleFinder (Drizzle real).
export async function seedRbacForClinic(
  clinicId: string,
  executor?: DbOrTx,
  roleFinder?: RoleFinder,
): Promise<void> {
  const db = executor ?? getDb();
  const findRole = roleFinder ?? ((name: string) => defaultRoleFinder(db, clinicId, name));

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
    const existingId = await findRole(preset.name);

    const roleId =
      existingId ??
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
    if (existingId) continue;
    await syncRolePermissions(db, roleId, preset.keys);
  }
}
