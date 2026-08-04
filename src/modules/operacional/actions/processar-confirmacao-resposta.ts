import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { processConfirmationResponse } from '@/services/appointments/confirmation-handler.service';

export const processarConfirmacaoResposta = defineAction({
  name: 'operacional.processarConfirmacaoResposta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Processar resposta de confirmação via WhatsApp',
  input: z.object({
    patientPhone: z.string().min(8),
    message: z.string().min(1),
  }).strict(),
  handler: async (input, ctx: ActionContext) => {
    const result = await processConfirmationResponse(ctx.clinicId, input.patientPhone, input.message);
    return result;
  },
});
