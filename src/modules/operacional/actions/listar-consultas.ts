import { z } from 'zod';
import { defineAction } from '@/core/actions/registry';
import { ActionContext } from '@/core/actions/types';
import { findByClinicWithJoins } from '../repositories/appointments-repository';

const ListarConsultasInput = z.object({
  patientId: z.string().uuid().optional(),
  dentistId: z.string().uuid().optional(),
  status: z.string().optional(),
  date: z.string().optional(), // YYYY-MM-DD
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dentistIds: z.array(z.string().uuid()).optional(),
  limit: z.coerce.number().int().min(1).max(999).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListarConsultasOutput = {
  appointments: any[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export const listarConsultas = defineAction({
  name: 'operacional:listar_consultas',
  module: 'operacional',
  requires: 'appointments:read',
  label: 'Listar consultas',
  description: 'Lista agendamentos com filtros e paginação.',
  input: ListarConsultasInput,
  async handler(input: z.infer<typeof ListarConsultasInput>, ctx: ActionContext) {
    const { limit, offset, ...filters } = input;
    const page = Math.floor(offset / limit) + 1;

    const rows = await findByClinicWithJoins(ctx.clinicId, {
      ...filters,
      limit,
      offset,
    });

    const total = await findByClinicWithJoins(ctx.clinicId, {
      ...filters,
      count: true,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      appointments: rows,
      pagination: { page, limit, total, totalPages },
    };
  },
});
