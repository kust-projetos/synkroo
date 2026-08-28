/**
 * Catalog service — thin layer between actions and repository.
 */

import * as repo from '../repositories/catalog-repository';

// ─── Dentists ────────────────────────────────────────────────────────────────

export async function criarDentista(input: {
  clinicId: string;
  name: string;
  phone?: string;
  email?: string;
  specialty?: string;
  cro?: string;
}) {
  const dentist = await repo.insertDentist({
    clinicId: input.clinicId,
    name: input.name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    specialty: input.specialty ?? null,
    cro: input.cro ?? null,
    isActive: true,
  });
  return { id: dentist.id };
}

export async function listarDentistas(clinicId: string, opts?: { activeOnly?: boolean }) {
  return repo.listDentists(clinicId, opts);
}

export async function obterDentista(clinicId: string, id: string) {
  const dentist = await repo.findDentistById(clinicId, id);
  return dentist;
}

export async function atualizarDentista(
  clinicId: string,
  id: string,
  data: Partial<{
    name: string;
    phone: string | null;
    email: string | null;
    specialty: string | null;
    cro: string | null;
    isActive: boolean;
  }>,
) {
  const existing = await repo.findDentistById(clinicId, id);
  if (!existing) return null;
  return repo.updateDentist(id, data);
}

// ─── Procedures ─────────────────────────────────────────────────────────────

export async function criarProcedimento(input: {
  clinicId: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  price?: string;
  category?: string;
}) {
  const procedure = await repo.insertProcedure({
    clinicId: input.clinicId,
    name: input.name,
    description: input.description ?? null,
    durationMinutes: input.durationMinutes ?? 30,
    price: input.price,
    category: input.category ?? null,
    isActive: true,
  });
  return { id: procedure.id };
}

export async function listarProcedimentos(clinicId: string, opts?: { activeOnly?: boolean }) {
  return repo.listProcedures(clinicId, opts);
}

export async function obterProcedimento(clinicId: string, id: string) {
  const procedure = await repo.findProcedureById(clinicId, id);
  return procedure;
}

export async function atualizarProcedimento(
  clinicId: string,
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    durationMinutes: number;
    price: string;
    category: string | null;
    isActive: boolean;
  }>,
) {
  const existing = await repo.findProcedureById(clinicId, id);
  if (!existing) return null;
  return repo.updateProcedure(id, data);
}
