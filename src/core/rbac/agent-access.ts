import { getDb } from '@/lib/db/client';
import { and, eq } from 'drizzle-orm';
import { roles, rolePermissions } from '@/modules/core/schema/rbac';

export const AGENT_ROLE_NAME = 'Agente';

// Permissões default do agente autônomo. Conservador: agendar/confirmar/responder;
// NÃO cancelar tratamento nem alterar financeiro sem humano (§3.7).
export const DEFAULT_AGENT_PERMISSIONS = [
  'operacional:create', 'operacional:confirm', 'operacional:view',
  'comercial:view', 'atendimento:reply',
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
