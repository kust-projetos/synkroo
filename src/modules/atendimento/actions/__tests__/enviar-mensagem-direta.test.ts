/**
 * Unit tests: Atendimento enviarMensagemDireta action (Task 5).
 *
 * Tests direct message action without conversationId.
 *
 * E3: falha CONHECIDA do envio (`success:false`) não é sucesso — o handler
 * lança `ActionError` com mensagem segura (sem detalhe do provider).
 */

import { enviarMensagemDireta } from '../enviar-mensagem-direta';
import { ActionError } from '@/core/actions/types';

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

  it('declara contrato consequencial (tentativa auditada antes do efeito)', () => {
    expect(enviarMensagemDireta.riskClass).toBe('deny_non_human');
    expect(enviarMensagemDireta.consequential).toBe(true);
    expect(enviarMensagemDireta.auditFields).toEqual(['channel']);
  });

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

  it('known channel failure throws ActionError with a safe message (no provider detail)', async () => {
    mockSendByChannel.mockResolvedValue({
      success: false,
      error: 'WAHA provider HTTP 502: upstream session not started for device-42',
    });

    await expect(
      enviarMensagemDireta.handler(
        { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
        ctx,
      ),
    ).rejects.toThrow(ActionError);

    const err = await enviarMensagemDireta.handler(
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      ctx,
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ActionError);
    expect((err as ActionError).code).toBe('internal');
    expect((err as ActionError).message).toBe('Falha ao enviar mensagem.');
    expect((err as ActionError).message).not.toContain('WAHA');
    expect((err as ActionError).message).not.toContain('502');
    expect((err as ActionError).message).not.toContain('device-42');
  });
});
