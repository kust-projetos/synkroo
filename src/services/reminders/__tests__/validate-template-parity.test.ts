/**
 * P1A-SOFT-CAST — paridade validateTemplate nas 3 vias.
 *
 * As 3 vias delegam à canônica (@/lib/templates/reminder-template): aceitam
 * e rejeitam exatamente igual (flag + erros idênticos).
 */
import { validateTemplate as viaServices } from '../procedure-reminder-config.service'
import { validateTemplate as viaOperacional } from '@/modules/operacional/services/procedure-reminder-config-service'
import { validateTemplate as viaUI } from '@/components/whatsapp/reminder-config-types'

const LONG = 'x'.repeat(1601)

const MATRIX: Array<[string, string]> = [
  ['válido completo', 'Olá {{paciente_nome}}, consulta de {{procedimento}} {{data}} às {{horario}} com {{dentista}}'],
  ['válido mínimo (só obrigatórios)', '{{paciente_nome}} {{data}} {{horario}}'],
  ['faltando obrigatório', 'Olá {{paciente_nome}}, consulta {{data}}'],
  ['placeholder não suportado', 'Olá {{invalid_placeholder}} {{paciente_nome}} {{data}} {{horario}}'],
  ['padrão inválido', 'Olá {{foo-bar}} {{paciente_nome}} {{data}} {{horario}}'],
  ['desbalanceado', 'Olá {{paciente_nome}, {{data}} {{horario}}'],
  ['vazio', ''],
  ['longo demais', `{{paciente_nome}} {{data}} {{horario}} ${LONG}`],
  ['sem placeholder', 'Olá, sua consulta é amanhã'],
]

describe('validateTemplate — paridade das 3 vias', () => {
  it.each(MATRIX)('%s: aceita/rejeita igual nas 3 vias', (_label, tpl) => {
    const a = viaServices(tpl)
    const b = viaOperacional(tpl)
    const c = viaUI(tpl)
    expect(b.valid).toBe(a.valid)
    expect(c.valid).toBe(a.valid)
    expect(b.errors).toEqual(a.errors)
    expect(c.errors).toEqual(a.errors)
  })

  it('aceita o template padrão e rejeita placeholder desconhecido', () => {
    const ok = 'Olá {{paciente_nome}}! Aqui é da clínica. Lembrando que você tem uma consulta de {{procedimento}} marcada para {{data}} às {{horario}} com {{dentista}}. Por favor, confirme sua presença.'
    for (const fn of [viaServices, viaOperacional, viaUI]) {
      expect(fn(ok).valid).toBe(true)
      expect(fn('Olá {{unknown_field}}').valid).toBe(false)
    }
  })
})
