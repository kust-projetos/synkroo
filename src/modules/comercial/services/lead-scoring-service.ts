/**
 * Comercial module — lead scoring service.
 *
 * Pure functions: no DB, no side effects.
 * Calculates lead score based on engagement signals.
 */

export type LeadTemperature = 'cold' | 'warm' | 'hot';

export interface LeadScoreInput {
  source: string;
  hasPhone: boolean;
  hasEmail: boolean;
  expressedInterest: boolean;
  askedBudget: boolean;
  hasTimeline: boolean;
  respondedToFollowup: boolean;
  previousPatient: boolean;
}

export interface ScoreFactor {
  name: string;
  points: number;
  reason: string;
}

export interface LeadScoreResult {
  score: number;
  temperature: LeadTemperature;
  factors: ScoreFactor[];
}

const SOURCE_SCORES: Record<string, number> = {
  whatsapp: 15,
  instagram: 10,
  web: 5,
  indicacao: 10,
  organic: 5,
};

/**
 * Classify a numeric score into hot/warm/cold.
 */
export function getLeadTemperature(score: number): LeadTemperature {
  if (score >= 70) return 'hot';
  if (score >= 31) return 'warm';
  return 'cold';
}

/**
 * Calculate lead score from engagement signals.
 * Returns total score, temperature classification, and per-factor breakdown.
 */
export function calculateLeadScore(input: LeadScoreInput): LeadScoreResult {
  const factors: ScoreFactor[] = [];

  // Source signal
  const sourceScore = SOURCE_SCORES[input.source] ?? 0;
  if (sourceScore > 0) {
    factors.push({ name: `source_${input.source}`, points: sourceScore, reason: `Lead origin: ${input.source}` });
  }

  // Contact signals
  if (input.hasPhone) {
    factors.push({ name: 'has_phone', points: 20, reason: 'Phone number provided' });
  }
  if (input.hasEmail) {
    factors.push({ name: 'has_email', points: 5, reason: 'Email provided' });
  }

  // Engagement signals
  if (input.expressedInterest) {
    factors.push({ name: 'expressed_interest', points: 15, reason: 'Expressed interest in treatment' });
  }
  if (input.askedBudget) {
    factors.push({ name: 'asked_budget', points: 20, reason: 'Asked about budget/pricing' });
  }
  if (input.hasTimeline) {
    factors.push({ name: 'has_timeline', points: 10, reason: 'Has timeline for treatment' });
  }
  if (input.respondedToFollowup) {
    factors.push({ name: 'responded_followup', points: 10, reason: 'Responded to follow-up' });
  }

  // Relationship signals
  if (input.previousPatient) {
    factors.push({ name: 'previous_patient', points: 15, reason: 'Previous patient of the clinic' });
  }

  const score = factors.reduce((sum, f) => sum + f.points, 0);
  const temperature = getLeadTemperature(score);

  return { score, temperature, factors };
}
