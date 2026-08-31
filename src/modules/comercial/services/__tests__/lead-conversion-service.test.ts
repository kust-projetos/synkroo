/**
 * Unit tests: Comercial lead conversion service (Task 5).
 *
 * Tests agendarAvaliacao orchestration:
 * - no patientId → create patient + schedule + convert
 * - existing patientId → update patient + schedule
 * - scheduling fails → lead not converted
 */

// Mock the operacional public seam. The workflow must call these ports
// directly, never build a system context or invoke another Action.
const mockCreatePatient = jest.fn();
const mockGetPatient = jest.fn();
const mockUpdatePatient = jest.fn();
const mockScheduleAppointment = jest.fn();
jest.mock('@/modules/operacional/public', () => ({
  criarPaciente: (...args: unknown[]) => mockCreatePatient(...args),
  obterPaciente: (...args: unknown[]) => mockGetPatient(...args),
  atualizarPaciente: (...args: unknown[]) => mockUpdatePatient(...args),
  agendarConsulta: (...args: unknown[]) => mockScheduleAppointment(...args),
}));

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
  mockGetPatient.mockResolvedValue(null);
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
    mockCreatePatient.mockResolvedValue({ id: patientId });
    mockScheduleAppointment.mockResolvedValue({ id: appointmentId });
    mockUpdateLead.mockResolvedValue({ id: leadId });
    mockInsertActivity.mockResolvedValue({ id: 'act-1' });

    const result = await agendarAvaliacao({
      leadId,
      clinicId,
      scheduledAt: new Date('2026-07-10T14:00:00Z'),
    });

    expect(mockCreatePatient).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId, name: 'Maria', phone: '11999990000' }),
    );

    expect(mockScheduleAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId, patientId }),
    );

    expect(result).toEqual({ leadId, patientId, appointmentId, status: 'converted' });
  });

  it('updates patient and schedules when lead has existing patientId (no data change)', async () => {
    mockFindLead.mockResolvedValue({ ...baseLead, patientId, name: 'Maria', phoneNormalized: '11999990000' } as any);
    // obterPaciente returns same data → no update needed
    mockGetPatient.mockResolvedValue({ id: patientId, name: 'Maria', phone: '11999990000' });
    mockScheduleAppointment.mockResolvedValue({ id: appointmentId });
    mockUpdateLead.mockResolvedValue({ id: leadId });
    mockInsertActivity.mockResolvedValue({ id: 'act-1' });

    const result = await agendarAvaliacao({
      leadId,
      clinicId,
      scheduledAt: new Date('2026-07-10T14:00:00Z'),
    });

    expect(mockCreatePatient).not.toHaveBeenCalled();
    expect(mockUpdatePatient).not.toHaveBeenCalled();
    expect(mockScheduleAppointment).toHaveBeenCalledWith(expect.objectContaining({ patientId }));
    expect(result.status).toBe('converted');
  });

  it('calls atualizarPaciente when lead data differs from patient', async () => {
    mockFindLead.mockResolvedValue({ ...baseLead, patientId, name: 'Maria Updated', phoneNormalized: '11999991111', phone: '11999991111' } as any);
    mockGetPatient.mockResolvedValue({ id: patientId, name: 'Maria', phone: '11999990000' });
    mockUpdatePatient.mockResolvedValue({ id: patientId });
    mockScheduleAppointment.mockResolvedValue({ id: appointmentId });
    mockUpdateLead.mockResolvedValue({ id: leadId });
    mockInsertActivity.mockResolvedValue({ id: 'act-1' });

    const result = await agendarAvaliacao({
      leadId,
      clinicId,
      scheduledAt: new Date('2026-07-10T14:00:00Z'),
    });

    expect(mockUpdatePatient).toHaveBeenCalledWith(
      clinicId,
      patientId,
      expect.objectContaining({ name: 'Maria Updated', phone: '11999991111' }),
    );
    expect(result.status).toBe('converted');
  });

  it('does not convert lead when scheduling fails', async () => {
    mockFindLead.mockResolvedValue(baseLead as any);
    mockCreatePatient.mockResolvedValue({ id: patientId });
    mockScheduleAppointment.mockRejectedValue(new Error('Horário indisponível'));

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
    mockCreatePatient.mockResolvedValue({ id: patientId });
    mockUpdateLead.mockResolvedValue({ id: leadId });
    mockInsertActivity.mockResolvedValue({ id: 'act-1' });

    const { converterLeadSemAgendar } = await import('../../services/lead-conversion-service');
    const result = await converterLeadSemAgendar({ leadId, clinicId, actorUserId: null });

    // Creates patient from lead data
    expect(mockCreatePatient).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId, name: 'Maria', phone: '11999990000' }),
    );

    // No scheduling call
    expect(mockScheduleAppointment).not.toHaveBeenCalled();

    expect(result).toMatchObject({ leadId, status: 'converted' });
  });

  it('updates patient data when lead differs from existing patient', async () => {
    mockFindLead.mockResolvedValue({ ...baseLead, patientId, name: 'Maria Updated', phoneNormalized: '11999991111', phone: '11999991111' } as any);
    mockGetPatient.mockResolvedValue({ id: patientId, name: 'Maria', phone: '11999990000' });
    mockUpdatePatient.mockResolvedValue({ id: patientId });
    mockUpdateLead.mockResolvedValue({ id: leadId });
    mockInsertActivity.mockResolvedValue({ id: 'act-1' });

    const { converterLeadSemAgendar } = await import('../../services/lead-conversion-service');
    const result = await converterLeadSemAgendar({ leadId, clinicId, actorUserId: null });

    expect(mockUpdatePatient).toHaveBeenCalledWith(
      clinicId,
      patientId,
      expect.objectContaining({ name: 'Maria Updated', phone: '11999991111' }),
    );
    expect(result).toMatchObject({ leadId, status: 'converted' });
  });

  it('throws when lead is already converted', async () => {
    mockFindLead.mockResolvedValue({ ...baseLead, status: 'converted' } as any);

    const { converterLeadSemAgendar } = await import('../../services/lead-conversion-service');

    await expect(converterLeadSemAgendar({ leadId, clinicId, actorUserId: null })).rejects.toThrow('Lead already converted');
    expect(mockUpdateLead).not.toHaveBeenCalled();
  });

  it('throws when lead is not found', async () => {
    (mockFindLead as jest.Mock).mockResolvedValue(null);

    const { converterLeadSemAgendar } = await import('../../services/lead-conversion-service');

    await expect(converterLeadSemAgendar({ leadId, clinicId, actorUserId: null })).rejects.toThrow('Lead not found');
    expect(mockUpdateLead).not.toHaveBeenCalled();
  });
});
