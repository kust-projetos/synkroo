/**
 * contact-tags-service.ts — atualização de tags do contato via owner bridge.
 *
 * type='patient' → operacional.atualizarTagsPaciente.handler
 * type='lead'    → comercial.atualizarTagsLead.handler
 * Sem acesso direto a tabelas owner para mutação.
 */
import type { ActionContext } from '@/core/actions/types';
import type { ContactType } from '../repositories/contact-read-repository';
import { atualizarTagsPaciente } from '@/modules/operacional/actions/atualizar-tags-paciente';
import { atualizarTagsLead } from '@/modules/comercial/actions/atualizar-tags-lead';

export async function updateContactTagsService(
  ctx: Pick<ActionContext, 'clinicId'>,
  type: ContactType,
  id: string,
  tags: string[],
): Promise<{ id: string; tags: string[] }> {
  if (type === 'patient') {
    return atualizarTagsPaciente.handler(
      { patientId: id, tags },
      ctx as ActionContext,
    );
  }
  if (type === 'lead') {
    return atualizarTagsLead.handler(
      { leadId: id, tags },
      ctx as ActionContext,
    );
  }
  throw new Error('unknown_contact_type');
}