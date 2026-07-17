/**
 * Unit tests: Atendimento enviarMensagemDireta action (Task 5).
 *
 * Tests direct message action without conversationId.
 */

import { enviarMensagemDireta } from '../enviar-mensagem-direta';

// Mock sendByChannel
jest.mock('../../services/send-message-service', () => ({
  sendByChannel: jest.fn(),
}));

import { sendByChannel } from '../../services/send-message-service';
const mockSendByChannel = jest.mocked(sendByChannel);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('enviarMensagemDireta', () => {
  const ctx: any = {
    clinicId: 'clinic-1',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'test' },
  };

  it('sends message to externalId without conversationId', async () => {
    mockSendByChannel.mockResolvedValue({ success: true, messageId: 'msg-1' });

    const result = await enviarMensagemDireta.handler(
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      ctx,
    );

    expect(mockSendByChannel).toHaveBeenCalledWith('whatsapp', '5511999990000', 'Olá!');
    expect(result).toEqual({ success: true, messageId: 'msg-1' });
  });

  it('rejects unsupported channel', async () => {
    await expect(
      enviarMensagemDireta.handler(
        { channel: 'telegram' as any, externalId: '5511999990000', message: 'Hi' },
        ctx,
      ),
    ).rejects.toThrow(/unsupported channel/i);
  });

  it('returns error when channel service fails', async () => {
    mockSendByChannel.mockResolvedValue({ success: false, error: 'Service unavailable' });

    const result = await enviarMensagemDireta.handler(
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      ctx,
    );

    expect(result).toEqual({ success: false, error: 'Service unavailable' });
  });
});
