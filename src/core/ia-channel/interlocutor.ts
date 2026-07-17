import type { Interlocutor, InterlocutorDeps } from './types';

// Identidade por telefone é DICA FRACA: contexto sensível NÃO entra só por isso (spec §Segurança).
// Aqui só o nome (não-sensível) é injetado; dados clínicos/financeiros exigem verificação no ia-bridge.
export async function resolveInterlocutor(
  deps: InterlocutorDeps,
  clinicId: string,
  phone: string,
): Promise<Interlocutor> {
  const patient = await deps.findPatientByPhone(phone, clinicId);
  if (patient) {
    return {
      personaType: 'paciente',
      context: `Paciente: ${patient.name}`,
      peerId: phone,
      patientId: patient.id,
    };
  }

  const lead = await deps.findLeadByPhone(phone, clinicId);
  if (lead) {
    return {
      personaType: 'vendas',
      context: lead.name ? `Lead: ${lead.name}` : '',
      peerId: phone,
      leadId: lead.id,
    };
  }

  return { personaType: 'recepcao', context: '', peerId: phone };
}

export function resolveFuncionario(userId: string, _userName: string): Interlocutor {
  // No chat interno, o principal é o usuário autenticado; o RBAC dele governa as tools.
  return {
    personaType: 'funcionario',
    context: 'Atendimento interno (funcionário).',
    peerId: userId,
  };
}
