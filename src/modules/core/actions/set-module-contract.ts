import { z } from 'zod';
import { defineAction } from '@/core/actions';
import { getDb } from '@/lib/db/client';
import { instanceModules } from '@/lib/db/schema/modules';

// Master-only: contrata/desativa um módulo na instância.
export const setModuleContract = defineAction({
  name: 'master.setModuleContract',
  module: 'core',
  requires: 'master:manage_modules',
  label: 'Contratar/desativar módulo (fornecedor)',
  input: z.object({ moduleId: z.string(), enabled: z.boolean() }),
  handler: async (input) => {
    await getDb().insert(instanceModules)
      .values({ moduleId: input.moduleId, enabled: input.enabled, contractedAt: new Date() })
      .onConflictDoUpdate({ target: instanceModules.moduleId, set: { enabled: input.enabled, updatedAt: new Date() } });
    return { ok: true };
  },
});
