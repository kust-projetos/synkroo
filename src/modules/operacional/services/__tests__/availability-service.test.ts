/**
 * Unit test: availability-service — timezone-correct day-of-week.
 *
 * RED: under TZ=America/Sao_Paulo, `new Date('2026-08-04').getDay()`
 * returns 1 (Monday, because 2026-08-04 00:00 BRT = 2026-08-04 03:00 UTC,
 * so the parsed date IS Monday in BRT). But under TZ=UTC, it returns 2
 * (Tuesday, because 2026-08-04 00:00 UTC is the correct date).
 *
 * The service MUST use getUTCDay() so the computed day is the same
 * regardless of the server's local timezone.
 */

jest.mock('../../repositories/appointments-repository', () => ({
  getScheduleBlocksForDay: jest.fn(),
  bookedSlots: jest.fn(),
}));

import { consultarDisponibilidade } from '../availability-service';
import * as repo from '../../repositories/appointments-repository';

const CLINIC_ID = '00000000-0000-0000-0000-000000000001';
const DENTIST_ID = '00000000-0000-0000-0000-000000000002';

const mockBlocks = [
  { startTime: '08:00:00', endTime: '18:00:00' },
];

describe('availability-service — timezone-correct dayOfWeek', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (repo.getScheduleBlocksForDay as jest.Mock).mockResolvedValue(mockBlocks);
    (repo.bookedSlots as jest.Mock).mockResolvedValue([]);
  });

  it('queries getScheduleBlocksForDay with dayOfWeek=2 for 2026-08-04 (Tuesday) regardless of server TZ', async () => {
    await consultarDisponibilidade({
      clinicId: CLINIC_ID,
      dentistId: DENTIST_ID,
      date: '2026-08-04', // Tuesday in UTC
    });

    expect(repo.getScheduleBlocksForDay).toHaveBeenCalledWith(
      CLINIC_ID,
      DENTIST_ID,
      2, // Tuesday — must be the same in UTC, SP, or any TZ
    );
  });

  it('queries dayOfWeek=1 for a real Monday (2026-08-03) regardless of server TZ', async () => {
    await consultarDisponibilidade({
      clinicId: CLINIC_ID,
      dentistId: DENTIST_ID,
      date: '2026-08-03', // Monday in UTC
    });

    expect(repo.getScheduleBlocksForDay).toHaveBeenCalledWith(
      CLINIC_ID,
      DENTIST_ID,
      1, // Monday
    );
  });

  it('returns slots for 2026-08-04 when block is seeded for Tuesday (dayOfWeek=2)', async () => {
    await consultarDisponibilidade({
      clinicId: CLINIC_ID,
      dentistId: DENTIST_ID,
      date: '2026-08-04',
    });

    const slots = await consultarDisponibilidade({
      clinicId: CLINIC_ID,
      dentistId: DENTIST_ID,
      date: '2026-08-04',
    });

    // Should return slots from 08:00 to 17:30 in 30-min intervals
    expect(slots.length).toBeGreaterThan(0);
  });
});
