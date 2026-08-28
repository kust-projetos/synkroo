/**
 * contact-tags-service.ts — atualização de tags do contato via owner bridge.
 *
 * type='patient' → operacional.atualizarTagsPaciente.handler
 * type='lead'    → comercial.atualizarTagsLead.handler
 * Sem acesso direto a tabelas owner para mutação.
 */
import type { ActionContext } from '@/core/actions/types';
import type { ContactType } from '../repositories/contact-read-repository';
import { atualizarTagsPaciente as atualizarTagsPacientePublic } from '@/modules/operacional/public';
import { atualizarTagsLead as atualizarTagsLeadPublic } from '@/modules/comercial/public';

export async function updateContactTagsService(
  ctx: Pick<ActionContext, 'clinicId' | 'user'>,
  type: ContactType,
  id: string,
  tags: string[],
): Promise<{ id: string; tags: string[] }> {
  const clinicId = ctx.clinicId;
  const actorUserId = (ctx as any).user?.id ?? null;
  if (type === 'patient') {
    return atualizarTagsPacientePublic({ clinicId, patientId: id, tags, actorUserId });
  }
  if (type === 'lead') {
    return atualizarTagsLeadPublic({ clinicId, leadId: id, tags, actorUserId });
  }
  throw new Error('unknown_contact_type');
}