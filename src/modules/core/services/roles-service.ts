import * as rolesRepo from '../repositories/roles-repository';

export async function createRole(input: {
  clinicId: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}) {
  return rolesRepo.createClinicRole(input);
}

export async function listClinicRoles(clinicId: string) {
  return rolesRepo.listClinicRoles(clinicId);
}
