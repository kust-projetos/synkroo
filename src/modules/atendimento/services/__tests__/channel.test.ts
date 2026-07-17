/**
 * Unit test: Atendimento channel service (P2).
 *
 * Tests sendByChannel dispatch and fillTemplate purity.
 * Evolution service is mocked at the fetch boundary.
 */

import { sendByChannel, sendWhatsApp } from '../channel-service';
import { getEvolutionService } from '../evolution-service';
import { fillTemplate } from '../templates-service';
import type { MessageTemplate } from '../templates-service';

// ─── Mock evolution service ────────────────────────────────────

jest.mock('../evolution-service', () => {
  const actual = jest.requireActual('../evolution-service');
  return {
    ...actual,
    getEvolutionService: jest.fn(),
  };
});

const mockEvolution = getEvolutionService as jest.MockedFunction<typeof getEvolutionService>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── sendByChannel tests ───────────────────────────────────────

describe('sendByChannel', () => {

  it('delegates whatsapp to evolution service', async () => {
    const mockSend = jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' });
    mockEvolution.mockReturnValue({
      sendTextMessage: mockSend,
    } as any);

    const result = await sendByChannel('whatsapp', '+5511999999999', 'Hello');
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-1');
    expect(mockSend).toHaveBeenCalledWith('+5511999999999', 'Hello');
  });

  it('returns error when evolution is unavailable', async () => {
    mockEvolution.mockReturnValue(null);

    const result = await sendByChannel('whatsapp', '+5511999999999', 'Hello');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });

  it('returns error for web channel', async () => {
    const result = await sendByChannel('web', 'any', 'Hello');
    expect(result.success).toBe(false);
    expect(result.error).toContain('receive-only');
  });

  it('returns error for instagram (not yet implemented)', async () => {
    const result = await sendByChannel('instagram', 'any', 'Hello');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not yet implemented');
  });
});

// ─── sendWhatsApp tests ────────────────────────────────────────

describe('sendWhatsApp', () => {

  it('calls evolution.sendTextMessage with formatted number', async () => {
    const mockSend = jest.fn().mockResolvedValue({ success: true, messageId: 'msg-2' });
    mockEvolution.mockReturnValue({ sendTextMessage: mockSend } as any);

    const result = await sendWhatsApp('11999999999', 'Test');
    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledWith('11999999999', 'Test');
  });

  it('returns error when evolution throws', async () => {
    const mockSend = jest.fn().mockRejectedValue(new Error('Network error'));
    mockEvolution.mockReturnValue({ sendTextMessage: mockSend } as any);

    const result = await sendWhatsApp('11999999999', 'Test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });
});

// ─── fillTemplate tests ────────────────────────────────────────

describe('fillTemplate (pure)', () => {

  const baseTemplate: MessageTemplate = {
    id: 'tpl-1',
    clinicId: 'clinic-1',
    name: 'appointment_reminder',
    category: 'UTILITY',
    language: 'pt_BR',
    body: 'Olá {{1}}, sua consulta está marcada para {{2}} às {{3}}.',
    status: 'APPROVED',
    metaTemplateId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('replaces numbered placeholders', () => {
    const result = fillTemplate(baseTemplate, {
      '1': 'Maria',
      '2': '25/06/2026',
      '3': '14:00',
    });
    expect(result).toBe('Olá Maria, sua consulta está marcada para 25/06/2026 às 14:00.');
  });

  it('replaces named placeholders', () => {
    const tpl: MessageTemplate = {
      ...baseTemplate,
      body: 'Olá {{nome}}, bem-vindo à {{clinica}}!',
    };
    const result = fillTemplate(tpl, { nome: 'João', clinica: 'Synkroo' });
    expect(result).toBe('Olá João, bem-vindo à Synkroo!');
  });

  it('leaves unmatched placeholders intact', () => {
    const result = fillTemplate(baseTemplate, { '1': 'Maria' });
    expect(result).toBe('Olá Maria, sua consulta está marcada para {{2}} às {{3}}.');
  });

  it('handles empty values object', () => {
    const result = fillTemplate(baseTemplate, {});
    expect(result).toBe('Olá {{1}}, sua consulta está marcada para {{2}} às {{3}}.');
  });

  it('handles template with no placeholders', () => {
    const tpl: MessageTemplate = {
      ...baseTemplate,
      body: 'Mensagem simples sem placeholders.',
    };
    const result = fillTemplate(tpl, { qualquer: 'coisa' });
    expect(result).toBe('Mensagem simples sem placeholders.');
  });
});
