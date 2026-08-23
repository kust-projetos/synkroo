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

import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { clinics } from '@/lib/db/schema/core';
import * as repo from '../repositories/appointments-repository';
import {
  getDayOfWeekInTimezone,
  getDayRangeUtc,
  resolveClinicTimezone,
  zonedTimeToUtc,
} from '@/lib/timezone';

export interface SlotQuery {
  clinicId: string;
  dentistId: string;
  date: string; // 'YYYY-MM-DD'
  slotMinutes?: number;
}

export async function getClinicTimezone(clinicId: string): Promise<string> {
  try {
    const db = getDb();
    const rows = await db
      .select({ timezone: clinics.timezone, settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);
    if (rows[0]) return resolveClinicTimezone(rows[0] as { timezone?: string | null; settings?: unknown });
    return 'America/Sao_Paulo';
  } catch {
    // In unit tests or when DB is unavailable, fall back to default (treat as America/Sao_Paulo)
    return 'America/Sao_Paulo';
  }
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
 * Timezone is resolved per clinic (clinics.timezone or settings.timezone),
 * defaulting to America/Sao_Paulo. All returned ISO strings are UTC.
 */
export async function consultarDisponibilidade(q: SlotQuery): Promise<string[]> {
  const slotMinutes = q.slotMinutes ?? 30;
  const timeZone = await getClinicTimezone(q.clinicId);
  const dayOfWeek = getDayOfWeekInTimezone(q.date, timeZone);

  const blocks = await repo.getScheduleBlocksForDay(
    q.clinicId,
    q.dentistId,
    dayOfWeek,
  );

  if (blocks.length === 0) return [];

  const { start: dayStart, end: dayEnd } = getDayRangeUtc(q.date, timeZone);

  const booked = await repo.bookedSlots(q.clinicId, q.dentistId, dayStart, dayEnd);

  return computeFreeSlots(q.date, blocks, booked, slotMinutes, timeZone);
}

function computeFreeSlots(
  date: string,
  blocks: ScheduleBlock[],
  booked: BlockSlot[],
  slotMinutes: number,
  timeZone: string,
): string[] {
  const out: string[] = [];

  for (const block of blocks) {
    let current = timeToMinutes(block.startTime);
    const end = timeToMinutes(block.endTime);

    while (current + slotMinutes <= end) {
      const slotStart = minutesToTime(current);

      // Clinic wall time → UTC for correct overlap with UTC-stored appointments
      const slotStartUtc = zonedTimeToUtc(date, slotStart, timeZone);
      const slotEndUtc = new Date(slotStartUtc.getTime() + slotMinutes * 60_000);

      const isBooked = booked.some((appt) => {
        const apptStart = new Date(appt.scheduledAt);
        const apptEnd = new Date(
          apptStart.getTime() + (appt.durationMinutes ?? 30) * 60_000,
        );
        // Overlap: slot starts before appt ends AND slot ends after appt starts
        return slotStartUtc < apptEnd && slotEndUtc > apptStart;
      });

      if (!isBooked) {
        out.push(slotStartUtc.toISOString());
      }

      current += slotMinutes;
    }
  }

  return out;
}
