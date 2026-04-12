// src/components/calendar/utils/dentist-colors.ts

const DENTIST_PALETTE = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
] as const

/**
 * Get a deterministic color for a dentist.
 * Color is computed directly from ID hash - no caching needed since
 * the computation is a simple hash that's faster than Map lookup.
 */
export function getDentistColor(dentistId: string, fallbackIndex?: number): string {
  let index: number
  if (fallbackIndex !== undefined) {
    index = fallbackIndex
  } else {
    let hash = 0
    for (let i = 0; i < dentistId.length; i++) {
      hash = ((hash << 5) - hash + dentistId.charCodeAt(i)) | 0
    }
    index = Math.abs(hash)
  }

  return DENTIST_PALETTE[index % DENTIST_PALETTE.length]
}

/**
 * @deprecated No-op. Color is computed directly from dentist ID hash,
 * so no cache invalidation is needed.
 */
export function clearDentistColorCache(): void {
  // No-op: removed module-level cache, no invalidation needed
}
