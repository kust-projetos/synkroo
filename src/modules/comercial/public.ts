/**
 * Comercial public seam — side-effect-free ports (W5.1).
 */
export async function registrarNotaLead(input: { clinicId: string; leadId: string; content: string; actorUserId: string | null }) {
  const { findLeadByIdForClinic } = await import('./repositories/leads-repository');
  const lead = await findLeadByIdForClinic(input.leadId, input.clinicId);
  if (!lead) throw new (await import('@/core/actions/types')).ActionError('not_found', 'Lead não encontrado.');
  const { insertActivity } = await import('./repositories/activities-repository');
  return insertActivity({ leadId: input.leadId, activityType: 'note', description: input.content, metadata: { createdBy: input.actorUserId } } as any);
}

export async function atualizarTagsLead(input: { clinicId: string; leadId: string; tags: string[]; actorUserId: string | null }) {
  const { findLeadByIdForClinic, updateLeadTags } = await import('./repositories/leads-repository');
  const lead = await findLeadByIdForClinic(input.leadId, input.clinicId);
  if (!lead) throw new (await import('@/core/actions/types')).ActionError('not_found', 'Lead não encontrado.');
  const res = await updateLeadTags(input.clinicId, input.leadId, input.tags);
  return { id: (res as any)?.id ?? input.leadId, tags: input.tags };
}

export async function ensurePatientForLead(input: { clinicId: string; leadId: string; actorUserId: string | null }) {
  const { findLeadByIdForClinic } = await import('./repositories/leads-repository');
  const lead = await findLeadByIdForClinic(input.leadId, input.clinicId);
  if (!lead) throw new (await import('@/core/actions/types')).ActionError('not_found', 'Lead não encontrado.');
  // TODO W5.3: criar/atualizar patient via operacional public seam, sem buildSystemContext
  return { patientId: input.leadId, created: false };
}

export async function mergeLeads(input: { clinicId: string; winnerId: string; loserId: string }) {
  const { mergeLeads: merge } = await import('./repositories/leads-repository');
  return merge(input.winnerId, input.loserId, input.clinicId);
}

export async function isMergedLead(clinicId: string, leadId: string) {
  const { findLeadByIdForClinic } = await import('./repositories/leads-repository');
  const l = await findLeadByIdForClinic(leadId, clinicId);
  return (l as any)?.mergeStatus === 'merged';
}
