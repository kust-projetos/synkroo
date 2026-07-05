/**
 * Financeiro — action exports.
 * Actions are self-registering via the action registry.
 */

import { registerActions } from '@/core/actions/registry';

import { listarOrcamentos } from './listar-orcamentos';
import { obterOrcamento } from './obter-orcamento';
import { criarOrcamento } from './criar-orcamento';
import { enviarOrcamento } from './enviar-orcamento';
import { aceitarOrcamento } from './aceitar-orcamento';
import { rejeitarOrcamento } from './rejeitar-orcamento';
import { listarParcelas } from './listar-parcelas';
import { salvarParcelas } from './salvar-parcelas';
import { listarPagamentos } from './listar-pagamentos';
import { registrarPagamento } from './registrar-pagamento';
import { gerarCobranca } from './gerar-cobranca';
import { obterCobranca } from './obter-cobranca';
import { cancelarCobranca } from './cancelar-cobranca';
import { listarCobrancasAtrasadas } from './listar-cobrancas-atrasadas';
import { enviarLembreteCobranca } from './enviar-lembrete-cobranca';
import { obterDashboard } from './obter-dashboard';
import { salvarGateway } from './salvar-gateway';
import { salvarRegraRoteamento } from './salvar-regra-roteamento';

export * from './criar-orcamento';
export * from './listar-orcamentos';
export * from './obter-orcamento';
export * from './enviar-orcamento';
export * from './aceitar-orcamento';
export * from './rejeitar-orcamento';
export * from './listar-parcelas';
export * from './salvar-parcelas';
export * from './listar-pagamentos';
export * from './registrar-pagamento';
export * from './gerar-cobranca';
export * from './obter-cobranca';
export * from './cancelar-cobranca';
export * from './listar-cobrancas-atrasadas';
export * from './enviar-lembrete-cobranca';
export * from './obter-dashboard';
export * from './salvar-gateway';
export * from './salvar-regra-roteamento';

// Bootstrap registration — idempotent
registerActions([
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
  salvarGateway,
  salvarRegraRoteamento,
]);
