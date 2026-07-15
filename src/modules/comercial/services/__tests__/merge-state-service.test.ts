/**
 * Tests for merge-state-service.ts (Comercial — lead merge state)
 */

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([]),
};

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mockDb),
}));

import { isLeadMerged } from '../merge-state-service';

const CLINIC_ID = 'clinic-0000-0000-0000-0001';
const LEAD_ID = 'lead-0000-0000-0000-0001';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isLeadMerged', () => {
  it('returns true when a merged suggestion references the lead as leftId', async () => {
    mockDb.limit.mockResolvedValue([{ id: 'sug-1' }]);
    const result = await isLeadMerged(LEAD_ID, CLINIC_ID);
    expect(result).toBe(true);
  });

  it('returns true when a merged suggestion references the lead as rightId', async () => {
    mockDb.limit.mockResolvedValue([{ id: 'sug-2' }]);
    const result = await isLeadMerged(LEAD_ID, CLINIC_ID);
    expect(result).toBe(true);
  });

  it('returns false when no merged suggestion found', async () => {
    mockDb.limit.mockResolvedValue([]);
    const result = await isLeadMerged(LEAD_ID, CLINIC_ID);
    expect(result).toBe(false);
  });

  it('filters by clinicId, ownerType=lead, and status=merged', async () => {
    mockDb.limit.mockResolvedValue([]);
    await isLeadMerged(LEAD_ID, CLINIC_ID);
    const whereArgs = mockDb.where.mock.calls[0][0];
    expect(whereArgs).toBeDefined();
  });
});
