/**
 * P1A-SOFT-CAST — guard de status do money-path (installments).
 *
 * parseInstallmentStatus rejeita lixo em vez de propagar status fabricado.
 */
import { isInstallmentStatus, parseInstallmentStatus } from '@/modules/financeiro/services/installment-service'

describe('installment status guard', () => {
  it.each(['pending', 'paid', 'overdue', 'cancelled'])('aceita status válido %s', (s) => {
    expect(isInstallmentStatus(s)).toBe(true)
    expect(parseInstallmentStatus(s)).toBe(s)
  })

  it.each(['foo', '', 'PAID', 'scheduled', null, undefined, 123])('rejeita status inválido %p', (v) => {
    expect(isInstallmentStatus(v)).toBe(false)
    expect(() => parseInstallmentStatus(v)).toThrow(/Invalid installment status/)
  })
})
