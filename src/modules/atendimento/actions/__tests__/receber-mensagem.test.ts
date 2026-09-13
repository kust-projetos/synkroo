import { receberMensagem } from '../receber-mensagem';

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
