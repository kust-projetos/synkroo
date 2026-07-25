// Allowlist explícita para tools expostas à IA via agent-bridge.
// Deny-by-default: o que não está em AGENT_SAFE_ACTIONS é filtrado.
//
// Cobrindo o contrato mínimo do plano Eixo 2 — Security & Integrity Hardening:
// - operacional.consultarDisponibilidade é safe
// - TODOS crm.*, financeiro.*, operacional.mesclarPacientes, comercial.mesclarLeads NÃO são safe
//
// Estes testes falham enquanto `tool-policy.ts` não existir (RED inicial).
import { AGENT_SAFE_ACTIONS, isAgentSafeAction } from '../tool-policy';

describe('AGENT_SAFE_ACTIONS — literal da allowlist', () => {
  it('contém exatamente as 8 ações operacionais permitidas para a IA', () => {
    expect([...AGENT_SAFE_ACTIONS].sort()).toEqual(
      [
        'operacional.agendarConsulta',
        'operacional.atualizarPaciente',
        'operacional.confirmarConsulta',
        'operacional.consultarDisponibilidade',
        'operacional.entrarWaitlist',
        'operacional.listarProcedimentos',
        'operacional.obterPaciente',
        'operacional.obterProcedimento',
      ].sort(),
    );
  });

  it('é readonly-ish: o Set existe e tem tamanho finito', () => {
    expect(AGENT_SAFE_ACTIONS).toBeInstanceOf(Set);
    expect(AGENT_SAFE_ACTIONS.size).toBeGreaterThan(0);
    expect(AGENT_SAFE_ACTIONS.size).toBeLessThan(50);
  });
});

describe('isAgentSafeAction', () => {
  it('aceita operacional.consultarDisponibilidade', () => {
    expect(isAgentSafeAction('operacional.consultarDisponibilidade')).toBe(true);
  });

  it('aceita cada ação explicitamente listada', () => {
    const expected = [
      'operacional.consultarDisponibilidade',
      'operacional.listarProcedimentos',
      'operacional.obterProcedimento',
      'operacional.agendarConsulta',
      'operacional.confirmarConsulta',
      'operacional.entrarWaitlist',
      'operacional.obterPaciente',
      'operacional.atualizarPaciente',
    ];
    for (const name of expected) {
      expect(isAgentSafeAction(name)).toBe(true);
    }
  });

  it('rejeita ações internas/sensíveis do CRM', () => {
    const crmActions = [
      'crm.aprovarSugestaoDuplicidade',
      'crm.dispensarSugestaoDuplicidade',
      'crm.executarMergeLead',
      'crm.executarMergePatient',
      'crm.listarSugestoesDuplicidade',
      'crm.obterSugestaoDuplicidade',
      'crm.reprocessarSugestoesDuplicidades',
    ];
    for (const name of crmActions) {
      expect(isAgentSafeAction(name)).toBe(false);
    }
  });

  it('rejeita ações internas/sensíveis do Financeiro', () => {
    const finActions = [
      'financeiro.aceitarOrcamento',
      'financeiro.cancelarCobranca',
      'financeiro.criarOrcamento',
      'financeiro.enviarLembreteCobranca',
      'financeiro.enviarOrcamento',
      'financeiro.gerarCobranca',
      'financeiro.listarCobrancasAtrasadas',
      'financeiro.listarGateways',
      'financeiro.listarOrcamentos',
      'financeiro.listarPagamentos',
      'financeiro.listarParcelas',
    ];
    for (const name of finActions) {
      expect(isAgentSafeAction(name)).toBe(false);
    }
  });

  it('rejeita mesclar pacientes (mesmo módulo operacional)', () => {
    expect(isAgentSafeAction('operacional.mesclarPacientes')).toBe(false);
  });

  it('rejeita mesclar leads (mesmo módulo comercial)', () => {
    expect(isAgentSafeAction('comercial.mesclarLeads')).toBe(false);
  });

  it('rejeita ações destrutivas fora da allowlist (cancelarConsulta)', () => {
    expect(isAgentSafeAction('operacional.cancelarConsulta')).toBe(false);
  });

  it('rejeita string vazia / desconhecida (deny-by-default)', () => {
    expect(isAgentSafeAction('')).toBe(false);
    expect(isAgentSafeAction('xyz.abc')).toBe(false);
    expect(isAgentSafeAction('Operacional.consultarDisponibilidade')).toBe(false); // case-sensitive
  });
});