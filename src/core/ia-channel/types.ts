import type { PersonaType } from '@/core/ia-agent/types';

export interface Interlocutor {
  personaType: PersonaType;
  context: string;            // contexto NÃO-sensível injetável no prompt
  peerId: string;             // telefone (whatsapp) ou userId (chat)
  patientId?: string;
  leadId?: string;
}

// Assinaturas batem com os repos reais: (phone, clinicId). PatientRow/LeadRow têm mais campos;
// só usamos id + name (estruturalmente compatível).
export interface InterlocutorDeps {
  findPatientByPhone(phone: string, clinicId: string): Promise<{ id: string; name: string } | null>;
  findLeadByPhone(phone: string, clinicId: string): Promise<{ id: string; name: string | null } | null>;
}
