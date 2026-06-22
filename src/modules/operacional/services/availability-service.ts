/**
 * Operacional module — availability service.
 *
 * Returns free time slots for a dentist on a given date.
 * Combines schedule_blocks (available windows) with booked appointments
 * to compute which slots are free.
 *
 * Note: schedule_blocks times are timezone-naive time-of-day strings ('HH:mm:ss').
 * We parse them directly (not via Date) to avoid server timezone offset issues.
 */

import * as repo from '../repositories/appointments-repository';

export interface SlotQuery {
  clinicId: string;
  dentistId: string;
  date: string; // 'YYYY-MM-DD'
  slotMinutes?: number;
}

interface BlockSlot {
  scheduledAt: Date;
  durationMinutes: number | null;
}

interface ScheduleBlock {
  startTime: string; // 'HH:mm:ss' (timezone-naive)
  endTime: string;
}

/** Parse 'HH:mm:ss' → total minutes from midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** minutes-from-midnight → 'HH:mm:ss' (timezone-naive). */
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

/**
 * Returns free slot start-times (ISO strings) for a dentist/date.
 * Slot generation is driven by schedule_blocks + slotMinutes granularity.
 */
export async function consultarDisponibilidade(q: SlotQuery): Promise<string[]> {
  const slotMinutes = q.slotMinutes ?? 30;
  const dayOfWeek = new Date(q.date).getDay();

  const blocks = await repo.getScheduleBlocksForDay(
    q.clinicId,
    q.dentistId,
    dayOfWeek,
  );

  if (blocks.length === 0) return [];

  const dayStart = new Date(`${q.date}T00:00:00Z`);
  const dayEnd = new Date(`${q.date}T23:59:59Z`);

  const booked = await repo.bookedSlots(q.clinicId, q.dentistId, dayStart, dayEnd);

  return computeFreeSlots(q.date, blocks, booked, slotMinutes);
}

function computeFreeSlots(
  date: string,
  blocks: ScheduleBlock[],
  booked: BlockSlot[],
  slotMinutes: number,
): string[] {
  const out: string[] = [];

  for (const block of blocks) {
    let current = timeToMinutes(block.startTime);
    const end = timeToMinutes(block.endTime);

    while (current + slotMinutes <= end) {
      const slotStart = minutesToTime(current);
      const slotEnd = minutesToTime(current + slotMinutes);

      // Build Date from the timezone-naive time using UTC to get a stable reference
      // We compare in the same UTC coordinate system for consistency.
      // slotStartDate/slotEndDate are used only for overlap math (not display).
      const [sh, sm] = slotStart.split(':').map(Number);
      const [eh, em] = slotEnd.split(':').map(Number);
      const slotStartDate = new Date(Date.UTC(
        ...date.split('-').map(Number) as [number, number, number],
        sh, sm, 0, 0,
      ));
      const slotEndDate = new Date(slotStartDate.getTime() + slotMinutes * 60_000);

      const isBooked = booked.some((appt) => {
        const apptStart = new Date(appt.scheduledAt);
        const apptEnd = new Date(
          apptStart.getTime() + (appt.durationMinutes ?? 30) * 60_000,
        );
        // Overlap: slot starts before appt ends AND slot ends after appt starts
        return slotStartDate < apptEnd && slotEndDate > apptStart;
      });

      if (!isBooked) {
        out.push(slotStartDate.toISOString());
      }

      current += slotMinutes;
    }
  }

  return out;
}
