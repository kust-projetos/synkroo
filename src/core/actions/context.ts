import type { ActionContext } from './types';
import { resolveAccess } from '@/core/rbac/resolve';
import { drizzleRbacRepo, type RbacRepo } from '@/core/rbac/repository';
import { drizzleAgentAccessRepo, type AgentAccessRepo } from '@/core/rbac/agent-access';
import { drizzleManifestRepo, makeManifest } from '@/core/modules/manifest';
import { getUserProfile } from '@/lib/auth/session';

// hasModule é síncrono: pré-resolvemos o conjunto de módulos habilitados uma vez
// (contratados ∪ always-on) direto do manifesto — independe do registry de Actions.
interface ManifestLike { enabledModules(): Promise<Set<string>>; }

interface UserDeps { loadProfile?: () => Promise<any>; rbac?: RbacRepo; manifest?: ManifestLike; }

export async function buildUserContext(activeClinicId?: string, deps: UserDeps = {}): Promise<ActionContext> {
  const loadProfile = deps.loadProfile ?? getUserProfile;
  const rbac = deps.rbac ?? drizzleRbacRepo;
  const manifest = deps.manifest ?? makeManifest(drizzleManifestRepo);

  const profile = await loadProfile();
  if (!profile) throw new Error('unauthenticated');
  const clinicId = activeClinicId ?? profile.clinic_id;
  const access = await resolveAccess(profile.id, clinicId, rbac);
  const mods = await manifest.enabledModules();

  return {
    source: 'user', clinicId,
    user: { id: profile.id, email: profile.email, name: profile.name },
    role: access.role ?? undefined,
    can: access.can,
    hasModule: (id) => mods.has(id),
    audit: { actor: profile.id },
  };
}

interface DelegatedDeps { rbac?: RbacRepo; manifest?: ManifestLike; }

export async function buildDelegatedContext(userId: string, clinicId: string, deps: DelegatedDeps = {}): Promise<ActionContext> {
  const rbac = deps.rbac ?? drizzleRbacRepo;
  const manifest = deps.manifest ?? makeManifest(drizzleManifestRepo);
  const access = await resolveAccess(userId, clinicId, rbac);
  const mods = await manifest.enabledModules();
  return {
    source: 'agent_delegated', clinicId,
    user: { id: userId, email: '', name: '' },
    role: access.role ?? undefined,
    can: access.can,
    hasModule: (id) => mods.has(id),
    audit: { actor: 'agente', onBehalfOf: userId },
  };
}

interface SystemDeps { manifest?: ManifestLike; agentAccess?: AgentAccessRepo; }

export async function buildSystemContext(clinicId: string, deps: SystemDeps = {}): Promise<ActionContext> {
  const manifest = deps.manifest ?? makeManifest(drizzleManifestRepo);
  const agentAccess = deps.agentAccess ?? drizzleAgentAccessRepo;
  const perms = new Set(await agentAccess.getAgentPermissions(clinicId));
  const mods = await manifest.enabledModules();
  return {
    source: 'system', clinicId,
    can: (key) => perms.has(key),
    hasModule: (id) => mods.has(id),
    audit: { actor: 'agente (sistema)' },
  };
}
