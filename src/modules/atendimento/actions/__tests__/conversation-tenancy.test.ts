import type { ActionContext } from '@/core/actions/types';
import { runAction } from '@/core/actions/run';
import { historicoMensagens } from '../historico-mensagens';
import { obterConversa } from '../obter-conversa';
import { obterModeloMensagem } from '../obter-modelo-mensagem';

jest.mock('../../repositories/conversations-repository', () => ({
  findByIdForClinic: jest.fn(),
  findByIdWithJoins: jest.fn(),
  findMessagesByConversation: jest.fn(),
  findByChannelAndExternalId: jest.fn(),
}));

jest.mock('../../services/templates-service', () => ({
  getApprovedTemplates: jest.fn().mockResolvedValue([]),
}));

import * as repo from '../../repositories/conversations-repository';
import * as templatesService from '../../services/templates-service';

const ctxA: ActionContext = {
  source: 'user',
  clinicId: '00000000-0000-0000-0000-00000000a001',
  user: { id: 'user-a', email: 'a@test.local', name: 'User A' },
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'user-a' },
};

const CONV_B = '00000000-0000-0000-0000-00000000b002';
const CLINIC_B = '00000000-0000-0000-0000-00000000b001';

describe('Atendimento conversation tenancy (W1.2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('historicoMensagens returns not_found for foreign conversation', async () => {
    (repo.findByIdForClinic as jest.Mock).mockResolvedValue(null);
    const res = await runAction(historicoMensagens, { conversationId: CONV_B }, ctxA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_found');
    expect(repo.findMessagesByConversation).not.toHaveBeenCalled();
  });

  it('obterConversa returns not_found for foreign conversation (both queries scoped)', async () => {
    (repo.findByIdWithJoins as jest.Mock).mockResolvedValue(null);
    const res = await runAction(obterConversa, { id: CONV_B }, ctxA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_found');
    expect(repo.findMessagesByConversation).not.toHaveBeenCalled();
  });

  it('obterModeloMensagem does not substitute clinicId from conversation — foreign returns not_found', async () => {
    (repo.findByIdForClinic as jest.Mock).mockResolvedValue(null);
    const res = await runAction(obterModeloMensagem, { conversationId: CONV_B }, ctxA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_found');
    expect(templatesService.getApprovedTemplates).not.toHaveBeenCalled();
  });

  it('obterModeloMensagem with own conversation uses ctx.clinicId (no substitution)', async () => {
    (repo.findByIdForClinic as jest.Mock).mockResolvedValue({ id: CONV_B, clinicId: ctxA.clinicId });
    (templatesService.getApprovedTemplates as jest.Mock).mockResolvedValue([{ id: 't1' }]);
    const res = await runAction(obterModeloMensagem, { conversationId: CONV_B }, ctxA);
    expect(res.ok).toBe(true);
    expect(templatesService.getApprovedTemplates).toHaveBeenCalledWith(ctxA.clinicId);
  });

  it('historicoMensagens with own conversation proceeds to scoped message query', async () => {
    (repo.findByIdForClinic as jest.Mock).mockResolvedValue({ id: CONV_B, clinicId: ctxA.clinicId });
    (repo.findMessagesByConversation as jest.Mock).mockResolvedValue([{ id: 'm1' }]);
    const res = await runAction(historicoMensagens, { conversationId: CONV_B }, ctxA);
    expect(res.ok).toBe(true);
    expect(repo.findMessagesByConversation).toHaveBeenCalledWith(ctxA.clinicId, CONV_B, expect.any(Object));
  });
});
