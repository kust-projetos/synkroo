/**
 * Atendimento public seam — portas laterais consumidas por outros módulos.
 *
 * Segue a convenção de `operacional/public.ts` e `comercial/public.ts`:
 * re-export nomeado do mesmo binding, sem mudança de comportamento. O gate
 * `boundaries` só permite cross-module via `public.ts` (ou `schema/**`),
 * então leituras transacionais de outro módulo passam por aqui.
 */
import { resolveInterlocutor } from '@/core/ia-channel/interlocutor';
import { buscarPacientePorTelefone } from '@/modules/operacional/public';
import { buscarLeadPorTelefone } from '@/modules/comercial/public';

export { getConversationContext } from './repositories/conversations-repository';

/**
 * Contexto NÃO-sensível do interlocutor por telefone (só o NOME circula —
 * ver `core/ia-channel/interlocutor.ts`: dados clínicos/financeiros exigem
 * verificação no ia-bridge e nunca entram por aqui).
 *
 * Mora neste seam porque `atendimento` já declara `operacional` + `comercial`
 * no grafo aprovado — consumidores de outros módulos (ex.: `ia`) resolvem o
 * interlocutor sem declarar dependências novas.
 */
export async function resolveInterlocutorContext(clinicId: string, phone: string): Promise<string> {
  const interlocutor = await resolveInterlocutor(
    {
      findPatientByPhone: (p, c) => buscarPacientePorTelefone(c, p).then((r) => (r ? { id: r.id, name: r.name } : null)),
      findLeadByPhone: (p, c) => buscarLeadPorTelefone(c, p).then((r) => (r ? { id: r.id, name: r.name ?? null } : null)),
    },
    clinicId,
    phone,
  );
  return interlocutor.context;
}
