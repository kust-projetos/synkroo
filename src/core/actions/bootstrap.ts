// Lazy imports: evita que o instrumentation.ts em edge runtime puxe pg (Node nativo).
// Apenas ./registry (leve, sem dependência de DB) fica no top-level.
import { registerActions, getAction, clearRegistryForTests } from './registry';

let bootstrapPromise: Promise<void> | null = null;

// Exported so tests can reset state between test files
export function resetBootstrapForTests(): void {
  bootstrapPromise = null;
  clearRegistryForTests();
  // also clear permission catalog
  import('@/core/rbac/catalog').then((m) => m.clearPermissionsForTests?.());
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
      { registerAccessPermissions },
      { coreActions, coreAccessPermissions },
      { operacionalActions, operacionalAccessPermissions },
      { atendimentoActions, atendimentoAccessPermissions },
      { followupActions, followupAccessPermissions },
      { iaActions, iaAccessPermissions },
      { comercialActions, comercialAccessPermissions },
      { crmActions, crmAccessPermissions },
      { financeiroActions, financeiroAccessPermissions },
    ] = await Promise.all([
      import('@/core/rbac/catalog'),
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
    const allActions: any[] = [
      ...coreActions,
      ...operacionalActions,
      ...atendimentoActions,
      ...followupActions,
      ...iaActions,
      ...comercialActions,
      ...crmActions,
      ...financeiroActions,
    ];
    // Validação: nomes únicos, sem undefined, e mapa versionado
    const seen = new Set<string>();
    for (const a of allActions) {
      if (!a?.name) throw new Error(`bootstrap: action sem nome em módulo ${(a as any)?.module}`);
      if (seen.has(a.name)) throw new Error(`duplicate action name: ${a.name}`);
      seen.add(a.name);
    }
    // iaActions = [] é a única contribuição vazia aprovada; demais módulos com actions/ devem contribuir >=1
    // Essa validação é feita no teste bootstrap, não aqui para evitar lock em dev.

    try {
      // Commit atômico: registra tudo de uma vez; se falhar, limpar estado parcial
      // Só registra os ainda ausentes (idempotente em dev/HMR) mas trata iaActions uniformemente
      registerActions(coreActions.filter((a) => !getAction(a.name)));
      registerActions(operacionalActions.filter((a) => !getAction(a.name)));
      registerActions(atendimentoActions.filter((a) => !getAction(a.name)));
      registerActions(followupActions.filter((a) => !getAction(a.name)));
      // iaActions é [] — registro uniforme, sem exceção
      registerActions((iaActions as any[]).filter((a) => !getAction(a.name)));
      registerActions(comercialActions.filter((a) => !getAction(a.name)));
      registerActions(crmActions.filter((a) => !getAction(a.name)));
      registerActions(financeiroActions.filter((a) => !getAction(a.name)));
      registerAccessPermissions(coreAccessPermissions);
      registerAccessPermissions(operacionalAccessPermissions);
      registerAccessPermissions(atendimentoAccessPermissions);
      registerAccessPermissions(followupAccessPermissions);
      registerAccessPermissions(iaAccessPermissions);
      registerAccessPermissions(comercialAccessPermissions);
      registerAccessPermissions(crmAccessPermissions);
      registerAccessPermissions(financeiroAccessPermissions);
      // W5.5: composition root registra adapters owner-merge explicitamente (sem side effect de import)
      const { registerOwnerMerge } = await import('@/modules/crm/services/owner-merge-registry');
      const { mergePatients } = await import('@/modules/operacional/repositories/patients-repository');
      const { mergeLeads } = await import('@/modules/comercial/repositories/leads-repository');
      // limpar antes de registrar (idempotente para HMR)
      const { clearOwnerMergeRegistryForTests } = await import('@/modules/crm/services/owner-merge-registry');
      try { clearOwnerMergeRegistryForTests(); } catch {}
      registerOwnerMerge('patient', (w, l, c) => mergePatients(w, l, c));
      registerOwnerMerge('lead', (w, l, c) => mergeLeads(w, l, c));
    } catch (err) {
      // Rollback: limpar registries e promise para permitir retry explícito sem estado parcial
      try { clearRegistryForTests(); } catch {}
      try {
        const cat = await import('@/core/rbac/catalog');
        (cat as any).clearPermissionsForTests?.();
      } catch {}
      bootstrapPromise = null;
      throw err;
    }
  })();
  // Se a promise rejeitar, limpar memoização para retry não ficar preso em Promise rejeitada
  bootstrapPromise.catch(() => { bootstrapPromise = null; });
  return bootstrapPromise;
}
