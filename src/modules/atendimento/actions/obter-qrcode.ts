import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { getWhatsAppService } from '@/services/whatsapp';

export const obterQRCode = defineAction({
  name: 'atendimento.obterQRCode',
  module: 'atendimento',
  requires: 'atendimento:view',
  label: 'Obter QR code do WhatsApp',
  input: z.object({}).optional(),
  handler: async (_input: unknown, _ctx: ActionContext) => {
    const service = getWhatsAppService();
    // The Playwright service stores the last QR code; return it
    return { qrcode_available: service?.isConnected === false };
  },
});
