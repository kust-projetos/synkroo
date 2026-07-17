/**
 * format.test.ts — currency/percent/date helpers.
 */
import { formatCurrency, formatPercent, formatDateLabel } from '@/lib/pi-finance/format'

describe('pi-finance format', () => {
  describe('formatCurrency', () => {
    it('renders Brazilian format with comma decimal and dot thousand separator', () => {
      expect(formatCurrency(0)).toBe('R$ 0,00')
      expect(formatCurrency(100)).toBe('R$ 1,00')
      expect(formatCurrency(123)).toBe('R$ 1,23')
      expect(formatCurrency(100000)).toBe('R$ 1.000,00')
      expect(formatCurrency(2955070)).toBe('R$ 29.550,70')
      expect(formatCurrency(3499500)).toBe('R$ 34.995,00')
    })

    it('handles negative values (credit-card bills)', () => {
      expect(formatCurrency(-56000)).toBe('-R$ 560,00')
    })

    it('coerces non-numeric input to 0', () => {
      // @ts-expect-error — testing runtime coercion
      expect(formatCurrency(undefined)).toBe('R$ 0,00')
    })
  })

  describe('formatPercent', () => {
    it('renders 1 decimal place', () => {
      expect(formatPercent(0)).toBe('0,0%')
      expect(formatPercent(0.342)).toBe('34,2%')
      expect(formatPercent(1)).toBe('100,0%')
      expect(formatPercent(0.5)).toBe('50,0%')
    })
  })

  describe('formatDateLabel', () => {
    // Fixed "now" so the suite is deterministic regardless of run date.
    const now = new Date('2026-07-05T12:00:00Z')

    it('renders short day + month-uppercase label for ISO dates not equal to today', () => {
      expect(formatDateLabel('2026-07-04', now)).toBe('4 JUL')
      expect(formatDateLabel('2026-06-12', now)).toBe('12 JUN')
      expect(formatDateLabel('2026-01-01', now)).toBe('1 JAN')
    })

    it('accepts Date objects', () => {
      expect(formatDateLabel(new Date('2026-03-15T00:00:00Z'), now)).toBe('15 MAR')
    })

    it('renders "Hoje" when the date matches the injected now', () => {
      expect(formatDateLabel('2026-07-05', now)).toBe('Hoje')
      expect(formatDateLabel(new Date('2026-07-05T08:00:00Z'), now)).toBe('Hoje')
    })

    it('falls back to default now when no second arg is passed', () => {
      const today = new Date()
      const iso = today.toISOString().slice(0, 10)
      expect(formatDateLabel(iso)).toBe('Hoje')
    })
  })
})
