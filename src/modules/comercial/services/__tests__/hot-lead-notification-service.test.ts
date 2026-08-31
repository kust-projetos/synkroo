/**
 * Unit tests: Comercial hot lead notification service (Task 5).
 *
 * Tests recipient resolution and notification dispatch:
 * - assigned user with phone gets notification
 * - fallback to first active Owner/Admin phone
 * - no recipient → creates task, logs skipped
 * - already notified in 24h → no send
 */

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
jest.mock('@/modules/core/public', () => ({ listClinicUsers: jest.fn() }));
jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => ({
    transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback({})),
  })),
}));
jest.mock('@/lib/outbox/outbox-repository', () => ({ enqueueOutbox: jest.fn() }));

import { processarNotificacoesLeadsQuentesHandler } from '../../services/hot-lead-notification-service';
import * as leadsRepo from '../../repositories/leads-repository';
import * as tasksRepo from '../../repositories/tasks-repository';
import * as activitiesRepo from '../../repositories/activities-repository';

const mockListLeads = leadsRepo.listLeadsByClinic as jest.Mock;
const mockCreateTask = tasksRepo.createTask as jest.Mock;
const mockListActivitiesByLead = activitiesRepo.listActivitiesByLead as jest.Mock;
const mockListClinicUsers = require('@/modules/core/public').listClinicUsers as jest.Mock;
const mockEnqueueOutbox = require('@/lib/outbox/outbox-repository').enqueueOutbox as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockEnqueueOutbox.mockResolvedValue(undefined);
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
    mockListClinicUsers.mockResolvedValue([
      { id: 'user-1', phone: '5511999991111', isActive: true, roleName: null },
    ]);

    const result = await processarNotificacoesLeadsQuentesHandler({ clinicId });

    expect(result.notified).toBe(1);
    expect(mockEnqueueOutbox).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        operation: 'atendimento.outbound.message',
        payload: expect.objectContaining({ externalId: '5511999991111' }),
      }),
    );
  });

  it('falls back to first active owner/admin phone', async () => {
    mockListLeads.mockResolvedValue([{ ...hotLead, assignedTo: 'user-1' }]);
    mockListActivitiesByLead.mockResolvedValue([]);
    // assigned user exists but has no phone -> fallback to admin
    mockListClinicUsers.mockResolvedValue([
      { id: 'user-1', phone: null, isActive: true, roleName: null },
      { id: 'admin-1', phone: '5511999992222', isActive: true, roleName: 'Admin' },
    ]);

    const result = await processarNotificacoesLeadsQuentesHandler({ clinicId });

    expect(result.notified).toBe(1);
  });

  it('creates task when no recipient is available', async () => {
    mockListLeads.mockResolvedValue([{ ...hotLead, assignedTo: 'user-1', score: 90 }]);
    mockListActivitiesByLead.mockResolvedValue([]);
    mockCreateTask.mockResolvedValue({ id: 'task-1' });
    // assigned user found but no phone, fallback also empty
    mockListClinicUsers.mockResolvedValue([
      { id: 'user-1', phone: null, isActive: true, roleName: null },
    ]);

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
    expect(mockEnqueueOutbox).not.toHaveBeenCalled();
  });
});
