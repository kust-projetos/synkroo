/**
 * Financeiro — dashboard service.
 *
 * Aggregation and formatting logic for the Financeiro dashboard.
 */

/**
 * Render a ratio (0–1) as a percentage string.
 * Returns '—' for null/undefined.
 */
export function renderRatio(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}
