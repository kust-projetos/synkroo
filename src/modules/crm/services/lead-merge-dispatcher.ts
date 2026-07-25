/**
 * lead-merge-dispatcher.ts — Owner bridge para merge de leads.
 *
 * Importa diretamente a função `mergeLeads` do repositório do owner
 * (comercial) e a registra no registry CRM (owner-merge-registry) com a
 * chave 'lead'. A action humana `crm.executarMergeLead` invoca o
 * dispatcher via `getOwnerMergeDispatcher('lead')` em runtime.
 *
 * Side-effect apenas: nenhum export de action, nenhum registro em
 * `defineAction` ou `registerActions`. Este arquivo não cria symbols
 * expostos pelo action registry global.
 *
 * Carregado via import side-effect de `@/modules/comercial/index.ts`
 * (atrás de `import '@/modules/crm/services/lead-merge-dispatcher';`).
 */
import { mergeLeads } from '@/modules/comercial/repositories';
import { registerOwnerMerge } from '@/modules/crm';

export type LeadMergeDispatcher = typeof mergeLeads;

registerOwnerMerge('lead', mergeLeads);