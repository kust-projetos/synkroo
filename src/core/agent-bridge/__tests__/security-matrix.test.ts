import { classifyActionLevel, assertSystemAllowed } from '../security-matrix';

describe('classifyActionLevel', () => {
  it('read-only operational is livre', () => {
    expect(classifyActionLevel('operacional.consultarDisponibilidade')).toBe('livre');
    expect(classifyActionLevel('operacional.listarProcedimentos')).toBe('livre');
    expect(classifyActionLevel('operacional.obterProcedimento')).toBe('livre');
  });

  it('self mutation is confirmacao', () => {
    expect(classifyActionLevel('operacional.agendarConsulta')).toBe('confirmacao');
    expect(classifyActionLevel('operacional.confirmarConsulta')).toBe('confirmacao');
    expect(classifyActionLevel('operacional.entrarWaitlist')).toBe('confirmacao');
  });

  it('destructive is proibido (escala)', () => {
    expect(classifyActionLevel('operacional.cancelarConsulta')).toBe('proibido');
    expect(classifyActionLevel('operacional.remarcarConsulta')).toBe('proibido');
  });

  it('sensitive data read needs strong verification', () => {
    expect(classifyActionLevel('operacional.obterPaciente')).toBe('verificacao_forte');
    expect(classifyActionLevel('operacional.atualizarPaciente')).toBe('verificacao_forte');
  });

  it('unknown action defaults to proibido (deny-by-default)', () => {
    expect(classifyActionLevel('algum.acaoDesconhecida')).toBe('proibido');
  });
});

describe('assertSystemAllowed', () => {
  it('allows livre without confirmation flag', () => {
    expect(
      assertSystemAllowed('operacional.consultarDisponibilidade', { confirmed: false }).allowed,
    ).toBe(true);
  });

  it('blocks confirmacao without confirmed flag', () => {
    const r = assertSystemAllowed('operacional.agendarConsulta', { confirmed: false });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('needs_confirmation');
  });

  it('allows confirmacao with confirmed flag', () => {
    expect(
      assertSystemAllowed('operacional.agendarConsulta', { confirmed: true }).allowed,
    ).toBe(true);
  });

  it('always blocks proibido (escala humano)', () => {
    const r = assertSystemAllowed('operacional.cancelarConsulta', { confirmed: true });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('escalate_human');
  });

  it('blocks verificacao_forte unless verified', () => {
    expect(
      assertSystemAllowed('operacional.obterPaciente', { confirmed: true }).allowed,
    ).toBe(false);
    expect(
      assertSystemAllowed('operacional.obterPaciente', {
        confirmed: true,
        identityVerified: true,
      }).allowed,
    ).toBe(true);
  });
});
