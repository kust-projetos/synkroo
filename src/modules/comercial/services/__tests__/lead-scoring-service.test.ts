/**
 * Unit tests: Comercial lead scoring service (Task 2).
 *
 * Pure logic — no DB, no mocks needed.
 */

import { getLeadTemperature, calculateLeadScore } from '../../services/lead-scoring-service';
import type { LeadScoreInput } from '../../services/lead-scoring-service';

describe('getLeadTemperature', () => {
  it('classifies hot at 70', () => {
    expect(getLeadTemperature(70)).toBe('hot');
  });

  it('classifies hot above 70', () => {
    expect(getLeadTemperature(85)).toBe('hot');
  });

  it('classifies warm at 40', () => {
    expect(getLeadTemperature(40)).toBe('warm');
  });

  it('classifies warm between 31 and 69', () => {
    expect(getLeadTemperature(50)).toBe('warm');
    expect(getLeadTemperature(31)).toBe('warm');
    expect(getLeadTemperature(69)).toBe('warm');
  });

  it('classifies cold at 0', () => {
    expect(getLeadTemperature(0)).toBe('cold');
  });

  it('classifies cold below 30', () => {
    expect(getLeadTemperature(15)).toBe('cold');
    expect(getLeadTemperature(30)).toBe('cold');
  });
});

describe('calculateLeadScore', () => {
  const fullSignals: LeadScoreInput = {
    source: 'whatsapp',
    hasPhone: true,
    hasEmail: false,
    expressedInterest: true,
    askedBudget: true,
    hasTimeline: true,
    respondedToFollowup: false,
    previousPatient: false,
  };

  it('returns score, temperature and factors', () => {
    const result = calculateLeadScore(fullSignals);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('temperature');
    expect(result).toHaveProperty('factors');
    expect(Array.isArray(result.factors)).toBe(true);
  });

  it('adds budget and urgency signals for high score', () => {
    const result = calculateLeadScore(fullSignals);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.temperature).toBe('hot');
  });

  it('assigns lower score for minimal signals', () => {
    const result = calculateLeadScore({
      source: 'web',
      hasPhone: false,
      hasEmail: true,
      expressedInterest: false,
      askedBudget: false,
      hasTimeline: false,
      respondedToFollowup: false,
      previousPatient: false,
    });
    expect(result.score).toBeLessThan(30);
    expect(result.temperature).toBe('cold');
  });

  it('reports detailed factor breakdown', () => {
    const result = calculateLeadScore(fullSignals);
    const factorNames = result.factors.map((f) => f.name);
    expect(factorNames).toContain('source_whatsapp');
    expect(factorNames).toContain('has_phone');
    expect(factorNames).toContain('expressed_interest');
    expect(factorNames).toContain('asked_budget');
    expect(factorNames).toContain('has_timeline');
  });

  it('does not assign zero for all-zero input', () => {
    const result = calculateLeadScore({
      source: 'other',
      hasPhone: false,
      hasEmail: false,
      expressedInterest: false,
      askedBudget: false,
      hasTimeline: false,
      respondedToFollowup: false,
      previousPatient: false,
    });
    expect(result.score).toBe(0);
    expect(result.factors).toHaveLength(0);
  });

  it('adds previous patient bonus', () => {
    const withPrevious = calculateLeadScore({ ...fullSignals, previousPatient: true });
    const withoutPrevious = calculateLeadScore({ ...fullSignals, previousPatient: false });
    expect(withPrevious.score).toBeGreaterThan(withoutPrevious.score);
    expect(withPrevious.factors.some((f) => f.name === 'previous_patient')).toBe(true);
  });
});
