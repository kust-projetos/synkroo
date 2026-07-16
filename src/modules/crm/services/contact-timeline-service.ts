/**
 * contact-timeline-service.ts — timeline (eventos) por contato.
 *
 * SELECT only. Retorna [] para type desconhecido (a action retorna not_found).
 */
import type { ActionContext } from '@/core/actions/types';
import {
  listContactTimeline,
  type ContactType,
  type TimelineEntry,
} from '../repositories/contact-read-repository';

export async function listContactTimelineService(
  ctx: Pick<ActionContext, 'clinicId'>,
  type: ContactType,
  id: string,
): Promise<TimelineEntry[]> {
  if (type !== 'patient' && type !== 'lead') return [];
  return listContactTimeline(ctx.clinicId, type, id);
}