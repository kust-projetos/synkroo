import { getDb } from '@/lib/db/client';
import { instanceModules } from '@/lib/db/schema/modules';
import { eq } from 'drizzle-orm';

export interface ModuleManifestRepo { getEnabledModuleIds(): Promise<string[]>; }

export interface ModuleManifest {
  isEnabled(moduleId: string): Promise<boolean>;
  enabledModules(): Promise<Set<string>>;   // contratados ∪ always-on
}

// Módulos sempre ativos (não desativáveis), independentes da contratação no banco.
export const ALWAYS_ON_MODULES = new Set<string>(['core']);

export function makeManifest(repo: ModuleManifestRepo): ModuleManifest {
  let cache: Set<string> | null = null;
  async function load(): Promise<Set<string>> {
    if (!cache) cache = new Set([...ALWAYS_ON_MODULES, ...(await repo.getEnabledModuleIds())]);
    return cache;
  }
  return {
    async isEnabled(moduleId) { return (await load()).has(moduleId); },
    async enabledModules() { return new Set(await load()); },
  };
}

export const drizzleManifestRepo: ModuleManifestRepo = {
  async getEnabledModuleIds() {
    const rows = await getDb().select({ id: instanceModules.moduleId })
      .from(instanceModules).where(eq(instanceModules.enabled, true));
    return rows.map((r) => r.id);
  },
};

// Instância padrão (uma por request; criar nova quando precisar invalidar cache).
export const moduleManifest = makeManifest(drizzleManifestRepo);
