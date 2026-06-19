import type { RbacRepo } from './repository';
import { RESERVED_ROLE_OWNER } from './presets';

export interface ResolvedAccess {
  role: string | null;          // 'master' | 'owner' | nome do perfil | null
  can: (permissionKey: string) => boolean;
}

export async function resolveAccess(userId: string, clinicId: string, repo: RbacRepo): Promise<ResolvedAccess> {
  if (await repo.isMaster(userId)) return { role: 'master', can: () => true };

  const access = await repo.getAccess(userId, clinicId);
  if (!access) return { role: null, can: () => false };

  if (access.isSystem && access.roleName === RESERVED_ROLE_OWNER) {
    // owner: acesso total na instância, MAS nunca permissões reservadas ao master.
    return { role: 'owner', can: (key) => !key.startsWith('master:') };
  }

  const perms = new Set(await repo.getRolePermissions(access.roleId));
  const overrides = new Map((await repo.getOverrides(userId, clinicId)).map((o) => [o.permissionKey, o.granted]));

  return {
    role: access.roleName,
    can: (key) => (overrides.has(key) ? overrides.get(key)! : perms.has(key)),
  };
}
