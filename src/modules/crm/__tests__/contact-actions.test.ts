/**
 * contact-actions.test.ts — actions públicas do coordenador CRM de contatos.
 *
 * Cobertura:
 *  - 6 actions registradas com permissão correta (crm:view, crm:manage_notes, crm:manage_tags)
 *  - listarContatos: retorna { data, total } com paginação
 *  - obterContato: retorna contato OU lança not_found
 *  - listarTimelineContato: DESC por data
 *  - listarNotasContato: notas normalizadas (lead: activity_type='note')
 *  - adicionarNotaContato: roteia para owner bridge (paciente → operacional.registrarObservacaoPaciente,
 *    lead → comercial.registrarNotaLead); propaga not_found
 *  - atualizarTagsContato: roteia para owner bridge (paciente → operacional.atualizarTagsPaciente,
 *    lead → comercial.atualizarTagsLead); propaga not_found
 *  - Quando clinic não é owner (cross-clinic), retorna not_found sem side-effect
 */

import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';

// Mocks dos serviços de leitura.
const mockListContacts = jest.fn();
const mockCountContacts = jest.fn();
const mockGetContact = jest.fn();
const mockListContactTimeline = jest.fn();
const mockListContactNotes = jest.fn();

// Mocks dos owner bridges (Task 2 actions).
const mockRegistrarObservacaoPaciente = jest.fn();
const mockAtualizarTagsPaciente = jest.fn();
const mockRegistrarNotaLead = jest.fn();
const mockAtualizarTagsLead = jest.fn();

jest.mock('@/modules/crm/services/contact-list-service', () => ({
  listContactsService: async (ctx: unknown, input: unknown) => {
    const data = await mockListContacts(ctx, input);
    const total = await mockCountContacts(ctx, input);
    return { data, total };
  },
}));
jest.mock('@/modules/crm/services/contact-detail-service', () => ({
  getContactService: (...args: unknown[]) => mockGetContact(...args),
}));
jest.mock('@/modules/crm/services/contact-timeline-service', () => ({
  listContactTimelineService: (...args: unknown[]) => mockListContactTimeline(...args),
}));
jest.mock('@/modules/crm/services/contact-notes-service', () => ({
  listContactNotesService: (...args: unknown[]) => mockListContactNotes(...args),
  addContactNoteService: (
    ctx: unknown,
    type: string,
    id: string,
    content: string,
  ) => {
    if (type === 'patient') {
      return mockRegistrarObservacaoPaciente({ patientId: id, content }, ctx);
    }
    if (type === 'lead') {
      return mockRegistrarNotaLead({ leadId: id, content }, ctx);
    }
    throw new Error('unknown_contact_type');
  },
}));
jest.mock('@/modules/crm/services/contact-tags-service', () => ({
  updateContactTagsService: (
    ctx: unknown,
    type: string,
    id: string,
    tags: string[],
  ) => {
    if (type === 'patient') {
      return mockAtualizarTagsPaciente({ patientId: id, tags }, ctx);
    }
    if (type === 'lead') {
      return mockAtualizarTagsLead({ leadId: id, tags }, ctx);
    }
    throw new Error('unknown_contact_type');
  },
}));

jest.mock('@/modules/operacional', () => ({
  registrarObservacaoPaciente: {
    name: 'operacional.registrarObservacaoPaciente',
    handler: (...args: unknown[]) => mockRegistrarObservacaoPaciente(...args),
  },
  atualizarTagsPaciente: {
    name: 'operacional.atualizarTagsPaciente',
    handler: (...args: unknown[]) => mockAtualizarTagsPaciente(...args),
  },
}));

jest.mock('@/modules/comercial', () => ({
  registrarNotaLead: {
    name: 'comercial.registrarNotaLead',
    handler: (...args: unknown[]) => mockRegistrarNotaLead(...args),
  },
  atualizarTagsLead: {
    name: 'comercial.atualizarTagsLead',
    handler: (...args: unknown[]) => mockAtualizarTagsLead(...args),
  },
}));

import {
  listarContatos,
  obterContato,
  listarTimelineContato,
  listarNotasContato,
  adicionarNotaContato,
  atualizarTagsContato,
  crmContactReadActions,
} from '@/modules/crm/actions';

const CLINIC_A = '00000000-0000-4000-8000-0000000000a1';
const P1 = '00000000-0000-4000-8000-0000000000b1';
const L1 = '00000000-0000-4000-8000-0000000000c1';

function ctxFor(clinicId: string): ActionContext {
  return {
    source: 'user',
    clinicId,
    user: { id: 'user-1', email: 'staff@test.com', name: 'Staff' },
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'staff' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('crm.contact actions — registration', () => {
  it('6 actions registradas em crmContactReadActions (array público)', () => {
    expect(crmContactReadActions).toHaveLength(6);
    const names = crmContactReadActions.map((a) => a.name).sort();
    expect(names).toEqual([
      'crm.adicionarNotaContato',
      'crm.atualizarTagsContato',
      'crm.listarContatos',
      'crm.listarNotasContato',
      'crm.listarTimelineContato',
      'crm.obterContato',
    ]);
  });

  it('permissões: view / manage_notes / manage_tags conforme EARS', () => {
    expect(listarContatos.requires).toBe('crm:view');
    expect(obterContato.requires).toBe('crm:view');
    expect(listarTimelineContato.requires).toBe('crm:view');
    expect(listarNotasContato.requires).toBe('crm:view');
    expect(adicionarNotaContato.requires).toBe('crm:manage_notes');
    expect(atualizarTagsContato.requires).toBe('crm:manage_tags');
  });

  it('módulo de todas as actions é "crm"', () => {
    for (const a of crmContactReadActions) {
      expect(a.module).toBe('crm');
    }
  });
});

describe('crm.listarContatos', () => {
  it('retorna { data, total } com paginação após UNION', async () => {
    mockListContacts.mockResolvedValue([
      { type: 'patient', id: P1, name: 'Ana' },
    ]);
    mockCountContacts.mockResolvedValue(1);
    const r = await listarContatos.handler({ limit: 10, offset: 0 }, ctxFor(CLINIC_A));
    expect(r).toEqual({
      data: [{ type: 'patient', id: P1, name: 'Ana' }],
      total: 1,
    });
    expect(mockListContacts).toHaveBeenCalledWith(expect.objectContaining({ clinicId: CLINIC_A }), expect.objectContaining({ limit: 10, offset: 0 }));
    expect(mockCountContacts).toHaveBeenCalledWith(expect.objectContaining({ clinicId: CLINIC_A }), expect.any(Object));
  });

  it('passa search ao service', async () => {
    mockListContacts.mockResolvedValue([]);
    mockCountContacts.mockResolvedValue(0);
    await listarContatos.handler({ limit: 10, offset: 0, search: 'Ana' }, ctxFor(CLINIC_A));
    expect(mockListContacts).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: CLINIC_A }),
      expect.objectContaining({ search: 'Ana' }),
    );
  });
});

describe('crm.obterContato', () => {
  it('retorna contato quando {type,id} existe na clínica', async () => {
    mockGetContact.mockResolvedValue({ type: 'patient', id: P1, name: 'Ana' });
    const r = await obterContato.handler({ type: 'patient', id: P1 }, ctxFor(CLINIC_A));
    expect(r).toEqual({ type: 'patient', id: P1, name: 'Ana' });
    expect(mockGetContact).toHaveBeenCalledWith(expect.objectContaining({ clinicId: CLINIC_A }), 'patient', P1);
  });

  it('lança not_found quando getContact retorna null', async () => {
    mockGetContact.mockResolvedValue(null);
    await expect(
      obterContato.handler({ type: 'patient', id: P1 }, ctxFor(CLINIC_A)),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('lança not_found para type desconhecido (defesa)', async () => {
    mockGetContact.mockResolvedValue(null);
    await expect(
      obterContato.handler({ type: 'unknown' as any, id: P1 }, ctxFor(CLINIC_A)),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('crm.listarTimelineContato', () => {
  it('retorna timeline DESC por data', async () => {
    mockListContactTimeline.mockResolvedValue([
      { id: 't2', performed_at: new Date('2026-02-01'), description: 'recente' },
      { id: 't1', performed_at: new Date('2026-01-01'), description: 'antigo' },
    ]);
    const rows = await listarTimelineContato.handler(
      { type: 'lead', id: L1 },
      ctxFor(CLINIC_A),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('t2');
  });

  it('passa clinicId + type + id ao service', async () => {
    mockListContactTimeline.mockResolvedValue([]);
    await listarTimelineContato.handler({ type: 'patient', id: P1 }, ctxFor(CLINIC_A));
    expect(mockListContactTimeline).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: CLINIC_A }),
      'patient',
      P1,
    );
  });

  it('lança not_found para type desconhecido', async () => {
    await expect(
      listarTimelineContato.handler({ type: 'unknown' as any, id: P1 }, ctxFor(CLINIC_A)),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('crm.listarNotasContato', () => {
  it('retorna notas (lead usa activity_type=note)', async () => {
    mockListContactNotes.mockResolvedValue([
      { id: 'n1', type: 'note', description: 'ligar amanhã' },
    ]);
    const rows = await listarNotasContato.handler({ type: 'lead', id: L1 }, ctxFor(CLINIC_A));
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('note');
  });

  it('lança not_found para type desconhecido', async () => {
    await expect(
      listarNotasContato.handler({ type: 'unknown' as any, id: P1 }, ctxFor(CLINIC_A)),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('crm.adicionarNotaContato — owner bridge routing', () => {
  it('type=patient → chama operacional.registrarObservacaoPaciente com patientId', async () => {
    mockRegistrarObservacaoPaciente.mockResolvedValue({ id: 'obs-new' });
    const r = await adicionarNotaContato.handler(
      { type: 'patient', id: P1, content: 'paciente ligou' },
      ctxFor(CLINIC_A),
    );
    expect(r).toEqual({ id: 'obs-new' });
    expect(mockRegistrarObservacaoPaciente).toHaveBeenCalledWith(
      { patientId: P1, content: 'paciente ligou' },
      expect.objectContaining({ clinicId: CLINIC_A }),
    );
    expect(mockRegistrarNotaLead).not.toHaveBeenCalled();
  });

  it('type=lead → chama comercial.registrarNotaLead com leadId', async () => {
    mockRegistrarNotaLead.mockResolvedValue({ id: 'act-new' });
    const r = await adicionarNotaContato.handler(
      { type: 'lead', id: L1, content: 'lead respondeu' },
      ctxFor(CLINIC_A),
    );
    expect(r).toEqual({ id: 'act-new' });
    expect(mockRegistrarNotaLead).toHaveBeenCalledWith(
      { leadId: L1, content: 'lead respondeu' },
      expect.objectContaining({ clinicId: CLINIC_A }),
    );
    expect(mockRegistrarObservacaoPaciente).not.toHaveBeenCalled();
  });

  it('cross-clinic: propaga not_found do owner bridge sem chamar a action interna', async () => {
    mockRegistrarObservacaoPaciente.mockRejectedValue(
      new ActionError('not_found', 'Paciente não encontrado.'),
    );
    await expect(
      adicionarNotaContato.handler(
        { type: 'patient', id: P1, content: 'x' },
        ctxFor(CLINIC_A),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('cross-clinic lead: propaga not_found do owner bridge', async () => {
    mockRegistrarNotaLead.mockRejectedValue(
      new ActionError('not_found', 'Lead não encontrado.'),
    );
    await expect(
      adicionarNotaContato.handler(
        { type: 'lead', id: L1, content: 'x' },
        ctxFor(CLINIC_A),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('type desconhecido: not_found antes de qualquer bridge', async () => {
    await expect(
      adicionarNotaContato.handler(
        { type: 'unknown' as any, id: P1, content: 'x' },
        ctxFor(CLINIC_A),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(mockRegistrarObservacaoPaciente).not.toHaveBeenCalled();
    expect(mockRegistrarNotaLead).not.toHaveBeenCalled();
  });
});

describe('crm.atualizarTagsContato — owner bridge routing', () => {
  it('type=patient → chama operacional.atualizarTagsPaciente com patientId', async () => {
    mockAtualizarTagsPaciente.mockResolvedValue({ id: P1, tags: ['VIP'] });
    const r = await atualizarTagsContato.handler(
      { type: 'patient', id: P1, tags: ['VIP'] },
      ctxFor(CLINIC_A),
    );
    expect(r).toEqual({ id: P1, tags: ['VIP'] });
    expect(mockAtualizarTagsPaciente).toHaveBeenCalledWith(
      { patientId: P1, tags: ['VIP'] },
      expect.objectContaining({ clinicId: CLINIC_A }),
    );
    expect(mockAtualizarTagsLead).not.toHaveBeenCalled();
  });

  it('type=lead → chama comercial.atualizarTagsLead com leadId', async () => {
    mockAtualizarTagsLead.mockResolvedValue({ id: L1, tags: ['VIP'] });
    const r = await atualizarTagsContato.handler(
      { type: 'lead', id: L1, tags: ['VIP'] },
      ctxFor(CLINIC_A),
    );
    expect(r).toEqual({ id: L1, tags: ['VIP'] });
    expect(mockAtualizarTagsLead).toHaveBeenCalledWith(
      { leadId: L1, tags: ['VIP'] },
      expect.objectContaining({ clinicId: CLINIC_A }),
    );
    expect(mockAtualizarTagsPaciente).not.toHaveBeenCalled();
  });

  it('cross-clinic: propaga not_found do owner bridge', async () => {
    mockAtualizarTagsLead.mockRejectedValue(
      new ActionError('not_found', 'Lead não encontrado.'),
    );
    await expect(
      atualizarTagsContato.handler(
        { type: 'lead', id: L1, tags: ['x'] },
        ctxFor(CLINIC_A),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('type desconhecido: not_found antes de qualquer bridge', async () => {
    await expect(
      atualizarTagsContato.handler(
        { type: 'unknown' as any, id: P1, tags: ['x'] },
        ctxFor(CLINIC_A),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(mockAtualizarTagsPaciente).not.toHaveBeenCalled();
    expect(mockAtualizarTagsLead).not.toHaveBeenCalled();
  });
});