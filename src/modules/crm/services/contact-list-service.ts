/**
 * contact-list-service.ts — listagem unificada de contatos (patient + lead).
 *
 * Camada fina entre actions e contact-read-repository. Mantém apenas o
 * shape de input/output que as actions expõem.
 */
import type { ActionContext } from '@/core/actions/types';
import {
  listContacts,
  countContacts,
  type ContactListOptions,
  type ContactListRow,
} from '../repositories/contact-read-repository';

export interface ListContactsInput {
  search?: string;
  type?: 'patient' | 'lead';
  limit: number;
  offset: number;
}

export interface ListContactsResult {
  data: ContactListRow[];
  total: number;
}

export async function listContactsService(
  ctx: Pick<ActionContext, 'clinicId'>,
  input: ListContactsInput,
): Promise<ListContactsResult> {
  const opts: ContactListOptions = {
    limit: input.limit,
    offset: input.offset,
    ...(input.search ? { search: input.search } : {}),
    ...(input.type ? { type: input.type } : {}),
  };
  const [data, total] = await Promise.all([
    listContacts(ctx.clinicId, opts),
    countContacts(ctx.clinicId, opts),
  ]);
  return { data, total };
}