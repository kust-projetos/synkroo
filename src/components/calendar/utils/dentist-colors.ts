// Deterministic color assignment for dentists

const DENTIST_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-400', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-400', dot: 'bg-emerald-500' },
  { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-400', dot: 'bg-violet-500' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-400', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-400', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-400', dot: 'bg-cyan-500' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-400', dot: 'bg-orange-500' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-400', dot: 'bg-pink-500' },
]

// Simple hash function for deterministic color index
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/** Get color classes for a dentist by ID */
export function getDentistColors(dentistId: string) {
  const index = hashString(dentistId) % DENTIST_COLORS.length
  return DENTIST_COLORS[index]
}

/** Get just the dot color for a dentist */
export function getDentistDotColor(dentistId: string): string {
  return getDentistColors(dentistId).dot
}

/** Get full color palette */
export function getDentistPalette(dentistId: string) {
  const colors = getDentistColors(dentistId)
  return {
    headerBg: colors.bg,
    headerText: colors.text,
    border: colors.border,
    dot: colors.dot,
  }
}
