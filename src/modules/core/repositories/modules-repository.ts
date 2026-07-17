import { getDb } from '@/lib/db/client';
import { instanceModules } from '@/lib/db/schema/modules';

export async function setModuleContract(input: { moduleId: string; enabled: boolean }) {
  await getDb().insert(instanceModules)
    .values({ moduleId: input.moduleId, enabled: input.enabled, contractedAt: new Date() })
    .onConflictDoUpdate({
      target: instanceModules.moduleId,
      set: { enabled: input.enabled, updatedAt: new Date() },
    });
}
