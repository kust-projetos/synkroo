/**
 * Comercial module — tasks service.
 *
 * Thin orchestration layer for lead-scoped task lifecycle.
 */

import * as tasksRepo from '../repositories/tasks-repository';
import * as leadsRepo from '../repositories/leads-repository';

export interface CreateTaskInput {
  clinicId: string;
  leadId?: string | null;
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  priority?: string;
  assignedTo?: string | null;
}

export async function criarTask(input: CreateTaskInput) {
  return tasksRepo.createTask(input);
}

export async function listarTasks(
  clinicId: string,
  opts?: { leadId?: string; status?: string },
) {
  return tasksRepo.listTasks(clinicId, opts);
}

export async function atualizarTask(
  clinicId: string,
  taskId: string,
  patch: Parameters<typeof tasksRepo.updateTask>[2],
) {
  const existing = await tasksRepo.findTaskById(clinicId, taskId);
  if (!existing) throw new Error('Task not found');
  return tasksRepo.updateTask(clinicId, taskId, patch);
}

export async function fecharTask(clinicId: string, taskId: string) {
  const existing = await tasksRepo.findTaskById(clinicId, taskId);
  if (!existing) throw new Error('Task not found');
  return tasksRepo.closeTask(clinicId, taskId);
}
