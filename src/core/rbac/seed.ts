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
  const safeKeys = keys.filter((key) => !key.startsWith('master:'));
  if (!safeKeys.length) return;
  await db
    .insert(rolePermissions)
    .values(
      safeKeys.map((permissionKey) => ({ roleId, permissionKey })),
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

export interface SeedOptions {
  /**
   * Quando `true` (default), lança erro se o catálogo de permissões estiver vazio.
   * Catálogo vazio nunca é intenção real — indica que bootstrapActions() não foi
   * chamado antes do seed. Passe `false` apenas em testes que controlam o catálogo
   * manualmente (por ex., via registerActions parciais).
   */
  requireCatalog?: boolean;
}

// Cria os perfis de sistema (incl. Owner) e suas permissões para uma clínica.
// Aceita um executor opcional (db ou tx) para permitir execução dentro da transação de signup.
// roleFinder é injetado apenas em testes; em produção usa defaultRoleFinder (Drizzle real).
export async function seedRbacForClinic(
  clinicId: string,
  executor?: DbOrTx,
  roleFinderOrOptions?: RoleFinder | SeedOptions,
  maybeOptions?: SeedOptions,
): Promise<void> {
  // Resolve roleFinder vs SeedOptions: se o 3º arg é função, é roleFinder; senão é SeedOptions.
  let roleFinder: RoleFinder | undefined;
  let opts: SeedOptions;
  if (typeof roleFinderOrOptions === 'function') {
    roleFinder = roleFinderOrOptions;
    opts = maybeOptions ?? {};
  } else {
    roleFinder = undefined;
    opts = roleFinderOrOptions ?? {};
  }

  const db = executor ?? getDb();
  const findRole = roleFinder ?? ((name: string) => defaultRoleFinder(db, clinicId, name));

  // espelho de permissões (idempotente)
  const catalog = getPermissionCatalog();
  if (opts.requireCatalog !== false && catalog.length === 0) {
    throw new Error(
      '[seedRbacForClinic] Catálogo de permissões vazio — bootstrapActions() não foi chamado. ' +
      'Nenhum perfil de sistema pode ser semeado sem catálogo. ' +
      'Se este é um teste com catálogo controlado, passe { requireCatalog: false }.',
    );
  }
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

  // Garante que permissões base referenciadas nos presets/agente existam na tabela permissions
  // antes de vincular role_permissions (evita violação de FK caso alguma chave venha de extraKeys).
  const catalogKeys = new Set(catalog.map((p) => p.key));
  const missingKeys = new Set<string>();
  for (const preset of presets) {
    for (const k of preset.keys) {
      if (!catalogKeys.has(k) && !k.startsWith('master:')) {
        missingKeys.add(k);
      }
    }
  }
  if (missingKeys.size > 0) {
    await db
      .insert(permissions)
      .values(
        [...missingKeys].map((k) => ({
          key: k,
          module: k.split(':')[0] || 'core',
          label: k,
        })),
      )
      .onConflictDoNothing();
  }

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
