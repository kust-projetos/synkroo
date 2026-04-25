/**
 * Score thresholds for lead temperature display
 *
 * Configurable thresholds via theme constants - NOT hardcoded
 * Default: COLD < 30 (red), WARM 30-60 (yellow), HOT > 60 (green)
 */

export const SCORE_THRESHOLDS = {
  cold: { max: 30, color: 'bg-red-500', label: 'Frio' },
  warm: { min: 30, max: 60, color: 'bg-yellow-500', label: 'Morno' },
  hot: { min: 60, color: 'bg-green-500', label: 'Quente' }
} as const

/**
 * Get the color class for a given score
 */
export function getScoreColor(score: number): string {
  if (score < SCORE_THRESHOLDS.cold.max) return SCORE_THRESHOLDS.cold.color
  if (score < SCORE_THRESHOLDS.hot.min) return SCORE_THRESHOLDS.warm.color
  return SCORE_THRESHOLDS.hot.color
}

/**
 * Get the label for a given score
 */
export function getScoreLabel(score: number): string {
  if (score < SCORE_THRESHOLDS.cold.max) return SCORE_THRESHOLDS.cold.label
  if (score < SCORE_THRESHOLDS.hot.min) return SCORE_THRESHOLDS.warm.label
  return SCORE_THRESHOLDS.hot.label
}
