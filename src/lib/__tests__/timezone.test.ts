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
    expect(fmt(end)).toBe('2026-08-04, 23:59:59');
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
