import { getDb } from '@/lib/db/client';
import { and, eq } from 'drizzle-orm';
import { roles, rolePermissions } from '@/modules/core/schema/rbac';

export const AGENT_ROLE_NAME = 'Agente';

// Permissões default do agente autônomo. Conservador: agendar/confirmar/responder;
// NÃO cancelar tratamento nem alterar financeiro sem humano (§3.7).
// Keys reais: operacional:view (consultar), operacional:manage_appointments (agendar/confirmar),
// atendimento:manage_messages (enviar resposta via enviarMensagem).
export const DEFAULT_AGENT_PERMISSIONS = [
  'operacional:view',
  'operacional:manage_appointments',
  'atendimento:manage_messages',
];

export interface AgentAccessRepo {
  getAgentPermissions(clinicId: string): Promise<string[]>;
}

export const drizzleAgentAccessRepo: AgentAccessRepo = {
  async getAgentPermissions(clinicId) {
    const r = await getDb()
      .select({ key: rolePermissions.permissionKey })
      .from(roles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(and(eq(roles.clinicId, clinicId), eq(roles.name, AGENT_ROLE_NAME), eq(roles.isSystem, true)));
    return r.length ? r.map((x) => x.key) : DEFAULT_AGENT_PERMISSIONS;
  },
};
