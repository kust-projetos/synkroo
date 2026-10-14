import {
  IA_ACTIVITY_RECENT_LIMIT,
  journeyStateLabel,
  runStatusLabel,
} from '../ia-activity'

describe('P8 Slice 1 — labels de atividade IA', () => {
  it('limite de recentes é 20', () => {
    expect(IA_ACTIVITY_RECENT_LIMIT).toBe(20)
  })

  it('run observed → proposta observada (literais do critério 3)', () => {
    expect(runStatusLabel('observed')).toBe('proposta observada')
  })

  it('demais status de run têm rótulo pt-BR', () => {
    expect(runStatusLabel('queued')).toBe('em observação')
    expect(runStatusLabel('failed')).toBe('falha na observação')
  })

  it('status desconhecido cai no próprio literal (nunca vazio)', () => {
    expect(runStatusLabel('suspended')).toBe('suspended')
    expect(journeyStateLabel('migrated')).toBe('migrated')
  })

  it('states de journey P7 têm rótulo pt-BR', () => {
    expect(journeyStateLabel('waiting_due')).toBe('aguardando acompanhamento')
    expect(journeyStateLabel('recommended')).toBe('recomendação gerada')
    expect(journeyStateLabel('waiting_feedback')).toBe('aguardando retorno')
    expect(journeyStateLabel('completed')).toBe('acompanhamento concluído')
    expect(journeyStateLabel('expired')).toBe('acompanhamento expirado')
    expect(journeyStateLabel('stopped')).toBe('acompanhamento interrompido')
  })
})
