import { listarContatos } from './listar-contatos';
import { obterContato } from './obter-contato';
import { listarTimelineContato } from './listar-timeline-contato';
import { listarNotasContato } from './listar-notas-contato';
import { adicionarNotaContato } from './adicionar-nota-contato';
import { atualizarTagsContato } from './atualizar-tags-contato';
import { listarSugestoesDuplicidade } from './listar-sugestoes-duplicidade';
import { obterSugestaoDuplicidade } from './obter-sugestao-duplicidade';
import { aprovarSugestaoDuplicidade } from './aprovar-sugestao-duplicidade';
import { dispensarSugestaoDuplicidade } from './dispensar-sugestao-duplicidade';
import { executarMergePatient } from './executar-merge-patient';
import { executarMergeLead } from './executar-merge-lead';
import { reprocessarSugestoesDuplicidade } from './reprocessar-sugestoes-duplicidade';

// ─── Public actions array (Task 4 — CRM Integration Closure) ────────────────
// 12 ações públicas humanas:
//   - 6 contact read/mutate: listarContatos, obterContato,
//     listarTimelineContato, listarNotasContato, adicionarNotaContato,
//     atualizarTagsContato.
//   - 4 human duplicate review: listarSugestoesDuplicidade,
//     obterSugestaoDuplicidade, aprovarSugestaoDuplicidade,
//     dispensarSugestaoDuplicidade.
//   - 2 human merge executors: executarMergePatient, executarMergeLead.
//
// NÃO inclui:
//   - reprocessarSugestoesDuplicidade (system-only, requer cron secret).
export const crmActions = [
  // Contatos
  listarContatos,
  obterContato,
  listarTimelineContato,
  listarNotasContato,
  adicionarNotaContato,
  atualizarTagsContato,
  // Duplicate review (human)
  listarSugestoesDuplicidade,
  obterSugestaoDuplicidade,
  aprovarSugestaoDuplicidade,
  dispensarSugestaoDuplicidade,
  // Merge executors (human)
  executarMergePatient,
  executarMergeLead,
];

export const crmContactReadActions = [
  listarContatos,
  obterContato,
  listarTimelineContato,
  listarNotasContato,
  adicionarNotaContato,
  atualizarTagsContato,
];

export const crmDuplicateReviewActions = [
  listarSugestoesDuplicidade,
  obterSugestaoDuplicidade,
  aprovarSugestaoDuplicidade,
  dispensarSugestaoDuplicidade,
  executarMergePatient,
  executarMergeLead,
  reprocessarSugestoesDuplicidade,
];

export {
  listarContatos,
  obterContato,
  listarTimelineContato,
  listarNotasContato,
  adicionarNotaContato,
  atualizarTagsContato,
  listarSugestoesDuplicidade,
  obterSugestaoDuplicidade,
  aprovarSugestaoDuplicidade,
  dispensarSugestaoDuplicidade,
  executarMergePatient,
  executarMergeLead,
  reprocessarSugestoesDuplicidade,
};
