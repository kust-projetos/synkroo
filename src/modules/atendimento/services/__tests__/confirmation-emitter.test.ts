jest.mock('@/lib/db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../repositories/conversations-repository', () => ({ getOrCreateConversation: jest.fn(async () => 'conv-1') }));
jest.mock('../channel-service', () => ({ sendWhatsAppMessage: jest.fn() }));
jest.mock('@/modules/operacional/public', () => ({ createConfirmationRequest: jest.fn() }));

import { getDb } from '@/lib/db/client';
import { getOrCreateConversation } from '../../repositories/conversations-repository';
import { sendWhatsAppMessage } from '../channel-service';
import { createConfirmationRequest } from '@/modules/operacional/public';
import { emitConfirmationPrompt } from '../confirmation-emitter';

const apptRow = { id: 'appt-1', clinicId: 'clinic-1', patientId: 'pat-1', scheduledAt: new Date('2030-06-10T10:00:00Z'), status: 'scheduled' };
const patientRow = { id: 'pat-1', name: 'Paciente', phone: '+5511999999999' };

let selectResults: any[] = [];
const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve(selectResults.shift() ?? [])),
      })),
    })),
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve()),
    })),
  })),
};

beforeEach(() => {
  jest.clearAllMocks();
  selectResults = [[apptRow], [patientRow]];
  (getDb as jest.Mock).mockReturnValue(mockDb);
  (getOrCreateConversation as jest.Mock).mockResolvedValue('conv-1');
  (createConfirmationRequest as jest.Mock).mockResolvedValue({
    id: 'req-1', deduped: false, appointmentScheduledAt: new Date('2030-06-10T10:00:00Z'), clinicTimezone: 'America/Sao_Paulo',
  });
});

describe('emitConfirmationPrompt', () => {
  it('envio bem-sucedido → sucesso', async () => {
    (sendWhatsAppMessage as jest.Mock).mockResolvedValue({ success: true, messageId: 'm1' });
    const r = await emitConfirmationPrompt('appt-1', 'clinic-1');
    expect(r.ok).toBe(true);
    expect((r as any).deduped).toBe(false);
    expect(sendWhatsAppMessage).toHaveBeenCalledWith('5511999999999', expect.stringContaining('Responda SIM'), 'confirmation-prompt:clinic-1:req-1');
  });

  it('success: false determinístico → não sucesso e pendência invalidada', async () => {
    (sendWhatsAppMessage as jest.Mock).mockResolvedValue({ success: false, error: 'provider_down', delivery: 'failed' });
    const r = await emitConfirmationPrompt('appt-1', 'clinic-1');
    expect(r.ok).toBe(false);
    expect((r as any).reason).toBe('send_failed');
  });

  it('delivery unknown → sem reenvio automático', async () => {
    (sendWhatsAppMessage as jest.Mock).mockResolvedValue({ success: false, delivery: 'unknown' });
    const r = await emitConfirmationPrompt('appt-1', 'clinic-1');
    expect(r.ok).toBe(false);
    expect((r as any).reason).toBe('delivery_unknown');
  });

  it('deduped → sem novo envio', async () => {
    (createConfirmationRequest as jest.Mock).mockResolvedValue({
      id: 'req-1', deduped: true, appointmentScheduledAt: new Date('2030-06-10T10:00:00Z'), clinicTimezone: 'America/Sao_Paulo',
    });
    const r = await emitConfirmationPrompt('appt-1', 'clinic-1');
    expect(r.ok).toBe(true);
    expect((r as any).deduped).toBe(true);
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it('success: false → não declarar sucesso', async () => {
    (sendWhatsAppMessage as jest.Mock).mockResolvedValue({ success: false });
    const r = await emitConfirmationPrompt('appt-1', 'clinic-1');
    expect(r.ok).toBe(false);
  });
});
