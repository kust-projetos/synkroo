/**
 * patient-merge-dispatcher.ts — Owner bridge para merge de pacientes.
 *
 * Importa diretamente a função `mergePatients` do repositório do owner
 * (operacional) e a registra no registry CRM (owner-merge-registry) com a
 * chave 'patient'. A action humana `crm.executarMergePatient` invoca o
 * dispatcher via `getOwnerMergeDispatcher('patient')` em runtime.
 *
 * Side-effect apenas: nenhum export de action, nenhum registro em
 * `defineAction` ou `registerActions`. Este arquivo não cria symbols
 * expostos pelo action registry global.
 *
 * Carregado via import side-effect de `@/modules/operacional/index.ts`
 * (atrás de `import '@/modules/crm/services/patient-merge-dispatcher';`).
 */
import { mergePatients } from '@/modules/operacional/repositories';
import { registerOwnerMerge } from '@/modules/crm';

export type PatientMergeDispatcher = typeof mergePatients;

registerOwnerMerge('patient', mergePatients);