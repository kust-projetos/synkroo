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
];

// ─── Manifest & Permissions ────────────────────────────────────────────────────
export { financeiroManifest } from './manifest';
export { financeiroAccessPermissions } from './permissions';
