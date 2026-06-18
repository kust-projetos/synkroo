// Lazy imports: evita que o instrumentation.ts em edge runtime puxe pg (Node nativo).
// Apenas ./registry (leve, sem dependência de DB) fica no top-level.
import { registerActions, getAction } from './registry';

let done = false;

/**
 * Bootstrap central — registra todas as Actions e Permissões de Acesso.
 * Idempotente (flag `done` interno). Dynamic imports evitam carregar
 * `@/modules/core` → `@/lib/db/client` → `pg` no top-level (edge runtime).
 */
export async function bootstrapActions(): Promise<void> {
  if (done) return;

  const [{ registerAccessPermissions }, { coreActions, coreAccessPermissions }] = await Promise.all([
    import('@/core/rbac/catalog'),
    import('@/modules/core'),
  ]);

  // Só registra os ainda ausentes (idempotente em dev/HMR)
  registerActions(coreActions.filter((a) => !getAction(a.name)));
  registerAccessPermissions(coreAccessPermissions);
  done = true;
}
