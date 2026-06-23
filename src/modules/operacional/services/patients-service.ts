/**
 * Operacional module — patients service.
 *
 * Thin orchestration between actions and repository.
 * Handles dedup logic (phone + CPF uniqueness per clinic).
 */

import { ActionError } from '@/core/actions/types';
import * as repo from '../repositories/patients-repository';

export async function criarPaciente(input: {
  clinicId: string;
  name: string;
  phone: string;
  cpf?: string;
  email?: string;
  birthDate?: string;
  gender?: string;
  notes?: string;
}) {
  const phone = repo.normalizePhone(input.phone);
  const cpf = input.cpf ? repo.normalizeCpf(input.cpf) : undefined;

  if (await repo.findByPhone(input.clinicId, phone)) {
    throw new ActionError('conflict', 'Já existe um paciente com este telefone.');
  }
  if (cpf && (await repo.findByCpf(input.clinicId, cpf))) {
    throw new ActionError('conflict', 'Já existe um paciente com este CPF.');
  }

  return repo.insertPatient({
    clinicId: input.clinicId,
    name: input.name,
    phone,
    cpf: cpf ?? null,
    email: input.email ?? null,
    birthDate: input.birthDate ?? null,
    gender: input.gender ?? null,
    notes: input.notes ?? null,
  });
}

export async function atualizarPaciente(input: {
  clinicId: string;
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
}) {
  const existing = await repo.findById(input.clinicId, input.id);
  if (!existing) throw new ActionError('not_found', 'Paciente não encontrado.');

  const patch: Parameters<typeof repo.updatePatient>[2] = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.phone !== undefined) patch.phone = repo.normalizePhone(input.phone);
  if (input.email !== undefined) patch.email = input.email || null;
  if (input.notes !== undefined) patch.notes = input.notes || null;

  const updated = await repo.updatePatient(input.clinicId, input.id, patch);
  if (!updated) throw new ActionError('not_found', 'Paciente não encontrado.');
  return { id: updated.id };
}

export async function listarPacientes(
  clinicId: string,
  input?: { search?: string; limit?: number; offset?: number },
) {
  const rows = await repo.listPatients(clinicId, input);
  return { patients: rows, total: rows.length };
}

export async function obterPaciente(clinicId: string, id: string) {
  const patient = await repo.findById(clinicId, id);
  if (!patient) throw new ActionError('not_found', 'Paciente não encontrado.');
  return patient;
}
