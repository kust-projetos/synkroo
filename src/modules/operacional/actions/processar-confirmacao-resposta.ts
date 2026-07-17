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
    clinicId: z.string(),
    patientPhone: z.string(),
    message: z.string(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const result = await processConfirmationResponse(input.clinicId, input.patientPhone, input.message);
    return result;
  },
});
