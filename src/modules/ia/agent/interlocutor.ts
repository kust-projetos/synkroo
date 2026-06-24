import type { PersonaType } from './personas';
import { findByPhone as dbFindPatientByPhone } from '@/modules/operacional/repositories/patients-repository';
import { getDb } from '@/lib/db/client';
import { leads } from '@/lib/db/schema/crm';
import { eq, and } from 'drizzle-orm';

// ── Public types ──────────────────────────────────────────────

export type InterlocutorKind = 'lead' | 'paciente' | 'desconhecido' | 'funcionario';

export interface InterlocutorResult {
  kind: InterlocutorKind;
  personaType: PersonaType;
  context: {
    patientId?: string;
    leadId?: string;
    userId?: string;
    phone?: string;
  };
}

export interface InterlocutorResolver {
  resolve(params: { phone?: string; userId?: string; clinicId: string }): Promise<InterlocutorResult>;
}

export interface InterlocutorDeps {
  findByPhone?: (clinicId: string, phone: string) => Promise<{ id: string } | null>;
  findLeadByPhone?: (clinicId: string, phone: string) => Promise<{ id: string } | null>;
}

// ── Default lead lookup ──────────────────────────────────────

async function defaultFindLeadByPhone(
  clinicId: string,
  phone: string,
): Promise<{ id: string } | null> {
  const db = getDb();
  const rows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.clinicId, clinicId), eq(leads.phone, phone)))
    .limit(1);
  return rows[0] ?? null;
}

// ── Factory ───────────────────────────────────────────────────

export function createInterlocutorResolver(deps?: InterlocutorDeps): InterlocutorResolver {
  const findPatient = deps?.findByPhone ?? dbFindPatientByPhone;
  const findLead = deps?.findLeadByPhone ?? defaultFindLeadByPhone;

  return {
    async resolve(params: { phone?: string; userId?: string; clinicId: string }): Promise<InterlocutorResult> {
      const { phone, userId, clinicId } = params;

      // userId → funcionario
      if (userId) {
        return {
          kind: 'funcionario',
          personaType: 'gestao',
          context: { userId },
        };
      }

      // phone → paciente / lead / desconhecido
      if (phone) {
        // 1. Try patient
        const patient = await findPatient(clinicId, phone);
        if (patient) {
          return {
            kind: 'paciente',
            personaType: 'relacionamento',
            context: { patientId: patient.id, phone },
          };
        }

        // 2. Try lead
        const lead = await findLead(clinicId, phone);
        if (lead) {
          return {
            kind: 'lead',
            personaType: 'vendas',
            context: { leadId: lead.id, phone },
          };
        }

        // 3. No match → desconhecido
        return {
          kind: 'desconhecido',
          personaType: 'recepcao',
          context: { phone },
        };
      }

      // No phone and no userId → desconhecido
      return {
        kind: 'desconhecido',
        personaType: 'recepcao',
        context: {},
      };
    },
  };
}
