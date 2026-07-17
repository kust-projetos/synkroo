import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listReminderConfigs, listProcedureTypes } from '../repositories/reminders-repository';

export const listarConfigsLembrete = defineAction({
  name: 'operacional.listarConfigsLembrete',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Listar configurações de lembrete',
  input: z.object({}),
  handler: async (_input, ctx: ActionContext) => {
    const [configs, procedureTypes] = await Promise.all([
      listReminderConfigs(ctx.clinicId),
      listProcedureTypes(),
    ]);
    return {
      configs: configs.map((c) => ({
        ...c,
        procedure_type_name: procedureTypes.find((pt) => pt.id === c.procedureTypeId)?.name ?? c.procedureTypeId,
      })),
    };
  },
});
