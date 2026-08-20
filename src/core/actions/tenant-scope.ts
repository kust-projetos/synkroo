import { ActionError, type ActionContext } from './types';

/** Reject payload-controlled tenant scope before a mutating service is reached. */
export function assertClinicScope(
  inputClinicId: string,
  ctx: Pick<ActionContext, 'clinicId'>,
): void {
  if (inputClinicId !== ctx.clinicId) {
    throw new ActionError('forbidden', 'A clínica informada não corresponde ao contexto ativo.');
  }
}
