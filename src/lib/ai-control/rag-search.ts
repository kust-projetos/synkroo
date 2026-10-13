/**
 * AI Control — adaptador RAG default (camada `lib`).
 *
 * O gate `boundaries` proíbe `src/modules/**` de importar `src/services/**`
 * diretamente; o default RAG do prepare 1B (`ragService.searchKnowledge`,
 * sempre tenant-scoped) mora aqui, em `lib` (default-allow), e o consumidor
 * `modules/ia` o importa como `lib`. Testes injetam `searchFn` e nunca tocam
 * este adaptador — nenhuma query real sai em unit.
 */
import { ragService } from '@/services/rag/rag.service';

export function defaultAiControlSearch(clinicId: string, query: string): Promise<unknown> {
  return ragService.searchKnowledge(clinicId, query) as Promise<unknown>;
}
