import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { appointments } from '@/lib/db/schema';

export const gatilhoLembrete = defineAction({
  name: 'operacional.gatilhoLembrete',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Gatilhar lembrete manual',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) => {
    const db = getDb();
    const [appt] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.id, input.id), eq(appointments.clinicId, ctx.clinicId)))
      .limit(1);
    if (!appt) throw new ActionError('not_found', 'Agendamento não encontrado.');
    await db.update(appointments).set({ reminderSentAt: new Date() }).where(eq(appointments.id, input.id));
    return { success: true };
  },
});
