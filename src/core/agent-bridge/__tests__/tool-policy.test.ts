import {
  AGENT_SAFE_ACTIONS,
  isAgentSafeAction,
} from '../tool-policy';

const SAFE_NAMES = [
  'operacional.consultarDisponibilidade',
  'operacional.listarProcedimentos',
  'operacional.obterProcedimento',
  'operacional.agendarConsulta',
  'operacional.confirmarConsulta',
  'operacional.entrarWaitlist',
  'operacional.obterPaciente',
  'operacional.atualizarPaciente',
] as const;

const UNSAFE_NAMES = [
  // CRM — mesmo registrado globalmente, jamais vira ferramenta IA
  'crm.listarContatos',
  'crm.obterContato',
  'crm.listarTimelineContato',
  'crm.listarNotasContato',
  'crm.adicionarNotaContato',
  'crm.atualizarTagsContato',
  'crm.reprocessarSugestoesDuplicidade',
  'crm.aprovarDuplicidade',
  'crm.descartarDuplicidade',
  // Financeiro — proibido como ferramenta IA
  'financeiro.criarOrcamento',
  'financeiro.aceitarOrcamento',
  'financeiro.registrarPagamento',
  'financeiro.recalcularParcelas',
  'financeiro.criarCobranca',
  // Mesclas internas — nunca expor como tool IA
  'operacional.mesclarPacientes',
  'comercial.mesclarLeads',
  // Ações destrutivas/diferenciais que ficam fora da barreira secundária
  'operacional.cancelarConsulta',
  'operacional.remarcarConsulta',
  // Desconhecidas
  'algum.acaoTotalmenteDesconhecida',
] as const;

describe('tool-policy — allowlist literal', () => {
  describe('AGENT_SAFE_ACTIONS', () => {
    it('contém exatamente 8 nomes (literal, sem inferência por módulo/permissão)', () => {
      expect(AGENT_SAFE_ACTIONS.size).toBe(8);
    });

    it('contém todos os 8 nomes do plano operacional', () => {
      for (const name of SAFE_NAMES) {
        expect(AGENT_SAFE_ACTIONS.has(name)).toBe(true);
      }
    });

    it('não contém nenhum prefixo de CRM ou Financeiro', () => {
      const allNames = [...AGENT_SAFE_ACTIONS];
      expect(allNames.some((n) => n.startsWith('crm.'))).toBe(false);
      expect(allNames.some((n) => n.startsWith('financeiro.'))).toBe(false);
    });

    it('não contém mesclas internas de pacientes ou leads', () => {
      expect(AGENT_SAFE_ACTIONS.has('operacional.mesclarPacientes')).toBe(false);
      expect(AGENT_SAFE_ACTIONS.has('comercial.mesclarLeads')).toBe(false);
    });

    it('não expõe nenhuma chave fora do conjunto de 8 nomes do plano', () => {
      // Defesa: se aparecer uma chave "operacional." extra (ex.: cancelarConsulta
      // por migração futura), o size já quebra. Aqui reforçamos a regra do
      // tamanho exato com listing textual.
      const listing = [...AGENT_SAFE_ACTIONS].sort();
      expect(listing).toEqual([...SAFE_NAMES].sort());
    });
  });

  describe('isAgentSafeAction', () => {
    it.each(SAFE_NAMES)('retorna true para %s', (name) => {
      expect(isAgentSafeAction(name)).toBe(true);
    });

    it.each(UNSAFE_NAMES)('retorna false para %s', (name) => {
      expect(isAgentSafeAction(name)).toBe(false);
    });

    it('retorna false para entradas vazias ou não-string', () => {
      expect(isAgentSafeAction('')).toBe(false);
    });

    it('não infere por módulo/permissão — ação operacional mas não listada continua fora', () => {
      // Pertence ao módulo operacional mas não está no allowlist literal.
      expect(isAgentSafeAction('operacional.cancelarConsulta')).toBe(false);
      expect(isAgentSafeAction('operacional.remarcarConsulta')).toBe(false);
    });
  });
});
