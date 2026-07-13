import { listarSugestoesDuplicidade } from './listar-sugestoes-duplicidade';
import { obterSugestaoDuplicidade } from './obter-sugestao-duplicidade';
import { aprovarSugestaoDuplicidade } from './aprovar-sugestao-duplicidade';
import { dispensarSugestaoDuplicidade } from './dispensar-sugestao-duplicidade';
import { executarMergePatient } from './executar-merge-patient';
import { executarMergeLead } from './executar-merge-lead';

export const crmDuplicateReviewActions = [
  listarSugestoesDuplicidade,
  obterSugestaoDuplicidade,
  aprovarSugestaoDuplicidade,
  dispensarSugestaoDuplicidade,
  executarMergePatient,
  executarMergeLead,
];

export {
  listarSugestoesDuplicidade,
  obterSugestaoDuplicidade,
  aprovarSugestaoDuplicidade,
  dispensarSugestaoDuplicidade,
  executarMergePatient,
  executarMergeLead,
};
