import * as modulesRepo from '../repositories/modules-repository';

export async function setModuleContract(input: { moduleId: string; enabled: boolean }) {
  await modulesRepo.setModuleContract(input);
  return { ok: true };
}
