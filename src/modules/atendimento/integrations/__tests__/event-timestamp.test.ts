import { parseProviderEventTimestamp } from '../event-timestamp';

describe('parseProviderEventTimestamp (no DB)', () => {
  it('accepts epoch seconds as number (WAHA) or numeric string (Meta)', () => {
    expect(parseProviderEventTimestamp(1711534800)).toBe('2024-03-27T10:20:00.000Z');
    expect(parseProviderEventTimestamp('1711534800')).toBe('2024-03-27T10:20:00.000Z');
    expect(parseProviderEventTimestamp(' 1711534800 ')).toBe('2024-03-27T10:20:00.000Z');
  });

  it('rejects missing, zero, negative, non-numeric and non-finite input', () => {
    expect(parseProviderEventTimestamp(undefined)).toBeUndefined();
    expect(parseProviderEventTimestamp(null)).toBeUndefined();
    expect(parseProviderEventTimestamp('')).toBeUndefined();
    expect(parseProviderEventTimestamp('   ')).toBeUndefined();
    expect(parseProviderEventTimestamp(0)).toBeUndefined();
    expect(parseProviderEventTimestamp(-5)).toBeUndefined();
    expect(parseProviderEventTimestamp(Number.NaN)).toBeUndefined();
    expect(parseProviderEventTimestamp(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(parseProviderEventTimestamp('not-a-timestamp')).toBeUndefined();
    expect(parseProviderEventTimestamp({})).toBeUndefined();
  });
});
