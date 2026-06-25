// Lazy imports: evita que o instrumentation.ts em edge runtime puxe pg (Node nativo).
// Apenas ./registry (leve, sem dependência de DB) fica no top-level.
import { registerActions, getAction } from './registry';

let done = false;

// Exported so tests can reset state between test files
export function resetBootstrapForTests(): void {
  // biome-ignore lint/style/noParameterAssign: test-only reset
  done = false;
}

/**
 * Bootstrap central — registra todas as Actions e Permissões de Acesso.
 * Idempotente (flag `done` interno). Dynamic imports evitam carregar
 * `@/modules/core` → `@/lib/db/client` → `pg` no top-level (edge runtime).
 */
export async function bootstrapActions(): Promise<void> {
  if (done) return;

  const [
    { registerAccessPermissions },
    { coreActions, coreAccessPermissions },
    { operacionalActions, operacionalAccessPermissions },
    { atendimentoActions, atendimentoAccessPermissions },
    { followupActions, followupAccessPermissions },
    { iaActions, iaAccessPermissions },
  ] = await Promise.all([
    import('@/core/rbac/catalog'),
    import('@/modules/core'),
    import('@/modules/operacional'),
    import('@/modules/atendimento'),
    import('@/modules/followup'),
    import('@/modules/ia'),
  ]);

  // Só registra os ainda ausentes (idempotente em dev/HMR)
  registerActions(coreActions.filter((a) => !getAction(a.name)));
  registerActions(operacionalActions.filter((a) => !getAction(a.name)));
  registerActions(atendimentoActions.filter((a) => !getAction(a.name)));
  registerActions(followupActions.filter((a) => !getAction(a.name)));
  registerActions(iaActions);
  registerAccessPermissions(coreAccessPermissions);
  registerAccessPermissions(operacionalAccessPermissions);
  registerAccessPermissions(atendimentoAccessPermissions);
  registerAccessPermissions(followupAccessPermissions);
  registerAccessPermissions(iaAccessPermissions);
  done = true;
}
