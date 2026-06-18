import { registerActions, getAction } from './registry';
import { registerAccessPermissions } from '@/core/rbac/catalog';
import { coreActions, coreAccessPermissions } from '@/modules/core';
// + futuros módulos do Eixo 2: import { operacionalActions } from '@/modules/operacional' ...

const ALL_ACTIONS = [...coreActions /*, ...operacionalActions */];
const ALL_ACCESS_PERMS = [...coreAccessPermissions];

let done = false;
export function bootstrapActions(): void {
  if (done) return;
  // só registra os ainda ausentes (idempotente em dev/HMR)
  registerActions(ALL_ACTIONS.filter((a) => !getAction(a.name)));
  registerAccessPermissions(ALL_ACCESS_PERMS);
  done = true;
}
