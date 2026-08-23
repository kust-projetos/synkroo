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

  it('getDayRangeUtc for SP gives 03:00 UTC start', () => {
    const { start, end } = getDayRangeUtc('2026-08-04', 'America/Sao_Paulo');
    expect(start.toISOString()).toBe('2026-08-04T03:00:00.000Z'); // 00:00 SP = 03:00 UTC
    expect(end.toISOString()).toBe('2026-08-05T02:59:59.999Z');
  });

  it('getDayRangeUtc for NY gives 04:00 UTC start (EDT)', () => {
    const { start } = getDayRangeUtc('2026-08-04', 'America/New_York');
    expect(start.toISOString()).toBe('2026-08-04T04:00:00.000Z'); // 00:00 NY = 04:00 UTC
  });

  it('resolveClinicTimezone prefers column, then settings, then default', () => {
    expect(resolveClinicTimezone({ timezone: 'Europe/Lisbon', settings: {} })).toBe('Europe/Lisbon');
    expect(resolveClinicTimezone({ timezone: null, settings: { timezone: 'Europe/Berlin' } })).toBe('Europe/Berlin');
    expect(resolveClinicTimezone({ timezone: '  ', settings: { timezone: '  ' } })).toBe('America/Sao_Paulo');
    expect(resolveClinicTimezone(null)).toBe('America/Sao_Paulo');
    expect(resolveClinicTimezone({ timezone: null, settings: null })).toBe('America/Sao_Paulo');
  });
});
