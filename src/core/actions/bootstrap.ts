// Lazy imports: evita que o instrumentation.ts em edge runtime puxe pg (Node nativo).
// Apenas ./registry (leve, sem dependência de DB) fica no top-level.
import { replaceRegistry, clearRegistryForTests } from './registry';
import { resetPermissionCatalog, registerAccessPermissions } from '@/core/rbac/catalog';
import { clearOwnerMergeRegistryForTests, replaceOwnerMergeAdapters } from '@/modules/crm/services/owner-merge-registry';
import { clearLGPDContributionsForTests, replaceLGPDContributions } from '@/modules/operacional/services/lgpd-registry';

let bootstrapPromise: Promise<void> | null = null;

// Exported so tests can reset state between test files
export function resetBootstrapForTests(): void {
  bootstrapPromise = null;
  clearRegistryForTests();
  resetPermissionCatalog();
  clearOwnerMergeRegistryForTests();
  clearLGPDContributionsForTests();
}

/**
 * Bootstrap central — registra todas as Actions e Permissões de Acesso.
 * Determinístico: Promise memoizada, validação antes de commit, rollback em falha,
 * arrays tratados uniformemente (iaActions = [] é única contribuição vazia aprovada).
 */
export async function bootstrapActions(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const [
      { coreActions, coreAccessPermissions },
      { operacionalActions, operacionalAccessPermissions },
      { atendimentoActions, atendimentoAccessPermissions },
      { followupActions, followupAccessPermissions },
      { iaActions, iaAccessPermissions },
      { comercialActions, comercialAccessPermissions },
      { crmActions, crmAccessPermissions },
      { financeiroActions, financeiroAccessPermissions },
    ] = await Promise.all([
      import('@/modules/core'),
      import('@/modules/operacional'),
      import('@/modules/atendimento'),
      import('@/modules/followup'),
      import('@/modules/ia'),
      import('@/modules/comercial'),
      import('@/modules/crm'),
      import('@/modules/financeiro'),
    ]);

    // Preparar e validar catálogo completo antes de publicar estado global
    const allActions = [
      ...coreActions,
      ...operacionalActions,
      ...atendimentoActions,
      ...followupActions,
      ...iaActions,
      ...comercialActions,
      ...crmActions,
      ...financeiroActions,
    ];
    // Validação: nomes únicos, sem undefined, antes de publicar qualquer estado.
    const seen = new Set<string>();
    for (const a of allActions) {
      if (!a?.name) throw new Error(`bootstrap: action sem nome em módulo ${(a as any)?.module}`);
      if (seen.has(a.name)) throw new Error(`duplicate action name: ${a.name}`);
      seen.add(a.name);
    }
    const allPermissions = [
      ...coreAccessPermissions,
      ...operacionalAccessPermissions,
      ...atendimentoAccessPermissions,
      ...followupAccessPermissions,
      ...iaAccessPermissions,
      ...comercialAccessPermissions,
      ...crmAccessPermissions,
      ...financeiroAccessPermissions,
    ];
    const permissionKeys = new Set<string>();
    for (const permission of allPermissions) {
      if (!permission?.key) throw new Error('bootstrap: permissão sem chave');
      if (permissionKeys.has(permission.key)) {
        throw new Error(`duplicate permission key: ${permission.key}`);
      }
      permissionKeys.add(permission.key);
    }

    try {
      // Commit atômico: todas as estruturas são preparadas antes da publicação.
      replaceRegistry(allActions);
      resetPermissionCatalog();
      registerAccessPermissions(allPermissions);

      const [{ mergePatients }, { mergeLeads }] = await Promise.all([
        import('@/modules/operacional/public'),
        import('@/modules/comercial/public'),
      ]);
      replaceOwnerMergeAdapters([
        {
          ownerType: 'patient',
          dispatcher: (winnerId, loserId, clinicId) => mergePatients({ clinicId, winnerId, loserId }),
        },
        {
          ownerType: 'lead',
          dispatcher: (winnerId, loserId, clinicId) => mergeLeads({ clinicId, winnerId, loserId }),
        },
      ]);

      // LGPD contributions — tenant-safe, owner-controlled, mounted at composition root
      const [
        { exportFinanceiroForPatient, anonymizeFinanceiroForPatient },
        { exportComercialForPatient, anonymizeComercialForPatient },
        { exportFollowupForPatient, anonymizeFollowupForPatient },
        { exportCrmForPatient, anonymizeCrmForPatient },
        { exportIaForPatient, anonymizeIaForPatient },
        { exportAtendimentoForPatient, anonymizeAtendimentoForPatient },
      ] = await Promise.all([
        import('@/modules/financeiro/services/lgpd-financeiro'),
        import('@/modules/comercial/services/lgpd-comercial'),
        import('@/modules/followup/services/lgpd-followup'),
        import('@/modules/crm/services/lgpd-crm'),
        import('@/modules/ia/services/lgpd-ia'),
        import('@/modules/atendimento/services/lgpd-atendimento'),
      ]);
      replaceLGPDContributions([
        { moduleId: 'financeiro', exportData: exportFinanceiroForPatient, anonymizeData: anonymizeFinanceiroForPatient },
        { moduleId: 'comercial', exportData: exportComercialForPatient, anonymizeData: anonymizeComercialForPatient },
        { moduleId: 'followup', exportData: exportFollowupForPatient, anonymizeData: anonymizeFollowupForPatient },
        { moduleId: 'crm', exportData: exportCrmForPatient, anonymizeData: anonymizeCrmForPatient },
        { moduleId: 'ia', exportData: exportIaForPatient, anonymizeData: anonymizeIaForPatient },
        { moduleId: 'atendimento', exportData: exportAtendimentoForPatient, anonymizeData: anonymizeAtendimentoForPatient },
      ]);
    } catch (err) {
      // Rollback: limpar registries e promise para permitir retry explícito sem estado parcial
      try { clearRegistryForTests(); } catch {}
      try { resetPermissionCatalog(); } catch {}
      try { clearOwnerMergeRegistryForTests(); } catch {}
      try { clearLGPDContributionsForTests(); } catch {}
      bootstrapPromise = null;
      throw err;
    }
  })();
  // Se a promise rejeitar, limpar memoização para retry não ficar preso em Promise rejeitada
  bootstrapPromise.catch(() => { bootstrapPromise = null; });
  return bootstrapPromise;
}
