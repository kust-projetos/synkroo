import {
  calculateDaysSinceLastVisit,
  getInactivitySegment,
  INACTIVITY_SEGMENTS,
} from '@/services/followup/inactive-patient.service';

describe('inactive-patient pure helpers — F7.03 segmentation', () => {
  test('calculateDaysSinceLastVisit branches', () => {
    expect(calculateDaysSinceLastVisit(null)).toBe(999);
    const recent = new Date(Date.now() - 5 * 24 * 3600 * 1000);
    expect(calculateDaysSinceLastVisit(recent)).toBeGreaterThanOrEqual(5);
    const today = new Date();
    expect(calculateDaysSinceLastVisit(today)).toBe(0);
  });

  test('getInactivitySegment finds correct bucket', () => {
    expect(getInactivitySegment(10)).toBeNull();
    expect(getInactivitySegment(30)?.segment).toBe('inactive_30');
    expect(getInactivitySegment(59)?.segment).toBe('inactive_30');
    expect(getInactivitySegment(60)?.segment).toBe('inactive_60');
    expect(getInactivitySegment(89)?.segment).toBe('inactive_60');
    expect(getInactivitySegment(90)?.segment).toBe('inactive_90');
    expect(getInactivitySegment(179)?.segment).toBe('inactive_90');
    expect(getInactivitySegment(180)?.segment).toBe('inactive_180');
    expect(getInactivitySegment(999)?.segment).toBe('inactive_180');
    expect(getInactivitySegment(10000)).toBeNull();
  });

  test('INACTIVITY_SEGMENTS ordered and priority', () => {
    expect(INACTIVITY_SEGMENTS).toHaveLength(4);
    expect(INACTIVITY_SEGMENTS.map((s) => s.priority)).toEqual([1, 2, 3, 4]);
    expect(INACTIVITY_SEGMENTS[0].label).toContain('30');
  });

  test('100% failure segment maps to highest priority for sorting', () => {
    // simulate sorting used in identifyInactivePatients: inactive_180 > inactive_30
    const a = { inactivitySegment: 'inactive_30', riskScore: 10 } as any;
    const b = { inactivitySegment: 'inactive_180', riskScore: 1 } as any;
    const sorted = [a, b].sort((x: any, y: any) => {
      const xp = INACTIVITY_SEGMENTS.find((s) => s.segment === x.inactivitySegment)?.priority || 0;
      const yp = INACTIVITY_SEGMENTS.find((s) => s.segment === y.inactivitySegment)?.priority || 0;
      if (xp !== yp) return yp - xp;
      return y.riskScore - x.riskScore;
    });
    expect(sorted[0].inactivitySegment).toBe('inactive_180');
  });
});
