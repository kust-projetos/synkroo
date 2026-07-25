/**
 * contact-notes-service.ts — leitura + adição de notas no contato.
 *
 * READ: SELECT via contact-read-repository.
 * ADD: roteia para owner bridge por type:
 *   - 'patient' → operacional.registrarObservacaoPaciente.handler
 *   - 'lead'    → comercial.registrarNotaLead.handler
 * Sem acesso direto a tabelas owner para mutação.
 */
import type { ActionContext } from '@/core/actions/types';
import {
  listContactNotes,
  type ContactType,
  type NoteEntry,
} from '../repositories/contact-read-repository';
import { registrarObservacaoPaciente } from '@/modules/operacional/actions';
import { registrarNotaLead } from '@/modules/comercial/actions';

export async function listContactNotesService(
  ctx: Pick<ActionContext, 'clinicId'>,
  type: ContactType,
  id: string,
): Promise<NoteEntry[]> {
  if (type !== 'patient' && type !== 'lead') return [];
  return listContactNotes(ctx.clinicId, type, id);
}

export async function addContactNoteService(
  ctx: Pick<ActionContext, 'clinicId' | 'user'>,
  type: ContactType,
  id: string,
  content: string,
): Promise<{ id: string }> {
  if (type === 'patient') {
    return registrarObservacaoPaciente.handler(
      { patientId: id, content },
      ctx as ActionContext,
    );
  }
  if (type === 'lead') {
    return registrarNotaLead.handler(
      { leadId: id, description: content },
      ctx as ActionContext,
    );
  }
  // type desconhecido — quem chama converte para not_found.
  throw new Error('unknown_contact_type');
}