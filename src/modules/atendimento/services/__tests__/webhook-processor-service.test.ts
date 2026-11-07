jest.mock('../channel-service', () => ({
  sendWhatsAppMessage: jest.fn(),
}));
jest.mock('@/modules/operacional/public', () => ({
  resolveInboundReply: jest.fn(),
  buscarPacientePorTelefone: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  whatsappLogger: { info: jest.fn(), error: jest.fn() },
}));
jest.mock('../../repositories/conversations-repository', () => ({
  getClinicByInstance: jest.fn(),
  getClinicByPhoneNumber: jest.fn(),
  getClinicByInstagramAccountId: jest.fn(),
  findOrCreateConversation: jest.fn(),
  appendInboundMessageDeduped: jest.fn(),
  updateConversationTimestamp: jest.fn(),
  appendOutboundMessage: jest.fn(),
  findAppointmentById: jest.fn(),
  findAppointmentPatientPhone: jest.fn(),
  updateAppointmentStatus: jest.fn(),
  escalateConversation: jest.fn(),
}));
jest.mock('@/core/ia-channel/webhook-router', () => ({
  routeInboundToAgent: jest.fn(),
}));
jest.mock('@/core/ia-channel/interlocutor', () => ({
  resolveInterlocutor: jest.fn(),
}));
jest.mock('@/repositories/patients', () => ({ findPatientByPhone: jest.fn() }));
jest.mock('@/modules/comercial/repositories', () => ({ findLeadByPhone: jest.fn() }));
jest.mock('@/modules/comercial/public', () => ({
  buscarLeadPorTelefone: jest.fn(),
  capturarLeadInbound: jest.fn().mockResolvedValue({ id: 'lead-1' }),
}));
jest.mock('@/core/actions/run', () => ({ runAction: jest.fn() }));
jest.mock('@/core/actions/context', () => ({ buildSystemContext: jest.fn() }));
jest.mock('../../actions/enviar-mensagem', () => ({ enviarMensagem: { name: 'enviarMensagem' } }));
jest.mock('@/modules/comercial/actions', () => ({ capturarLead: { name: 'capturarLead' } }));
jest.mock('@/core/ia-channel/agent-invoker', () => ({ invokeAgent: jest.fn() }));

import {
  processEvolutionMessage,
  processInstagramEntry,
  processMetaWebhookEntry,
} from '../webhook-processor-service';
import * as repo from '../../repositories/conversations-repository';
import { routeInboundToAgent } from '@/core/ia-channel/webhook-router';
import { resolveInboundReply } from '@/modules/operacional/public';

const mockRepo = repo as jest.Mocked<typeof repo>;
const mockRouteInboundToAgent = routeInboundToAgent as jest.MockedFunction<typeof routeInboundToAgent>;
const mockResolveReply = resolveInboundReply as jest.MockedFunction<typeof resolveInboundReply>;
const { sendWhatsAppMessage } = jest.requireMock('../channel-service') as { sendWhatsAppMessage: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveReply.mockResolvedValue({ kind: 'agent', reason: 'not_reply' });
  mockRepo.appendInboundMessageDeduped.mockResolvedValue({ deduped: false } as never);
  mockRepo.updateConversationTimestamp.mockResolvedValue(undefined as never);
  mockRepo.findOrCreateConversation.mockResolvedValue({ id: 'conversation-1' } as never);
  mockRouteInboundToAgent.mockResolvedValue({ from: '5511999999999', action: 'agent' });
});

describe('processEvolutionMessage', () => {
  it.each([
    ['missing key', {}],
    ['sent by us', { key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: true } }],
    ['short phone', { key: { remoteJid: '123@s.whatsapp.net', fromMe: false }, message: { conversation: 'oi' } }],
    ['empty content', { key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false }, message: {} }],
  ])('returns empty for %s', async (_label, data) => {
    await expect(processEvolutionMessage(data, 'instance-1')).resolves.toEqual([]);
    expect(mockRepo.getClinicByInstance).not.toHaveBeenCalled();
  });

  it('handles lid phone and exits when instance has no clinic', async () => {
    mockRepo.getClinicByInstance.mockResolvedValue(null as never);
    const data = {
      key: { remoteJid: 'abc@lid', remoteJidAlt: '5511999999999@s.whatsapp.net', fromMe: false, id: 'm1' },
      message: { conversation: 'oi' },
    };

    await expect(processEvolutionMessage(data, 'unknown')).resolves.toEqual([]);
    expect(mockRepo.getClinicByInstance).toHaveBeenCalledWith('unknown');
    expect(mockRepo.findOrCreateConversation).not.toHaveBeenCalled();
  });

  it('returns empty for a deduplicated inbound message', async () => {
    mockRepo.getClinicByInstance.mockResolvedValue('clinic-1' as never);
    mockRepo.appendInboundMessageDeduped.mockResolvedValue({ deduped: true } as never);
    const data = {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'm1' },
      message: { conversation: 'oi' },
    };

    await expect(processEvolutionMessage(data, 'instance-1')).resolves.toEqual([]);
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it('routes a new text message to the agent', async () => {
    mockRepo.getClinicByInstance.mockResolvedValue('clinic-1' as never);
    const data = {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'm1' },
      message: { extendedTextMessage: { text: 'oi' } },
    };

    await expect(processEvolutionMessage(data, 'instance-1')).resolves.toEqual([
      { from: '5511999999999', action: 'agent' },
    ]);
    expect(mockRepo.appendInboundMessageDeduped).toHaveBeenCalledWith(expect.objectContaining({
      externalProvider: 'evolution',
      content: 'oi',
      messageType: 'text',
    }));
    expect(mockRepo.updateConversationTimestamp).toHaveBeenCalledWith(
      'clinic-1',
      'conversation-1',
      expect.any(Date),
    );
  });
  it('routes button display text through the trusted resolver, ignoring selectedId', async () => {
    mockRepo.getClinicByInstance.mockResolvedValue('clinic-1' as never);
    mockResolveReply.mockResolvedValue({ kind: 'confirmed', appointmentId: 'appt-1', responseMessage: 'Confirmado' } as never);
    const base = { key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'm1' } };

    await expect(processEvolutionMessage({ ...base, message: { buttonsResponseMessage: { selectedId: 'confirm_appt-1', selectedDisplayText: 'Sim' } } }, 'instance-1'))
      .resolves.toEqual([{ from: '5511999999999', action: 'confirmation' }]);
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(mockRepo.updateAppointmentStatus).not.toHaveBeenCalled();
    expect(mockResolveReply).toHaveBeenCalledWith(expect.objectContaining({
      clinicId: 'clinic-1',
      conversationId: 'conversation-1',
      senderPhone: '5511999999999',
      content: 'Sim',
      externalProvider: 'evolution',
      externalMessageId: 'm1',
      messageType: 'text',
      messageKind: 'button',
    }), expect.objectContaining({ allowWaitlist: false, messageKind: 'button' }));
    // The tap is marked as a button response in the persisted context —
    // a plain body:'SIM' inside a known button payload never becomes
    // regular text downstream.
    expect(mockRepo.appendInboundMessageDeduped).toHaveBeenCalledWith(expect.objectContaining({
      externalProvider: 'evolution',
      content: 'Sim',
      metadata: expect.objectContaining({ button_response: true }),
    }));
  });

  it('escalates negative button taps without cancelling anything', async () => {
    mockRepo.getClinicByInstance.mockResolvedValue('clinic-1' as never);
    mockResolveReply.mockResolvedValue({ kind: 'escalate', reason: 'reply_like' } as never);
    const data = {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'm9' },
      message: { buttonsResponseMessage: { selectedId: 'cancel_appt-1', selectedDisplayText: 'Cancelar' } },
    };

    await expect(processEvolutionMessage(data, 'instance-1')).resolves.toEqual([
      { from: '5511999999999', action: 'escalated' },
    ]);
    expect(mockRepo.escalateConversation).toHaveBeenCalledWith('conversation-1', 'clinic-1');
    expect(mockRepo.updateAppointmentStatus).not.toHaveBeenCalled();
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it('escalates button taps the resolver does not confirm instead of routing to the agent', async () => {
    mockRepo.getClinicByInstance.mockResolvedValue('clinic-1' as never);
    mockResolveReply.mockResolvedValue({ kind: 'agent', reason: 'not_reply' } as never);
    const data = {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'm10' },
      message: { buttonsResponseMessage: { selectedId: 'confirm_appt-1', selectedDisplayText: 'Confirmar' } },
    };

    await expect(processEvolutionMessage(data, 'instance-1')).resolves.toEqual([
      { from: '5511999999999', action: 'escalated' },
    ]);
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
    expect(mockRepo.updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it('returns empty for a replayed button event without touching status', async () => {
    mockRepo.getClinicByInstance.mockResolvedValue('clinic-1' as never);
    mockRepo.appendInboundMessageDeduped.mockResolvedValue({ deduped: true } as never);
    const data = {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'm1' },
      message: { buttonsResponseMessage: { selectedId: 'confirm_appt-1', selectedDisplayText: 'Sim' } },
    };

    await expect(processEvolutionMessage(data, 'instance-1')).resolves.toEqual([]);
    expect(mockResolveReply).not.toHaveBeenCalled();
    expect(mockRepo.updateAppointmentStatus).not.toHaveBeenCalled();
    expect(mockRepo.escalateConversation).not.toHaveBeenCalled();
  });

  it('escalates ambiguous or missing pending context for text replies without mutating', async () => {
    mockRepo.getClinicByInstance.mockResolvedValue('clinic-1' as never);
    mockResolveReply.mockResolvedValue({ kind: 'escalate', reason: 'ambiguous' } as never);
    const data = {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'm1' },
      message: { conversation: 'sim' },
    };

    await expect(processEvolutionMessage(data, 'instance-1')).resolves.toEqual([
      { from: '5511999999999', action: 'escalated' },
    ]);
    expect(mockRepo.escalateConversation).toHaveBeenCalledWith('conversation-1', 'clinic-1');
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
    expect(mockRepo.updateAppointmentStatus).not.toHaveBeenCalled();
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it('routes text replies through the single decision point before agent routing', async () => {
    mockRepo.getClinicByInstance.mockResolvedValue('clinic-1' as never);
    mockResolveReply.mockResolvedValueOnce({ kind: 'confirmed', appointmentId: 'a1', responseMessage: 'Confirmado' } as never);
    const data = { key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'm1' }, message: { conversation: 'sim' } };
    await expect(processEvolutionMessage(data, 'instance-1')).resolves.toEqual([{ from: '5511999999999', action: 'confirmation' }]);

    mockRepo.appendInboundMessageDeduped.mockResolvedValue({ deduped: false } as never);
    mockResolveReply.mockResolvedValueOnce({ kind: 'waitlist_scheduled', responseMessage: 'Há vaga' } as never);
    await expect(processEvolutionMessage({ ...data, key: { ...data.key, id: 'm2' } }, 'instance-1')).resolves.toEqual([{ from: '5511999999999', action: 'waitlist' }]);
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it.each([
    ['imageMessage', { imageMessage: { caption: 'foto' } }, 'image'],
    ['audioMessage', { audioMessage: {} }, 'audio'],
    ['documentMessage', { documentMessage: { fileName: 'doc.pdf' } }, 'document'],
  ])('stores %s content', async (_label, message, messageType) => {
    mockRepo.getClinicByInstance.mockResolvedValue('clinic-1' as never);
    const data = { key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: `m-${messageType}` }, message };
    await processEvolutionMessage(data, 'instance-1');
    expect(mockRepo.appendInboundMessageDeduped).toHaveBeenCalledWith(expect.objectContaining({ messageType }));
  });

});

describe('processMetaWebhookEntry', () => {
  it('ignores missing changes and values', async () => {
    await expect(processMetaWebhookEntry({ changes: [{ value: undefined }] })).resolves.toEqual([]);
    expect(mockRepo.findOrCreateConversation).not.toHaveBeenCalled();
  });

  it('processes status-only entries without storing a message', async () => {
    await expect(processMetaWebhookEntry({ changes: [{ value: { statuses: [{ id: 's1' }] } }] })).resolves.toEqual([]);
    expect(mockRepo.appendInboundMessageDeduped).not.toHaveBeenCalled();
  });

  it('ignores a Meta message when clinic cannot be resolved', async () => {
    mockRepo.getClinicByPhoneNumber.mockResolvedValue(null as never);
    const entry = {
      changes: [{ value: { metadata: { phone_number_id: 'phone-1' }, messages: [{ from: '5511999999999', id: 'm1', type: 'text', text: { body: 'oi' } }] } }],
    };

    await expect(processMetaWebhookEntry(entry)).resolves.toEqual([]);
    expect(mockRepo.getClinicByPhoneNumber).toHaveBeenCalledWith('phone-1');
  });

  it('returns a confirmation action before agent routing', async () => {
    mockResolveReply.mockResolvedValue({ kind: 'confirmed', appointmentId: 'a1', responseMessage: 'Confirmado' } as never);
    mockRepo.getClinicByPhoneNumber.mockResolvedValue('clinic-1' as never);
    const entry = {
      changes: [{ value: { metadata: { phone_number_id: 'phone-1' }, messages: [{ from: '5511999999999', id: 'm1', type: 'text', text: { body: 'sim' } }] } }],
    };

    await expect(processMetaWebhookEntry(entry)).resolves.toEqual([
      { from: '5511999999999', action: 'confirmation' },
    ]);
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
  });

  it('escalates Meta replies the resolver does not confirm instead of routing to the agent', async () => {
    mockResolveReply.mockResolvedValue({ kind: 'escalate', reason: 'no_pending' } as never);
    mockRepo.getClinicByPhoneNumber.mockResolvedValue('clinic-1' as never);
    const entry = {
      changes: [{ value: { metadata: { phone_number_id: 'phone-1' }, messages: [{ from: '5511999999999', id: 'm2', type: 'text', text: { body: 'sim' } }] } }],
    };

    await expect(processMetaWebhookEntry(entry)).resolves.toEqual([
      { from: '5511999999999', action: 'escalated' },
    ]);
    expect(mockRepo.escalateConversation).toHaveBeenCalledWith('conversation-1', 'clinic-1');
    expect(mockRouteInboundToAgent).not.toHaveBeenCalled();
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it('forwards missing Meta event clock as undefined so the resolver fails closed (never insert time)', async () => {
    mockRepo.getClinicByPhoneNumber.mockResolvedValue('clinic-1' as never);
    const entry = {
      changes: [{ value: { metadata: { phone_number_id: 'phone-1' }, messages: [{ from: '5511999999999', id: 'm3', type: 'text', text: { body: 'sim' } }] } }],
    };

    await processMetaWebhookEntry(entry);
    // Normalized provider clock travels as eventTimestamp (absent here);
    // persistence must not substitute DB insert time.
    expect(mockRepo.appendInboundMessageDeduped).toHaveBeenCalledWith(expect.objectContaining({
      externalProvider: 'meta',
      externalMessageId: 'm3',
      eventTimestamp: undefined,
    }));
    // Parsed clock (undefined when missing/invalid) is what reaches the
    // trusted resolver — never storeResult.createdAt.
    expect(mockResolveReply).toHaveBeenCalledWith(expect.objectContaining({
      externalMessageId: 'm3',
      receivedAt: undefined,
    }), expect.anything());
  });

  it('forwards a valid Meta event clock as a Date and never uses insert time', async () => {
    mockRepo.getClinicByPhoneNumber.mockResolvedValue('clinic-1' as never);
    // Simulate a repo row carrying a DB insert time: the resolver must still
    // receive the parsed provider clock, not createdAt.
    mockRepo.appendInboundMessageDeduped.mockResolvedValue({ deduped: false, id: 'row-1', createdAt: new Date('2026-11-06T00:00:00.000Z'), receivedAt: new Date('2026-11-06T00:00:00.000Z') } as never);
    const entry = {
      changes: [{ value: { metadata: { phone_number_id: 'phone-1' }, messages: [{ from: '5511999999999', id: 'm4', type: 'text', text: { body: 'sim' }, timestamp: '1762380000' }] } }],
    };

    await processMetaWebhookEntry(entry);
    const expectedIso = new Date(1762380000 * 1000).toISOString();
    expect(mockRepo.appendInboundMessageDeduped).toHaveBeenCalledWith(expect.objectContaining({
      externalMessageId: 'm4',
      eventTimestamp: expectedIso,
    }));
    expect(mockResolveReply).toHaveBeenCalledWith(expect.objectContaining({
      externalMessageId: 'm4',
      receivedAt: new Date(expectedIso),
    }), expect.anything());
  });
});

describe('processInstagramEntry', () => {
  it('skips malformed, stale and unresolvable events', async () => {
    mockRepo.getClinicByInstagramAccountId.mockResolvedValue(null as never);
    const result = await processInstagramEntry({
      messaging: [
        {},
        { sender: {}, message: { text: 'ignored' }, timestamp: String(Date.now()) },
        { sender: { id: 'old' }, message: { text: 'old' }, timestamp: '1' },
        { sender: { id: 'new' }, message: { text: 'new' }, timestamp: String(Date.now()) },
      ],
    });

    expect(result).toEqual([]);
    expect(mockRepo.getClinicByInstagramAccountId).toHaveBeenCalledWith(undefined);
    expect(mockRepo.findOrCreateConversation).not.toHaveBeenCalled();
  });

  it('stores a fresh attachment message for a clinic', async () => {
    mockRepo.getClinicByInstagramAccountId.mockResolvedValue('clinic-1' as never);
    const result = await processInstagramEntry({
      messaging: [{
        sender: { id: 'sender-1' },
        recipient: { id: 'page-1' },
        timestamp: String(Date.now()),
        message: { mid: 'mid-1', attachments: [{ type: 'audio' }] },
      }],
    });

    expect(result).toEqual([{ from: 'sender-1', message: '[Audio]' }]);
    expect(mockRepo.appendInboundMessageDeduped).toHaveBeenCalledWith(expect.objectContaining({
      externalProvider: 'instagram',
      messageType: 'audio',
    }));
  });
});
