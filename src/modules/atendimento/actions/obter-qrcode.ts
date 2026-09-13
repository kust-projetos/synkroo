import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { getWhatsAppService } from '../services/channel-service';
import { getEvolutionService } from '../services/evolution-service';

export const obterQRCode = defineAction({
  name: 'atendimento.obterQRCode',
  module: 'atendimento',
  requires: 'atendimento:view',
  label: 'Obter QR code do WhatsApp',
  input: z.object({}).optional(),
  handler: async (_input: unknown, _ctx: ActionContext) => {
    // T7 3.2: retorna QR real quando provedor disponível, sem enfraquecer auth (requires: atendimento:view mantido)
    // Provider Evolution (API) tem prioridade; fallback Playwright sidecar quando Evolution não configurado
    try {
      const evolution = getEvolutionService();
      if (evolution) {
        const qr = await evolution.getQRCode().catch(() => null);
        if (qr && (qr.base64 || qr.code)) {
          const base64 = qr.base64 || qr.code;
          // Normaliza para data URL se vier sem prefixo
          const qrcode = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
          return { qrcode, qrcode_available: true, connected: false, provider: 'evolution' as const };
        }
        const state = await evolution.getConnectionState().catch(() => null);
        if (state?.state === 'open') {
          return { qrcode: null, qrcode_available: false, connected: true, provider: 'evolution' as const };
        }
        // Evolution configurado mas sem QR — cai no fallback se houver
      }
    } catch {
      // Evolution falhou, tenta fallback
    }

    try {
      const service = getWhatsAppService();
      const qrcode = await service.getQRCode().catch(() => null);
      const connected = service.isConnected;
      if (qrcode) {
        // Sidecar já retorna data URL (ops/vps/whatsapp-sidecar/src/server.ts:54)
        return { qrcode, qrcode_available: true, connected, provider: 'playwright' as const };
      }
      return { qrcode: null, qrcode_available: false, connected, provider: 'playwright' as const };
    } catch {
      return { qrcode: null, qrcode_available: false, connected: false, provider: 'playwright' as const };
    }
  },
});
