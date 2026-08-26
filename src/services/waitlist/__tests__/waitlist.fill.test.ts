/**
 * Unit tests for waitlist service fill slot & CRUD methods
 */

import {
  fillWaitlistSlot,
  getWaitlistEntryById,
  updateWaitlistEntry,
} from '../waitlist.service';

jest.mock('@/repositories/waitlist', () => ({
  createWaitlistEntry: jest.fn(),
  findByPatientClinicDate: jest.fn(),
  findByClinic: jest.fn(),
  findMatchingEntries: jest.fn(),
  markNotified: jest.fn(),
  markScheduled: jest.fn(),
  cancelEntry: jest.fn(),
  expireOldEntries: jest.fn(),
  findById: jest.fn(),
  updateEntry: jest.fn(),
  fillSlot: jest.fn(),
}));

const mockRepo = require('@/repositories/waitlist');

describe('Waitlist Service - Fill & Extra CRUD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fillWaitlistSlot', () => {
    it('calls repository fillSlot and returns result', async () => {
      mockRepo.fillSlot.mockResolvedValueOnce({
        appointmentId: 'appt-123',
        waitlistId: 'w-1',
        alreadyScheduled: false,
      });

      const res = await fillWaitlistSlot({
        clinicId: 'clinic-1',
        waitlistId: 'w-1',
        scheduledAt: new Date('2026-12-01T10:00:00Z'),
        durationMinutes: 30,
      });

      expect(res.success).toBe(true);
      expect(res.appointmentId).toBe('appt-123');
      expect(res.alreadyScheduled).toBe(false);
      expect(mockRepo.fillSlot).toHaveBeenCalledWith(
        'clinic-1',
        expect.objectContaining({
          waitlistId: 'w-1',
          durationMinutes: 30,
        }),
      );
    });

    it('returns error when repository rejects', async () => {
      mockRepo.fillSlot.mockRejectedValueOnce(new Error('DB conflict'));

      const res = await fillWaitlistSlot({
        clinicId: 'clinic-1',
        waitlistId: 'w-1',
        scheduledAt: new Date('2026-12-01T10:00:00Z'),
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('DB conflict');
    });

    it('F5.04 fill idempotent: second call returns same appointmentId with alreadyScheduled', async () => {
      mockRepo.fillSlot
        .mockResolvedValueOnce({ appointmentId: 'appt-123', waitlistId: 'w-1', alreadyScheduled: false })
        .mockResolvedValueOnce({ appointmentId: 'appt-123', waitlistId: 'w-1', alreadyScheduled: true });

      const a = await fillWaitlistSlot({
        clinicId: 'clinic-1',
        waitlistId: 'w-1',
        scheduledAt: new Date('2026-12-01T10:00:00Z'),
      });
      const b = await fillWaitlistSlot({
        clinicId: 'clinic-1',
        waitlistId: 'w-1',
        scheduledAt: new Date('2026-12-01T10:00:00Z'),
      });

      expect(a.appointmentId).toBe('appt-123');
      expect(b.appointmentId).toBe('appt-123');
      expect(a.alreadyScheduled).toBe(false);
      expect(b.alreadyScheduled).toBe(true);
      expect(mockRepo.fillSlot).toHaveBeenCalledTimes(2);
    });
  });

  describe('getWaitlistEntryById', () => {
    it('returns mapped entry when found', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        id: 'w-1',
        clinicId: 'clinic-1',
        patientId: 'p-1',
        preferredDate: new Date('2026-12-01T00:00:00Z'),
        preferredTimeStart: '10:00',
        preferredTimeEnd: '11:00',
        status: 'waiting',
        priority: 5,
        createdAt: new Date('2026-11-01T00:00:00Z'),
        patients: { name: 'Maria', phone: '11988888888' },
      });

      const res = await getWaitlistEntryById('w-1', 'clinic-1');
      expect(res).not.toBeNull();
      expect(res?.patientName).toBe('Maria');
      expect(res?.status).toBe('waiting');
    });

    it('returns null when not found', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      const res = await getWaitlistEntryById('non-existent', 'clinic-1');
      expect(res).toBeNull();
    });
  });

  describe('updateWaitlistEntry', () => {
    it('updates entry via repository', async () => {
      mockRepo.updateEntry.mockResolvedValueOnce(true);
      const res = await updateWaitlistEntry('w-1', { priority: 8, notes: 'VIP' });
      expect(res.success).toBe(true);
      expect(mockRepo.updateEntry).toHaveBeenCalledWith('w-1', { priority: 8, notes: 'VIP' });
    });
  });
});
