import { getDayOfWeekInTimezone, getDayRangeUtc, zonedTimeToUtc, resolveClinicTimezone } from '../timezone';

describe('timezone utils', () => {
  it('zonedTimeToUtc converts SP 09:00 to 12:00 UTC', () => {
    const utc = zonedTimeToUtc('2026-08-04', '09:00:00', 'America/Sao_Paulo');
    expect(utc.toISOString()).toBe('2026-08-04T12:00:00.000Z');
  });

  it('zonedTimeToUtc converts NY EDT 09:00 to 13:00 UTC in August', () => {
    const utc = zonedTimeToUtc('2026-08-04', '09:00:00', 'America/New_York');
    expect(utc.toISOString()).toBe('2026-08-04T13:00:00.000Z');
  });

  it('zonedTimeToUtc converts Kiritimati +14 09:00 correctly', () => {
    // 2026-08-04 09:00 in Pacific/Kiritimati (UTC+14) = 2026-08-03 19:00 UTC
    const utc = zonedTimeToUtc('2026-08-04', '09:00:00', 'Pacific/Kiritimati');
    expect(utc.toISOString()).toBe('2026-08-03T19:00:00.000Z');
  });

  it('getDayOfWeekInTimezone returns Tuesday for 2026-08-04 in all tested zones', () => {
    expect(getDayOfWeekInTimezone('2026-08-04', 'America/Sao_Paulo')).toBe(2);
    expect(getDayOfWeekInTimezone('2026-08-04', 'America/New_York')).toBe(2);
    expect(getDayOfWeekInTimezone('2026-08-04', 'Pacific/Kiritimati')).toBe(2);
    expect(getDayOfWeekInTimezone('2026-08-04', 'UTC')).toBe(2);
  });

  it('getDayOfWeekInTimezone returns Monday for 2026-08-03', () => {
    expect(getDayOfWeekInTimezone('2026-08-03', 'America/Sao_Paulo')).toBe(1);
  });

  it('getDayRangeUtc for SP gives 00:00 SP wall time', () => {
    const { start, end } = getDayRangeUtc('2026-08-04', 'America/Sao_Paulo');
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, hourCycle: 'h23' }).format(d);
    expect(['2026-08-04, 00:00:00', '2026-08-03, 24:00:00']).toContain(fmt(start));
    expect(['2026-08-04, 23:59:59', '2026-08-03, 23:59:59']).toContain(fmt(end));
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('getDayRangeUtc for NY gives 00:00 NY wall time (EDT)', () => {
    const { start } = getDayRangeUtc('2026-08-04', 'America/New_York');
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, hourCycle: 'h23' }).format(d);
    expect(['2026-08-04, 00:00:00', '2026-08-03, 24:00:00']).toContain(fmt(start));
  });

  it('resolveClinicTimezone prefers column, then settings, then default', () => {
    expect(resolveClinicTimezone({ timezone: 'Europe/Lisbon', settings: {} })).toBe('Europe/Lisbon');
    expect(resolveClinicTimezone({ timezone: null, settings: { timezone: 'Europe/Berlin' } })).toBe('Europe/Berlin');
    expect(resolveClinicTimezone({ timezone: '  ', settings: { timezone: '  ' } })).toBe('America/Sao_Paulo');
    expect(resolveClinicTimezone(null)).toBe('America/Sao_Paulo');
    expect(resolveClinicTimezone({ timezone: null, settings: null })).toBe('America/Sao_Paulo');
  });
});

describe('timezone utils — Etapa 4 hardening', () => {
  const fmtWall = (d: Date, timeZone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, hourCycle: 'h23',
    }).format(d);

  it('UTC↔tz round-trip: wall time survives conversion both ways', () => {
    for (const tz of ['America/Sao_Paulo', 'America/New_York', 'UTC']) {
      const utc = zonedTimeToUtc('2026-08-04', '09:30:00', tz);
      expect(fmtWall(utc, tz)).toBe('2026-08-04, 09:30:00');
      // And back: formatting the instant in another zone shifts the wall clock
      const { start } = getDayRangeUtc('2026-08-04', tz);
      expect(fmtWall(start, tz)).toMatch(/2026-08-0[34], (00:00:00|24:00:00)/);
    }
  });

  it('midnight boundary: 00:00 and 23:59 local map to the expected UTC instants (SP, UTC-3)', () => {
    expect(zonedTimeToUtc('2026-08-04', '00:00:00', 'America/Sao_Paulo').toISOString())
      .toBe('2026-08-04T03:00:00.000Z');
    expect(zonedTimeToUtc('2026-08-04', '23:59:00', 'America/Sao_Paulo').toISOString())
      .toBe('2026-08-05T02:59:00.000Z');
    const { start, end } = getDayRangeUtc('2026-08-04', 'America/Sao_Paulo');
    expect(start.toISOString()).toBe('2026-08-04T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-05T02:59:59.999Z');
  });

  it('day-range across DST spring-forward (America/New_York 2026-03-08) is 23h', () => {
    const { start, end } = getDayRangeUtc('2026-03-08', 'America/New_York');
    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z'); // EST (UTC-5)
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000 - 1);
    expect(fmtWall(start, 'America/New_York')).toMatch(/2026-03-0[78], (00:00:00|24:00:00)/);
  });

  it('day-range across DST fall-back (America/New_York 2026-11-01) is 25h', () => {
    const { start, end } = getDayRangeUtc('2026-11-01', 'America/New_York');
    expect(start.toISOString()).toBe('2026-11-01T04:00:00.000Z'); // EDT (UTC-4)
    expect(end.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000 - 1);
  });

  it('America/Sao_Paulo post-2019 has no DST: summer and winter days are both 24h at UTC-3', () => {
    for (const date of ['2026-01-15', '2026-07-15']) {
      const { start, end } = getDayRangeUtc(date, 'America/Sao_Paulo');
      expect(start.toISOString()).toBe(`${date}T03:00:00.000Z`);
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
    }
  });

  it('user-tz ≠ clinic-tz: same calendar date resolves to different UTC ranges', () => {
    const clinic = getDayRangeUtc('2026-08-04', 'America/Sao_Paulo'); // UTC-3
    const user = getDayRangeUtc('2026-08-04', 'Asia/Tokyo'); // UTC+9
    // Tokyo midnight = previous day 15:00 UTC; SP midnight = same day 03:00 UTC
    expect(user.start.toISOString()).toBe('2026-08-03T15:00:00.000Z');
    expect(clinic.start.toISOString()).toBe('2026-08-04T03:00:00.000Z');
    expect(user.start.getTime()).not.toBe(clinic.start.getTime());
    // An instant can fall on different local dates per zone: 2026-08-04T01:00Z
    // is still 2026-08-03 in SP but already 2026-08-04 in Tokyo.
    const probe = new Date('2026-08-04T01:00:00.000Z');
    expect(fmtWall(probe, 'America/Sao_Paulo')).toContain('2026-08-03');
    expect(fmtWall(probe, 'Asia/Tokyo')).toContain('2026-08-04');
  });
});
