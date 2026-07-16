/**
 * contact-detail-service.ts — lookup único por {type,id}.
 *
 * Apenas SELECT. Cross-tenant ou inexistente → null (a action converte para not_found).
 */
import type { ActionContext } from '@/core/actions/types';
import {
  getContact,
  type ContactDetail,
  type ContactType,
} from '../repositories/contact-read-repository';

export async function getContactService(
  ctx: Pick<ActionContext, 'clinicId'>,
  type: ContactType,
  id: string,
): Promise<ContactDetail | null> {
  if (type !== 'patient' && type !== 'lead') return null;
  return getContact(ctx.clinicId, type, id);
}