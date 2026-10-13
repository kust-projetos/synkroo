/**
 * S4-FIN-AUDIT — CONFIRM/APPROVAL financeiro: toda action money-mutating ou
 * de aprovação tem auditFields allowlist mínima, sem PII/texto livre.
 * Não muda lógica, gates ou riskClass — só presença/conteúdo do allowlist.
 */

import { aceitarOrcamento } from '../aceitar-orcamento';
import { rejeitarOrcamento } from '../rejeitar-orcamento';
import { arquivarOrcamento } from '../arquivar-orcamento';
import { gerarCobranca } from '../gerar-cobranca';
import { cancelarCobranca } from '../cancelar-cobranca';
import { salvarParcelas } from '../salvar-parcelas';
import { atualizarParcela } from '../atualizar-parcela';
import { deletarParcela } from '../deletar-parcela';
import { registrarPagamento } from '../registrar-pagamento';
import { atualizarOrcamento } from '../atualizar-orcamento';

const ACTIONS = {
  'financeiro.aceitarOrcamento': aceitarOrcamento,
  'financeiro.rejeitarOrcamento': rejeitarOrcamento,
  'financeiro.arquivarOrcamento': arquivarOrcamento,
  'financeiro.gerarCobranca': gerarCobranca,
  'financeiro.cancelarCobranca': cancelarCobranca,
  'financeiro.salvarParcelas': salvarParcelas,
  'financeiro.atualizarParcela': atualizarParcela,
  'financeiro.deletarParcela': deletarParcela,
  'financeiro.registrarPagamento': registrarPagamento,
  'financeiro.atualizarOrcamento': atualizarOrcamento,
} as const;

// Campos livres/sensíveis que NUNCA podem aparecer no allowlist.
const FORBIDDEN = new Set([
  'notes', 'note', 'message', 'description', 'title', 'items', 'installments',
  'name', 'email', 'phone', 'cpf', 'token', 'secret', 'password',
]);

describe('S4-FIN-AUDIT — CONFIRM/APPROVAL têm auditFields sem PII', () => {
  for (const [name, action] of Object.entries(ACTIONS)) {
    it(`${name} declara auditFields allowlist mínima sem PII`, () => {
      expect(Array.isArray(action.auditFields)).toBe(true);
      expect(action.auditFields!.length).toBeGreaterThan(0);
      for (const f of action.auditFields!) {
        expect(FORBIDDEN.has(f.toLowerCase())).toBe(false);
      }
    });
  }

  it('aceitar/rejeitar/arquivar/cancelar auditam só ids', () => {
    expect([...aceitarOrcamento.auditFields!]).toEqual(['id']);
    expect([...rejeitarOrcamento.auditFields!]).toEqual(['id']);
    expect([...arquivarOrcamento.auditFields!]).toEqual(['id']);
    expect([...cancelarCobranca.auditFields!]).toEqual(['id']);
  });

  it('gerarCobranca audita budgetId/amount/dueDate sem texto livre', () => {
    expect([...gerarCobranca.auditFields!]).toEqual(['budgetId', 'amount', 'dueDate']);
  });

  it('parcelas: salvar audita budgetId; atualizar/deletar incluem installmentId', () => {
    expect([...salvarParcelas.auditFields!]).toEqual(['budgetId']);
    expect((atualizarParcela.auditFields as readonly string[])).toContain('installmentId');
    expect((deletarParcela.auditFields as readonly string[])).toContain('installmentId');
  });
});
