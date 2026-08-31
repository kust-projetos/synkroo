/**
 * Comercial public seam — side-effect-free ports (W5.1).
 */
export {
  registerLeadNote as registrarNotaLead,
  updateLeadTags as atualizarTagsLead,
} from './services/lead-owner-service';

export { ensurePatientForLead } from './services/lead-conversion-service';

export async function converterLeadSemAgendar(input: {
  clinicId: string;
  leadId: string;
  actorUserId: string | null;
}) {
  const { converterLeadSemAgendar: convert } = await import('./services/lead-conversion-service');
  return convert(input);
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

export async function buscarLeadPorTelefone(clinicId: string, phone: string) {
  const { findLeadByPhone } = await import('./repositories/leads-repository');
  return findLeadByPhone(phone, clinicId);
}

export async function capturarLeadInbound(input: { clinicId: string; name: string; phone: string; source: string }) {
  const { normalizePhone, upsertLeadByPhoneNormalized } = await import('./repositories/leads-repository');
  const normalized = normalizePhone(input.phone);
  return upsertLeadByPhoneNormalized({ ...input, phoneNormalized: normalized });
}
