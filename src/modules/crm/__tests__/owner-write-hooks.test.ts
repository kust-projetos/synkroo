import type { ActionContext } from '@/core/actions/types';

const mockRecalculateDuplicatesForPatient = jest.fn();
const mockRecalculateDuplicatesForLead = jest.fn();
const mockCreatePatient = jest.fn();
const mockUpdatePatient = jest.fn();
const mockCaptureLead = jest.fn();
const mockFindLead = jest.fn();
const mockUpdateLead = jest.fn();

jest.mock('@/modules/crm', () => ({
  recalculateDuplicatesForPatient: (...args: unknown[]) =>
    mockRecalculateDuplicatesForPatient(...args),
  recalculateDuplicatesForLead: (...args: unknown[]) =>
    mockRecalculateDuplicatesForLead(...args),
}));

jest.mock('@/modules/operacional/services/patients-service', () => ({
  criarPaciente: (...args: unknown[]) => mockCreatePatient(...args),
  atualizarPaciente: (...args: unknown[]) => mockUpdatePatient(...args),
}));

jest.mock('@/modules/comercial/services/lead-capture-service', () => ({
  captureLead: (...args: unknown[]) => mockCaptureLead(...args),
}));

jest.mock('@/modules/comercial/repositories/leads-repository', () => ({
  findLeadByIdForClinic: (...args: unknown[]) => mockFindLead(...args),
  updateLead: (...args: unknown[]) => mockUpdateLead(...args),
}));

import { criarPaciente } from '@/modules/operacional/actions/criar-paciente';
import { atualizarPaciente } from '@/modules/operacional/actions/atualizar-paciente';
import { capturarLead } from '@/modules/comercial/actions/capturar-lead';
import { atualizarLead } from '@/modules/comercial/actions/atualizar-lead';

const context: ActionContext = {
  source: 'user',
  clinicId: '00000000-0000-4000-8000-000000000001',
  user: {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'staff@example.com',
    name: 'Staff',
  },
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'staff' },
};

describe('owner write actions delegate tenant scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts capture input without a client-provided clinic', () => {
    expect(capturarLead.input.safeParse({
      name: 'Lead Ana',
      phone: '11999990000',
      source: 'whatsapp',
    }).success).toBe(true);
  });

  it('accepts lead update input without a client-provided clinic', () => {
    expect(atualizarLead.input.safeParse({
      leadId: '00000000-0000-4000-8000-000000000010',
      name: 'Lead Ana',
    }).success).toBe(true);
  });

  it('delegates patient creation with the context clinic', async () => {
    mockCreatePatient.mockResolvedValue({ id: 'patient-new' });

    const result = await criarPaciente.handler(
      { name: 'Ana', phone: '11999990000' },
      context,
    );

    expect({
      result,
      write: mockCreatePatient.mock.calls[0][0],
    }).toEqual({
      result: { id: 'patient-new' },
      write: {
        clinicId: context.clinicId,
        name: 'Ana',
        phone: '11999990000',
      },
    });
    expect(mockRecalculateDuplicatesForPatient).not.toHaveBeenCalled();
  });

  it('delegates patient updates with the context clinic', async () => {
    mockUpdatePatient.mockResolvedValue({ id: 'patient-existing' });

    const result = await atualizarPaciente.handler(
      { id: 'patient-existing', name: 'Ana Silva' },
      context,
    );

    expect({
      result,
    }).toEqual({
      result: { id: 'patient-existing' },
    });
    expect(mockRecalculateDuplicatesForPatient).not.toHaveBeenCalled();
  });

  it('delegates lead capture with the context clinic', async () => {
    mockCaptureLead.mockResolvedValue({ leadId: 'lead-new' });

    const result = await capturarLead.handler(
      {
        name: 'Lead Ana',
        phone: '11999990000',
        source: 'web',
      },
      context,
    );

    expect({
      result,
      write: mockCaptureLead.mock.calls[0][0],
    }).toEqual({
      result: { leadId: 'lead-new' },
      write: {
        clinicId: context.clinicId,
        name: 'Lead Ana',
        phone: '11999990000',
        source: 'web',
      },
    });
    expect(mockRecalculateDuplicatesForLead).not.toHaveBeenCalled();
  });

  it('delegates lead updates with the context clinic', async () => {
    mockFindLead.mockResolvedValue({ id: 'lead-existing' });
    mockUpdateLead.mockResolvedValue({ id: 'lead-existing' });

    const result = await atualizarLead.handler(
      {
        leadId: 'lead-existing',
        name: 'Lead Ana Silva',
      },
      context,
    );

    expect({
      result,
      lookup: mockFindLead.mock.calls[0],
      write: mockUpdateLead.mock.calls[0],
    }).toEqual({
      result: { id: 'lead-existing' },
      lookup: ['lead-existing', context.clinicId],
      write: [
        'lead-existing',
        context.clinicId,
        { name: 'Lead Ana Silva' },
      ],
    });
    expect(mockRecalculateDuplicatesForLead).not.toHaveBeenCalled();
  });
});
