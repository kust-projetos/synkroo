/**
 * Locale: pt-BR — currency/percent/date formatting.
 * No external libs; Intl.NumberFormat + Intl.DateTimeFormat only.
 */

const NBSP = '\u00A0'
const fmtRaw = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function brl(cents: number): string {
  // Normalise U+00A0 → ASCII space so the output is test-stable and copy-friendly.
  return fmtRaw.format(cents).replace(new RegExp(NBSP, 'g'), ' ')
}

const monthShort = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

/** Render integer cents as Brazilian currency ("R$ 29.550,70"). */
export function formatCurrency(cents: number): string {
  const n = Number.isFinite(cents) ? Math.trunc(cents) : 0
  if (n < 0) return '-' + brl(-n / 100)
  return brl(n / 100)
}

/** Render a 0..1 (or 0..100) ratio as percent with 1 decimal ("34,2%"). */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0,0%'
  // accept both 0..1 and 0..100 inputs; range-detection for safety
  const ratio = value > 1.5 ? value / 100 : value
  const clamped = Math.max(0, ratio)
  return `${(clamped * 100).toFixed(1).replace('.', ',')}%`
}

/**
 * Short date label used in the live UI list ("5 JUL", "12 JUN", "Hoje").
 * Accepts YYYY-MM-DD or Date. `now` is injectable so the "Hoje" branch is
 * unit-testable regardless of when the suite runs.
 */
export function formatDateLabel(input: string | Date, now: Date = new Date()): string {
  const d = typeof input === 'string' ? new Date(input + (input.length === 10 ? 'T00:00:00Z' : '')) : input
  if (Number.isNaN(d.getTime())) return ''
  const sameDay = (a: Date, b: Date) =>
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  if (sameDay(d, now)) return 'Hoje'
  const day = d.getUTCDate()
  const month = monthShort[d.getUTCMonth()] ?? '???'
  return `${day} ${month}`
}
