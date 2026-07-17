import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { findActivityById, updateActivity } from '../repositories/activities-repository';

export const reconhecerNotificacao = defineAction({
  name: 'comercial.reconhecerNotificacao',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Reconhecer notificação',
  input: z.object({
    notificationId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const activity = await findActivityById(input.notificationId);
    if (!activity) throw new ActionError('not_found', 'Notificação não encontrada.');

    const meta = (activity.metadata ?? {}) as Record<string, unknown>;
    await updateActivity(input.notificationId, {
      metadata: { ...meta, acknowledged_at: new Date().toISOString() },
    });

    return { success: true };
  },
});
