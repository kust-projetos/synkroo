/**
 * Financeiro — module public surface.
 *
 * Exports: actions array, manifest, permissions.
 * Bootstrap handles registerActions() via the exported financeiroActions array.
 */

import { listarOrcamentos } from './actions/listar-orcamentos';
import { obterOrcamento } from './actions/obter-orcamento';
import { criarOrcamento } from './actions/criar-orcamento';
import { enviarOrcamento } from './actions/enviar-orcamento';
import { aceitarOrcamento } from './actions/aceitar-orcamento';
import { rejeitarOrcamento } from './actions/rejeitar-orcamento';
import { listarParcelas } from './actions/listar-parcelas';
import { salvarParcelas } from './actions/salvar-parcelas';
import { listarPagamentos } from './actions/listar-pagamentos';
import { registrarPagamento } from './actions/registrar-pagamento';
import { gerarCobranca } from './actions/gerar-cobranca';
import { obterCobranca } from './actions/obter-cobranca';
import { cancelarCobranca } from './actions/cancelar-cobranca';
import { listarCobrancasAtrasadas } from './actions/listar-cobrancas-atrasadas';
import { enviarLembreteCobranca } from './actions/enviar-lembrete-cobranca';
import { obterDashboard } from './actions/obter-dashboard';
import { listarGateways } from './actions/listar-gateways';
import { listarRegrasRoteamento } from './actions/listar-regras-roteamento';
import { salvarGateway } from './actions/salvar-gateway';
import { salvarRegraRoteamento } from './actions/salvar-regra-roteamento';
import { atualizarOrcamento } from './actions/atualizar-orcamento';
import { arquivarOrcamento } from './actions/arquivar-orcamento';
import { atualizarParcela } from './actions/atualizar-parcela';
import { deletarParcela } from './actions/deletar-parcela';

export const financeiroActions = [
  listarOrcamentos,
  obterOrcamento,
  criarOrcamento,
  enviarOrcamento,
  aceitarOrcamento,
  rejeitarOrcamento,
  listarParcelas,
  salvarParcelas,
  listarPagamentos,
  registrarPagamento,
  gerarCobranca,
  obterCobranca,
  cancelarCobranca,
  listarCobrancasAtrasadas,
  enviarLembreteCobranca,
  obterDashboard,
  listarGateways,
  listarRegrasRoteamento,
  salvarGateway,
  salvarRegraRoteamento,
  atualizarOrcamento,
  arquivarOrcamento,
  atualizarParcela,
  deletarParcela,
];

// ─── Seams públicos para services legados (R3) ───────────────────────────────
// Re-exports nomeados do mesmo binding — sem mudança de comportamento.
export { obterOrcamento } from './actions/obter-orcamento';
export { atualizarOrcamento } from './actions/atualizar-orcamento';
export { arquivarOrcamento } from './actions/arquivar-orcamento';
// Seam de precisão monetária (SYNK-IMPL-FLOATS): helpers canônicos de centavos
// para os services legados em src/services/{reports,installments,payments,budgets}.
// Importar via '@/modules/financeiro' — nunca via caminho profundo (gate R4).
export {
  toCents,
  centsToDecimal,
  percentOfCents,
  quantizePriceToCents,
  lineTotalCents,
  splitCentsExact,
} from './services/money';
export { getBudget, markBudgetSent } from './services/budget-service';
export {
  listOverdueCharges,
  enrichOverdueCharges,
  getCollectionStage,
  sendReminder,
} from './services/collection-service';

// ─── Manifest & Permissions ────────────────────────────────────────────────────
export { financeiroManifest } from './manifest';
export { financeiroAccessPermissions } from './permissions';
