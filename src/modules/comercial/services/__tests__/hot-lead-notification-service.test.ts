/**
 * Unit tests: Comercial hot lead notification service (Task 5).
 *
 * Tests recipient resolution and notification dispatch:
 * - assigned user with phone gets notification
 * - fallback to first active Owner/Admin phone
 * - no recipient → creates task, logs skipped
 * - already notified in 24h → no send
 */

// All mocks must use inline jest.fn() — no variable references (hoisting)
jest.mock('@/core/actions/context', () => ({
  buildSystemContext: jest.fn().mockResolvedValue({
    clinicId: 'clinic-1',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'test' },
  }),
}));
jest.mock('@/core/actions/run', () => ({ runAction: jest.fn() }));

jest.mock('../../repositories/leads-repository', () => ({
  listLeadsByClinic: jest.fn(),
}));
jest.mock('../../repositories/tasks-repository', () => ({
  createTask: jest.fn(),
}));
jest.mock('../../repositories/activities-repository', () => ({
  listActivitiesByLead: jest.fn(),
  insertActivity: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { processarNotificacoesLeadsQuentesHandler } from '../../services/hot-lead-notification-service';
import * as leadsRepo from '../../repositories/leads-repository';
import * as tasksRepo from '../../repositories/tasks-repository';
import * as activitiesRepo from '../../repositories/activities-repository';

// Grab mock refs after imports
const mockRunAction = require('@/core/actions/run').runAction as jest.Mock;
const mockListLeads = leadsRepo.listLeadsByClinic as jest.Mock;
const mockCreateTask = tasksRepo.createTask as jest.Mock;
const mockListActivitiesByLead = activitiesRepo.listActivitiesByLead as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('processarNotificacoesLeadsQuentesHandler', () => {
  const clinicId = 'clinic-1';

  const hotLead = {
    id: 'lead-1',
    clinicId,
    name: 'Maria',
    phone: '11999990000',
    phoneNormalized: '11999990000',
    source: 'whatsapp',
    score: 85,
    temperature: 'hot',
    status: 'new',
    assignedTo: null,
    email: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  it('notifies when lead has assigned user with active phone', async () => {
    mockListLeads.mockResolvedValue([{ ...hotLead, assignedTo: 'user-1' }]);
    mockListActivitiesByLead.mockResolvedValue([]);
    // listClinicUsers returns assigned user with phone
    mockRunAction
      .mockResolvedValueOnce({ ok: true, data: { users: [{ id: 'user-1', phone: '5511999991111', isActive: true }] } })
      .mockResolvedValueOnce({ ok: true, data: { success: true } });

    const result = await processarNotificacoesLeadsQuentesHandler({ clinicId });

    expect(result.notified).toBe(1);
    expect(mockRunAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'atendimento.enviarMensagemDireta' }),
      expect.objectContaining({ externalId: '5511999991111' }),
      expect.any(Object),
    );
  });

  it('falls back to first active owner/admin phone', async () => {
    mockListLeads.mockResolvedValue([{ ...hotLead, assignedTo: 'user-1' }]);
    mockListActivitiesByLead.mockResolvedValue([]);
    // assigned user exists but has no phone → fallback to admin
    mockRunAction
      .mockResolvedValueOnce({ ok: true, data: { users: [{ id: 'user-1', phone: null, isActive: true }] } })
      .mockResolvedValueOnce({ ok: true, data: { users: [{ id: 'admin-1', role: 'admin', phone: '5511999992222', isActive: true }] } })
      .mockResolvedValueOnce({ ok: true, data: { success: true } });

    const result = await processarNotificacoesLeadsQuentesHandler({ clinicId });

    expect(mockRunAction.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(result.notified).toBe(1);
  });

  it('creates task when no recipient is available', async () => {
    mockListLeads.mockResolvedValue([{ ...hotLead, assignedTo: 'user-1', score: 90 }]);
    mockListActivitiesByLead.mockResolvedValue([]);
    mockCreateTask.mockResolvedValue({ id: 'task-1' });
    // assigned user found but no phone, fallback also empty
    mockRunAction
      .mockResolvedValueOnce({ ok: true, data: { users: [{ id: 'user-1', phone: null, isActive: true }] } })
      .mockResolvedValueOnce({ ok: true, data: { users: [] } });

    const result = await processarNotificacoesLeadsQuentesHandler({ clinicId });

    expect(result.skipped).toBe(1);
    expect(mockCreateTask).toHaveBeenCalled();
  });

  it('skips leads recently notified within 24h', async () => {
    mockListLeads.mockResolvedValue([hotLead]);
    mockListActivitiesByLead.mockResolvedValue([
      { activityType: 'hot_lead_notified', createdAt: new Date() } as any,
    ]);

    const result = await processarNotificacoesLeadsQuentesHandler({ clinicId });

    expect(result.skipped).toBe(1);
    expect(mockRunAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'atendimento.enviarMensagemDireta' }),
      expect.anything(),
      expect.anything(),
    );
  });
});
