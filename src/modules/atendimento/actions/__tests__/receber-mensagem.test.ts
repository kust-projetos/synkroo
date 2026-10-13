import { ActionError } from '@/core/actions/types';

jest.mock('../../repositories/conversations-repository', () => ({
  persistInboundMessage: jest.fn(),
}));

import { persistInboundMessage } from '../../repositories/conversations-repository';
import { receberMensagem } from '../receber-mensagem';

const systemCtx = {
  source: 'system' as const,
  clinicId: 'clinic-1',
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'webhook' },
};

const validInput = {
  externalConversationId: '5511999999999',
  externalProvider: 'waha',
  externalMessageId: 'default:msg-1',
  message: 'Olá',
  channel: 'whatsapp' as const,
  messageType: 'text' as const,
};

describe('receberMensagem — channel Zod contract (T2)', () => {
  const base = {
    externalConversationId: 'sender-1',
    externalProvider: 'instagram',
    externalMessageId: 'mid-1',
    message: 'Olá',
    messageType: 'text' as const,
  };

  it('accepts whatsapp', () => {
    const parsed = receberMensagem.input.safeParse({ ...base, channel: 'whatsapp' });
    expect(parsed.success).toBe(true);
  });

  it('accepts instagram (T2)', () => {
    const parsed = receberMensagem.input.safeParse({ ...base, channel: 'instagram' });
    expect(parsed.success).toBe(true);
  });

  it('accepts web', () => {
    const parsed = receberMensagem.input.safeParse({ ...base, channel: 'web' });
    expect(parsed.success).toBe(true);
  });

  it('rejects telegram (not in enum)', () => {
    const parsed = receberMensagem.input.safeParse({ ...base, channel: 'telegram' });
    expect(parsed.success).toBe(false);
  });

  it('rejects bypass via cast — empty channel', () => {
    const parsed = receberMensagem.input.safeParse({ ...base, channel: '' });
    expect(parsed.success).toBe(false);
  });

  it('rejects missing channel', () => {
    const { channel: _omit, ...withoutChannel } = { ...base, channel: 'instagram' as const };
    const parsed = receberMensagem.input.safeParse(withoutChannel);
    expect(parsed.success).toBe(false);
  });

  it('rejects channel with wrong type (number)', () => {
    const parsed = receberMensagem.input.safeParse({ ...base, channel: 123 as unknown as string });
    expect(parsed.success).toBe(false);
  });
});

describe('receberMensagem — persistence failure sanitization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes a successful persistence result through untouched', async () => {
    jest.mocked(persistInboundMessage).mockResolvedValue({
      deduped: false,
      conversationId: 'conv-1',
      messageId: 'msg-1',
    });

    await expect(receberMensagem.handler(validInput as never, systemCtx as never))
      .resolves.toEqual({ deduped: false, conversationId: 'conv-1', messageId: 'msg-1' });
  });

  it('wraps a persistence exception in an ActionError without cause and without raw content', async () => {
    const marker = 'MARKER-leak-5511999999999-Ola-contato-default';
    jest.mocked(persistInboundMessage).mockRejectedValue(
      new Error(`insert failed for 5511999999999 / Olá / default :: ${marker}`),
    );

    const thrown = await receberMensagem.handler(validInput as never, systemCtx as never)
      .then(() => null, (e) => e as Error);

    expect(thrown).toBeInstanceOf(ActionError);
    expect((thrown as ActionError).code).toBe('internal');
    // Fixed generic message — no phone, body, session or marker.
    expect(thrown?.message).toBe('Falha ao persistir mensagem inbound.');
    expect(thrown?.message).not.toContain(marker);
    expect(thrown?.message).not.toContain('5511999999999');
    expect(thrown?.message).not.toContain('default');
    // No cause chaining: the original DB error must not be reachable.
    expect((thrown as { cause?: unknown }).cause).toBeUndefined();
  });

  it('does not leak a non-Error rejection value either', async () => {
    jest.mocked(persistInboundMessage).mockRejectedValue('raw-string-rejection-with-marker');

    const thrown = await receberMensagem.handler(validInput as never, systemCtx as never)
      .then(() => null, (e) => e as Error);

    expect(thrown).toBeInstanceOf(ActionError);
    expect(JSON.stringify({ message: thrown?.message, cause: (thrown as { cause?: unknown })?.cause }))
      .not.toContain('raw-string-rejection-with-marker');
  });

  it('lets a deduped (already persisted) result through as success', async () => {
    jest.mocked(persistInboundMessage).mockResolvedValue({ deduped: true, conversationId: 'conv-1' });

    await expect(receberMensagem.handler(validInput as never, systemCtx as never))
      .resolves.toEqual({ deduped: true, conversationId: 'conv-1' });
  });
});
