/**
 * Timezone utilities for clinic-aware scheduling.
 *
 * Clinic wall times (schedule_blocks 08:00 etc.) are stored timezone-naive.
 * Appointments are stored as UTC timestamptz. Conversions use Intl.DateTimeFormat
 * so no external dependency (date-fns-tz) is required and DST is handled
 * by the ICU data in Node.
 */

export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, mi, sRaw] = timeStr.split(':').map(Number);
  const s = Number.isFinite(sRaw) ? sRaw : 0;
  // Handle milliseconds in timeStr like '23:59:59.999' — strip after dot if present
  const ms = timeStr.includes('.') ? Number(timeStr.split('.')[1].padEnd(3, '0').slice(0, 3)) : 0;

  let utc = new Date(Date.UTC(y, m - 1, d, h, mi, s, ms));

  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(utc);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    const wallYear = Number(get('year'));
    const wallMonth = Number(get('month'));
    const wallDay = Number(get('day'));
    const wallHour = Number(get('hour'));
    const wallMinute = Number(get('minute'));
    const wallSecond = Number(get('second'));

    const asWallUTC = Date.UTC(wallYear, wallMonth - 1, wallDay, wallHour, wallMinute, wallSecond, ms);
    const desiredWallUTC = Date.UTC(y, m - 1, d, h, mi, s, ms);
    const diff = desiredWallUTC - asWallUTC;
    if (diff === 0) break;
    utc = new Date(utc.getTime() + diff);
  }
  return utc;
}

export function getDayOfWeekInTimezone(dateStr: string, timeZone: string): number {
  const utcNoon = zonedTimeToUtc(dateStr, '12:00:00', timeZone);
  const weekdayStr = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(utcNoon);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const v = map[weekdayStr];
  if (v !== undefined) return v;
  // Fallback via getUTCDay of noon in target tz? Use formatToParts
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).formatToParts(utcNoon);
  const long = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const longMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
  };
  return longMap[long] ?? 0;
}

export function getDayRangeUtc(dateStr: string, timeZone: string): { start: Date; end: Date } {
  const start = zonedTimeToUtc(dateStr, '00:00:00', timeZone);
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + 1);
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  const nextStart = zonedTimeToUtc(nextStr, '00:00:00', timeZone);
  const end = new Date(nextStart.getTime() - 1);
  return { start, end };
}

export function resolveClinicTimezone(row: { timezone?: string | null; settings?: unknown } | null): string {
  if (!row) return 'America/Sao_Paulo';
  const tz = (row as { timezone?: string | null }).timezone;
  if (typeof tz === 'string' && tz.trim()) return tz.trim();
  const settings = (row as { settings?: unknown }).settings;
  if (settings && typeof settings === 'object') {
    const s = settings as Record<string, unknown>;
    if (typeof s.timezone === 'string' && (s.timezone as string).trim()) return (s.timezone as string).trim();
  }
  if (typeof settings === 'string') {
    try {
      const parsed = JSON.parse(settings) as Record<string, unknown>;
      if (typeof parsed.timezone === 'string' && parsed.timezone.trim()) return parsed.timezone.trim();
    } catch {
      // ignore
    }
  }
  return 'America/Sao_Paulo';
}
