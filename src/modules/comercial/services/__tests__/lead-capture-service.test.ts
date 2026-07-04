/**
 * Unit tests: Comercial lead capture service (Task 2).
 *
 * Tests that captureLead:
 *  - upserts by phone_normalized (same phone → same lead)
 *  - writes lead_captured activity
 *  - delegates to repository for DB operations
 */

import { captureLead } from '../../services/lead-capture-service';
import * as leadsRepo from '../../repositories/leads-repository';
import * as activitiesRepo from '../../repositories/activities-repository';

// Mock both repositories
jest.mock('../../repositories/leads-repository');
jest.mock('../../repositories/activities-repository');

const mockUpsertLead = jest.mocked(leadsRepo.upsertLeadByPhoneNormalized);
const mockInsertActivity = jest.mocked(activitiesRepo.insertActivity);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('captureLead', () => {
  const clinicId = 'clinic-1';
  const baseInput = {
    clinicId,
    name: 'Maria Silva',
    phone: '(11) 99999-0000',
    source: 'whatsapp' as const,
  };

  it('calls upsertLeadByPhoneNormalized with normalized phone', async () => {
    mockUpsertLead.mockResolvedValue({ id: 'lead-1' });
    mockInsertActivity.mockResolvedValue({ id: 'activity-1' });

    await captureLead(baseInput);

    expect(mockUpsertLead).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId,
        name: 'Maria Silva',
        phone: '(11) 99999-0000',
        phoneNormalized: '11999990000',
        source: 'whatsapp',
      }),
    );
  });

  it('inserts lead_captured activity after upsert', async () => {
    mockUpsertLead.mockResolvedValue({ id: 'lead-1' });
    mockInsertActivity.mockResolvedValue({ id: 'activity-1' });

    await captureLead(baseInput);

    expect(mockInsertActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'lead-1',
        activityType: 'lead_captured',
      }),
    );
  });

  it('returns the lead id from upsert', async () => {
    mockUpsertLead.mockResolvedValue({ id: 'lead-abc' });
    mockInsertActivity.mockResolvedValue({ id: 'activity-1' });

    const result = await captureLead(baseInput);
    expect(result).toEqual({ leadId: 'lead-abc' });
  });

  it('normalizes phone removing non-digit chars', async () => {
    mockUpsertLead.mockResolvedValue({ id: 'lead-1' });
    mockInsertActivity.mockResolvedValue({ id: 'activity-1' });

    await captureLead({ ...baseInput, phone: '+55 (11) 98765-4321' });

    expect(mockUpsertLead).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNormalized: '5511987654321' }),
    );
  });

  it('re-throws repository errors', async () => {
    const dbError = new Error('DB_CONNECTION_ERROR');
    mockUpsertLead.mockRejectedValue(dbError);

    await expect(captureLead(baseInput)).rejects.toThrow('DB_CONNECTION_ERROR');
  });
});
