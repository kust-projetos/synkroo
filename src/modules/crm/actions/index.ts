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
