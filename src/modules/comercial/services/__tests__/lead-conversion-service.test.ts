/**
 * Unit tests: Comercial lead conversion service (Task 5).
 *
 * Tests agendarAvaliacao orchestration:
 * - no patientId → create patient + schedule + convert
 * - existing patientId → update patient + schedule
 * - scheduling fails → lead not converted
 */

// Mock the action system
const mockRunAction = jest.fn();
jest.mock('@/core/actions/run', () => ({ runAction: mockRunAction }));

const mockBuildSystemContext = jest.fn().mockResolvedValue({
  clinicId: 'clinic-1',
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test' },
});
jest.mock('@/core/actions/context', () => ({ buildSystemContext: mockBuildSystemContext }));

jest.mock('../../repositories/leads-repository', () => ({
  findLeadByIdForClinic: jest.fn(),
  updateLead: jest.fn(),
}));

jest.mock('../../repositories/activities-repository', () => ({
  insertActivity: jest.fn(),
}));

import { agendarAvaliacao } from '../../services/lead-conversion-service';
import * as leadsRepo from '../../repositories/leads-repository';
import * as activitiesRepo from '../../repositories/activities-repository';

const mockFindLead = jest.mocked(leadsRepo.findLeadByIdForClinic);
const mockUpdateLead = jest.mocked(leadsRepo.updateLead);
const mockInsertActivity = jest.mocked(activitiesRepo.insertActivity);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('agendarAvaliacao', () => {
  const clinicId = 'clinic-1';
  const leadId = 'lead-1';
  const patientId = 'patient-1';
  const appointmentId = 'apt-1';

  const baseLead: Record<string, unknown> = {
    id: leadId,
    clinicId,
    name: 'Maria',
    phone: '11999990000',
    phoneNormalized: '11999990000',
    source: 'whatsapp',
    status: 'new',
    patientId: null,
    email: null,
    campaignId: null,
    score: 0,
    temperature: 'cold',
    interest: null,
    hasBudget: null,
    hasTimeline: null,
    assignedTo: null,
    lastContactAt: null,
    nextFollowupAt: null,
    contactCount: 0,
    convertedAt: null,
    convertedAppointmentId: null,
    lostReason: null,
    lostAt: null,
    notes: null,
    stageId: null,
    sourceType: null,
    dealValue: '0',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('creates patient and schedules when lead has no patientId', async () => {
    mockFindLead.mockResolvedValue(baseLead as any);
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { id: patientId } });
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { id: appointmentId } });
    mockUpdateLead.mockResolvedValue({ id: leadId });
    mockInsertActivity.mockResolvedValue({ id: 'act-1' });

    const result = await agendarAvaliacao({
      leadId,
      clinicId,
      scheduledAt: new Date('2026-07-10T14:00:00Z'),
    });

    expect(mockRunAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'operacional.criarPaciente' }),
      expect.objectContaining({ name: 'Maria', phone: '11999990000' }),
      expect.any(Object),
    );

    expect(mockRunAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'operacional.agendarConsulta' }),
      expect.objectContaining({ patientId }),
      expect.any(Object),
    );

    expect(result).toEqual({ leadId, patientId, appointmentId, status: 'converted' });
  });

  it('updates patient and schedules when lead has existing patientId (no data change)', async () => {
    mockFindLead.mockResolvedValue({ ...baseLead, patientId, name: 'Maria', phoneNormalized: '11999990000' } as any);
    // obterPaciente returns same data → no update needed
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { id: patientId, name: 'Maria', phone: '11999990000' } });
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { id: appointmentId } });
    mockUpdateLead.mockResolvedValue({ id: leadId });
    mockInsertActivity.mockResolvedValue({ id: 'act-1' });

    const result = await agendarAvaliacao({
      leadId,
      clinicId,
      scheduledAt: new Date('2026-07-10T14:00:00Z'),
    });

    expect(mockRunAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'operacional.criarPaciente' }),
      expect.anything(),
      expect.anything(),
    );
    expect(mockRunAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'operacional.atualizarPaciente' }),
      expect.anything(),
      expect.anything(),
    );
    expect(mockRunAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'operacional.agendarConsulta' }),
      expect.anything(),
      expect.anything(),
    );
    expect(result.status).toBe('converted');
  });

  it('calls atualizarPaciente when lead data differs from patient', async () => {
    mockFindLead.mockResolvedValue({ ...baseLead, patientId, name: 'Maria Updated', phoneNormalized: '11999991111', phone: '11999991111' } as any);
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { id: patientId, name: 'Maria', phone: '11999990000' } });
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { id: patientId } });
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { id: appointmentId } });
    mockUpdateLead.mockResolvedValue({ id: leadId });
    mockInsertActivity.mockResolvedValue({ id: 'act-1' });

    const result = await agendarAvaliacao({
      leadId,
      clinicId,
      scheduledAt: new Date('2026-07-10T14:00:00Z'),
    });

    expect(mockRunAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'operacional.atualizarPaciente' }),
      expect.objectContaining({ name: 'Maria Updated', phone: '11999991111' }),
      expect.any(Object),
    );
    expect(result.status).toBe('converted');
  });

  it('does not convert lead when scheduling fails', async () => {
    mockFindLead.mockResolvedValue(baseLead as any);
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { id: patientId } });
    mockRunAction.mockResolvedValueOnce({ ok: false, error: { code: 'conflict', message: 'Horário indisponível' } });

    await expect(agendarAvaliacao({
      leadId,
      clinicId,
      scheduledAt: new Date('2026-07-10T14:00:00Z'),
    })).rejects.toThrow('Horário indisponível');

    // Lead should NOT be updated to converted
    expect(mockUpdateLead).not.toHaveBeenCalled();
  });
});

describe('converterLeadSemAgendar', () => {
  const clinicId = 'clinic-1';
  const leadId = 'lead-1';
  const patientId = 'patient-1';

  const baseLead: Record<string, unknown> = {
    id: leadId,
    clinicId,
    name: 'Maria',
    phone: '11999990000',
    phoneNormalized: '11999990000',
    source: 'whatsapp',
    status: 'new',
    patientId: null,
    email: null,
    campaignId: null,
    score: 0,
    temperature: 'cold',
    interest: null,
    hasBudget: null,
    hasTimeline: null,
    assignedTo: null,
    lastContactAt: null,
    nextFollowupAt: null,
    contactCount: 0,
    convertedAt: null,
    convertedAppointmentId: null,
    lostReason: null,
    lostAt: null,
    notes: null,
    stageId: null,
    sourceType: null,
    dealValue: '0',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('converts lead to patient without appointment', async () => {
    mockFindLead.mockResolvedValue(baseLead as any);
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { id: patientId } });
    mockUpdateLead.mockResolvedValue({ id: leadId });
    mockInsertActivity.mockResolvedValue({ id: 'act-1' });

    const { converterLeadSemAgendar } = await import('../../services/lead-conversion-service');
    const result = await converterLeadSemAgendar({ leadId, clinicId });

    // Creates patient from lead data
    expect(mockRunAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'operacional.criarPaciente' }),
      expect.objectContaining({ name: 'Maria', phone: '11999990000' }),
      expect.any(Object),
    );

    // No scheduling call
    expect(mockRunAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'operacional.agendarConsulta' }),
      expect.anything(),
      expect.anything(),
    );

    expect(result).toMatchObject({ leadId, status: 'converted' });
  });

  it('updates patient data when lead differs from existing patient', async () => {
    mockFindLead.mockResolvedValue({ ...baseLead, patientId, name: 'Maria Updated', phoneNormalized: '11999991111', phone: '11999991111' } as any);
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { id: patientId, name: 'Maria', phone: '11999990000' } });
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { id: patientId } });
    mockUpdateLead.mockResolvedValue({ id: leadId });
    mockInsertActivity.mockResolvedValue({ id: 'act-1' });

    const { converterLeadSemAgendar } = await import('../../services/lead-conversion-service');
    const result = await converterLeadSemAgendar({ leadId, clinicId });

    expect(mockRunAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'operacional.atualizarPaciente' }),
      expect.objectContaining({ name: 'Maria Updated', phone: '11999991111' }),
      expect.any(Object),
    );
    expect(result).toMatchObject({ leadId, status: 'converted' });
  });

  it('throws when lead is already converted', async () => {
    mockFindLead.mockResolvedValue({ ...baseLead, status: 'converted' } as any);

    const { converterLeadSemAgendar } = await import('../../services/lead-conversion-service');

    await expect(converterLeadSemAgendar({ leadId, clinicId })).rejects.toThrow('Lead already converted');
    expect(mockUpdateLead).not.toHaveBeenCalled();
  });

  it('throws when lead is not found', async () => {
    mockFindLead.mockResolvedValue(null);

    const { converterLeadSemAgendar } = await import('../../services/lead-conversion-service');

    await expect(converterLeadSemAgendar({ leadId, clinicId })).rejects.toThrow('Lead not found');
    expect(mockUpdateLead).not.toHaveBeenCalled();
  });
});
