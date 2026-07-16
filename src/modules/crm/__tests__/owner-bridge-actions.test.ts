/**
 * CRM owner-bridge actions — Task 2 / Eixo 2.
 *
 * CRM does NOT write patient/lead notes or tags directly. It must call the
 * owner module (operacional for patient, comercial for lead), which derives
 * clinicId from ActionContext and persists with owner-scoped predicates.
 *
 * Cobertura RED→GREEN:
 *  - Quatro actions expostas e registradas no registry global.
 *  - Tag normalization: trim + drop empty + case-insensitive dedup
 *    preservando primeira ocorrência (' VIP ' + 'vip' + '' + 'Lead' → ['VIP','Lead']).
 *  - Foreign patient/lead (clinicId diferente) → ActionError('not_found'),
 *    sem inserir/atualizar nada.
 *  - Lead note: resolveLead ANTES de insertActivity. Se não achar, não chama
 *    insertActivity (regra "lead note shall resolver lead antes").
 */
import type { ActionContext } from '@/core/actions/types';
import { getAction, getActions, clearRegistry } from '@/core/actions/registry';

// Repositories sob teste — mocked.
const mockFindById = jest.fn();
const mockInsertObservation = jest.fn();
const mockUpdatePatientTags = jest.fn();
const mockFindLeadByIdForClinic = jest.fn();
const mockInsertActivity = jest.fn();
const mockUpdateLeadTags = jest.fn();

jest.mock('@/modules/operacional/repositories/patients-repository', () => {
  const actual = jest.requireActual(
    '@/modules/operacional/repositories/patients-repository',
  );
  return {
    ...actual,
    findById: (...args: unknown[]) => mockFindById(...args),
    insertPatientObservation: (...args: unknown[]) => mockInsertObservation(...args),
    updatePatientTags: (...args: unknown[]) => mockUpdatePatientTags(...args),
  };
});

jest.mock('@/modules/comercial/repositories/leads-repository', () => {
  const actual = jest.requireActual(
    '@/modules/comercial/repositories/leads-repository',
  );
  return {
    ...actual,
    findLeadByIdForClinic: (...args: unknown[]) => mockFindLeadByIdForClinic(...args),
    updateLeadTags: (...args: unknown[]) => mockUpdateLeadTags(...args),
  };
});

jest.mock('@/modules/comercial/repositories/activities-repository', () => ({
  insertActivity: (...args: unknown[]) => mockInsertActivity(...args),
}));

// Importações após mocks.
import {
  registrarObservacaoPaciente,
  atualizarTagsPaciente,
} from '@/modules/operacional';
import {
  registrarNotaLead,
  atualizarTagsLead,
} from '@/modules/comercial';

// Reaproveita o registry do bootstrap de testes para descobrir as ações.
import { bootstrapActions, resetBootstrapForTests } from '@/core/actions/bootstrap';

const CLINIC_A = '00000000-0000-4000-8000-0000000000aa';
const CLINIC_B = '00000000-0000-4000-8000-0000000000bb';
const PATIENT_A = '00000000-0000-4000-8000-0000000000a1';
const LEAD_A = '00000000-0000-4000-8000-0000000000a2';

function ctxFor(clinicId: string, source: 'user' | 'system' = 'user'): ActionContext {
  return {
    source,
    clinicId,
    user: {
      id: '00000000-0000-4000-8000-0000000000c1',
      email: 'staff@example.com',
      name: 'Staff',
    },
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'staff' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('owner-bridge — quatro actions registradas e clinic-scoped', () => {
  beforeAll(async () => {
    clearRegistry();
    resetBootstrapForTests();
    await bootstrapActions();
  });

  it('registrarObservacaoPaciente está registrada no registry', () => {
    expect(registrarObservacaoPaciente.name).toBe(
      'operacional.registrarObservacaoPaciente',
    );
    expect(registrarObservacaoPaciente.module).toBe('operacional');
    expect(registrarObservacaoPaciente.requires).toBe(
      'operacional:manage_patients',
    );
  });

  it('atualizarTagsPaciente está registrada no registry', () => {
    expect(atualizarTagsPaciente.name).toBe('operacional.atualizarTagsPaciente');
    expect(atualizarTagsPaciente.module).toBe('operacional');
    expect(atualizarTagsPaciente.requires).toBe('operacional:manage_patients');
  });

  it('registrarNotaLead está registrada no registry', () => {
    expect(registrarNotaLead.name).toBe('comercial.registrarNotaLead');
    expect(registrarNotaLead.module).toBe('comercial');
    expect(registrarNotaLead.requires).toBe('comercial:edit_leads');
  });

  it('atualizarTagsLead está registrada no registry', () => {
    expect(atualizarTagsLead.name).toBe('comercial.atualizarTagsLead');
    expect(atualizarTagsLead.module).toBe('comercial');
    expect(atualizarTagsLead.requires).toBe('comercial:edit_leads');
  });

  it('as 4 actions aparecem em getActions() após bootstrap', () => {
    const names = new Set(getActions().map((a) => a.name));
    expect(names.has('operacional.registrarObservacaoPaciente')).toBe(true);
    expect(names.has('operacional.atualizarTagsPaciente')).toBe(true);
    expect(names.has('comercial.registrarNotaLead')).toBe(true);
    expect(names.has('comercial.atualizarTagsLead')).toBe(true);
  });

  it('input de cada action não aceita clinicId (derivado do context)', () => {
    for (const a of [
      registrarObservacaoPaciente,
      atualizarTagsPaciente,
      registrarNotaLead,
      atualizarTagsLead,
    ]) {
      expect((a.input as any).shape?.clinicId).toBeUndefined();
    }
  });
});

describe('owner-bridge — tag normalization', () => {
  beforeAll(async () => {
    clearRegistry();
    resetBootstrapForTests();
    await bootstrapActions();
  });

  it('paciente: trim, drop empty, dedup case-insensitive (primeira vence)', () => {
    // Implementação determinística do contrato, sem mock: o repositório
    // mockado apenas repassa, então chamamos a normalização real do módulo
    // carregado por require dinâmico? Não — o mock acima já substitui.
    // Aqui validamos o mockado repassa a lista como está, depois testamos
    // a implementação real em repositório pelos testes focados.
    // Para garantir o comportamento end-to-end, instanciamos a função real:
    const realNormalize = jest.requireActual(
      '@/modules/operacional/repositories/patients-repository',
    ).normalizeTags as (tags: string[]) => string[];
    expect(realNormalize([' VIP ', 'vip', '', 'Lead'])).toEqual(['VIP', 'Lead']);
  });

  it('lead: trim, drop empty, dedup case-insensitive (primeira vence)', () => {
    const realNormalize = jest.requireActual(
      '@/modules/comercial/repositories/leads-repository',
    ).normalizeLeadTags as (tags: string[]) => string[];
    expect(realNormalize([' VIP ', 'vip', '', 'Lead'])).toEqual(['VIP', 'Lead']);
  });

  it('atualizarTagsPaciente persiste/retorna tags normalizadas', async () => {
    mockFindById.mockResolvedValue({ id: PATIENT_A });
    mockUpdatePatientTags.mockResolvedValue({ id: PATIENT_A });
    const r = await atualizarTagsPaciente.handler(
      { patientId: PATIENT_A, tags: [' VIP ', 'vip', '', 'Lead'] },
      ctxFor(CLINIC_A),
    );
    expect(r).toEqual({ id: PATIENT_A, tags: ['VIP', 'Lead'] });
    expect(mockUpdatePatientTags).toHaveBeenCalledWith(
      CLINIC_A,
      PATIENT_A,
      ['VIP', 'Lead'],
    );
  });

  it('atualizarTagsLead persiste/retorna tags normalizadas', async () => {
    mockFindLeadByIdForClinic.mockResolvedValue({ id: LEAD_A });
    mockUpdateLeadTags.mockResolvedValue({ id: LEAD_A });
    const r = await atualizarTagsLead.handler(
      { leadId: LEAD_A, tags: [' VIP ', 'vip', '', 'Lead'] },
      ctxFor(CLINIC_A),
    );
    expect(r).toEqual({ id: LEAD_A, tags: ['VIP', 'Lead'] });
    expect(mockUpdateLeadTags).toHaveBeenCalledWith(LEAD_A, CLINIC_A, ['VIP', 'Lead']);
  });
});

describe('owner-bridge — tenant isolation (cross-clinic → not_found)', () => {
  beforeAll(async () => {
    clearRegistry();
    resetBootstrapForTests();
    await bootstrapActions();
  });

  it('registrarObservacaoPaciente: patient de outra clínica → not_found, sem insert', async () => {
    mockFindById.mockResolvedValue(null); // fora da clinic
    await expect(
      registrarObservacaoPaciente.handler(
        { patientId: PATIENT_A, content: 'obs' },
        ctxFor(CLINIC_A),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(mockInsertObservation).not.toHaveBeenCalled();
  });

  it('atualizarTagsPaciente: patient de outra clínica → not_found, sem update', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(
      atualizarTagsPaciente.handler(
        { patientId: PATIENT_A, tags: ['x'] },
        ctxFor(CLINIC_A),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(mockUpdatePatientTags).not.toHaveBeenCalled();
  });

  it('registrarNotaLead: lead de outra clínica → not_found, sem insert activity', async () => {
    mockFindLeadByIdForClinic.mockResolvedValue(null);
    await expect(
      registrarNotaLead.handler(
        { leadId: LEAD_A, description: 'nota' },
        ctxFor(CLINIC_A),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(mockInsertActivity).not.toHaveBeenCalled();
  });

  it('atualizarTagsLead: lead de outra clínica → not_found, sem update', async () => {
    mockFindLeadByIdForClinic.mockResolvedValue(null);
    await expect(
      atualizarTagsLead.handler(
        { leadId: LEAD_A, tags: ['x'] },
        ctxFor(CLINIC_A),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(mockUpdateLeadTags).not.toHaveBeenCalled();
  });

  it('registrarObservacaoPaciente: ctx.clinicId é a do CONTEXTO (não do input)', async () => {
    mockFindById.mockResolvedValue({ id: PATIENT_A });
    mockInsertObservation.mockResolvedValue({ id: 'obs-new' });
    await registrarObservacaoPaciente.handler(
      { patientId: PATIENT_A, content: 'obs' },
      ctxFor(CLINIC_B),
    );
    expect(mockFindById).toHaveBeenCalledWith(CLINIC_B, PATIENT_A);
    expect(mockInsertObservation).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: CLINIC_B, patientId: PATIENT_A }),
    );
  });

  it('atualizarTagsLead: ctx.clinicId é a do CONTEXTO (não do input)', async () => {
    mockFindLeadByIdForClinic.mockResolvedValue({ id: LEAD_A });
    mockUpdateLeadTags.mockResolvedValue({ id: LEAD_A });
    await atualizarTagsLead.handler(
      { leadId: LEAD_A, tags: ['x'] },
      ctxFor(CLINIC_B),
    );
    expect(mockFindLeadByIdForClinic).toHaveBeenCalledWith(LEAD_A, CLINIC_B);
    expect(mockUpdateLeadTags).toHaveBeenCalledWith(LEAD_A, CLINIC_B, ['x']);
  });
});

describe('owner-bridge — lead note RESOLVE LEAD ANTES de inserir activity', () => {
  beforeAll(async () => {
    clearRegistry();
    resetBootstrapForTests();
    await bootstrapActions();
  });

  it('ordem: findLeadByIdForClinic → insertActivity (lead existe)', async () => {
    const order: string[] = [];
    mockFindLeadByIdForClinic.mockImplementation(async () => {
      order.push('findLead');
      return { id: LEAD_A };
    });
    mockInsertActivity.mockImplementation(async () => {
      order.push('insertActivity');
      return { id: 'act-1' };
    });
    const r = await registrarNotaLead.handler(
      { leadId: LEAD_A, description: 'nota' },
      ctxFor(CLINIC_A),
    );
    expect(r).toEqual({ id: 'act-1' });
    expect(order).toEqual(['findLead', 'insertActivity']);
  });

  it('se lead não existir, insertActivity NUNCA é chamado', async () => {
    mockFindLeadByIdForClinic.mockResolvedValue(null);
    await expect(
      registrarNotaLead.handler(
        { leadId: LEAD_A, description: 'nota' },
        ctxFor(CLINIC_A),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(mockInsertActivity).not.toHaveBeenCalled();
  });

  it('insertActivity recebe activityType="note" e description do input', async () => {
    mockFindLeadByIdForClinic.mockResolvedValue({ id: LEAD_A });
    mockInsertActivity.mockResolvedValue({ id: 'act-2' });
    await registrarNotaLead.handler(
      { leadId: LEAD_A, description: 'ligar amanhã' },
      ctxFor(CLINIC_A),
    );
    expect(mockInsertActivity).toHaveBeenCalledWith({
      leadId: LEAD_A,
      activityType: 'note',
      description: 'ligar amanhã',
    });
  });
});