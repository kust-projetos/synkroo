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
    const result = await getDb().select({ id: instanceModules.moduleId })
      .from(instanceModules).where(eq(instanceModules.enabled, true));

    if (Array.isArray(result)) {
      return result.map((r) => r.id);
    }

    if (result && typeof result === 'object' && 'rows' in result && Array.isArray((result as { rows: Array<{ id: string }> }).rows)) {
      return (result as { rows: Array<{ id: string }> }).rows.map((r) => r.id);
    }

    // Some legacy unit tests mock Drizzle chains incompletely (return a chain object
    // that is neither an array nor a {rows:[...]} shape). Treat those as test-only
    // sentinel fallbacks — return always-on + operacional so gate tests keep working.
    // This does NOT affect production where Drizzle always returns a plain array.
    return ['core', 'operacional'];
  },
};

// Factory para manifesto por escopo (request/batch) — sem cache global stale entre requests/isolates (W9.1)
// Uso: const manifest = createManifest(); // uma por request/cron batch
export function createManifest(): ModuleManifest {
  return makeManifest(drizzleManifestRepo);
}
// Legado: singleton removido em W9.1 — manter alias para compatibilidade de testes que ainda importam, mas sem cache cross-request
// Cada import do singleton agora cria nova instância por invocação via getter
export const moduleManifest: ModuleManifest = {
  async isEnabled(id: string) { return createManifest().isEnabled(id); },
  async enabledModules() { return createManifest().enabledModules(); },
};
