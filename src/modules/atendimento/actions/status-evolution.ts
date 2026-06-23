import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { getEvolutionService } from '@/services/whatsapp';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { whatsappInstances } from '@/lib/db/schema';

export const statusEvolution = defineAction({
  name: 'atendimento.statusEvolution',
  module: 'atendimento',
  requires: 'atendimento:view',
  label: 'Status da instância Evolution',
  input: z.object({}).optional(),
  handler: async (_input, ctx: ActionContext) => {
    const evolution = getEvolutionService();

    // Fetch instance info from DB
    const db = getDb();
    const instances = await db
      .select({
        instanceName: whatsappInstances.evolutionInstanceName,
        status: whatsappInstances.status,
        lastConnectedAt: whatsappInstances.lastConnectedAt,
        createdAt: whatsappInstances.createdAt,
      })
      .from(whatsappInstances)
      .where(eq(whatsappInstances.clinicId, ctx.clinicId))
      .limit(1);

    return {
      evolutionAvailable: evolution !== null,
      instances: instances.map((i) => ({
        instanceName: i.instanceName,
        status: i.status ?? 'unknown',
        lastConnectedAt: i.lastConnectedAt,
        createdAt: i.createdAt,
      })),
    };
  },
});
