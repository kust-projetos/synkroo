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
 * Uses a Map cache so the same ID always returns the same color.
 */
const colorCache = new Map<string, string>()

export function getDentistColor(dentistId: string, fallbackIndex?: number): string {
  const cached = colorCache.get(dentistId)
  if (cached) return cached

  // Deterministic pick from ID hash if no index provided
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

  const color = DENTIST_PALETTE[index % DENTIST_PALETTE.length]
  colorCache.set(dentistId, color)
  return color
}

export function clearDentistColorCache(): void {
  colorCache.clear()
}
