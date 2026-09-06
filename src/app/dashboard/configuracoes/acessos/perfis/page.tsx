import { redirect } from 'next/navigation';
import { buildUserContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';
import { listClinicRoles } from '@/modules/core/actions/list-clinic-roles';
import { getGroupedCatalog } from '@/core/rbac/grouped-catalog';
import { RoleForm } from '@/modules/core/ui/RoleForm';

export const dynamic = 'force-dynamic';

export default async function PerfisPage() {
  const ctx = await buildUserContext();
  if (!ctx.can('core:manage_users')) redirect('/dashboard');

  const groups = getGroupedCatalog();
  const rolesResult = await runAction(listClinicRoles, {}, ctx);
  if (!rolesResult.ok) {
    // Falhas de auth/permissão voltam ao dashboard; demais erros sobem para
    // o error boundary em vez de redirect silencioso que mascara a causa.
    if (rolesResult.error.code === 'unauthenticated' || rolesResult.error.code === 'forbidden') {
      redirect('/dashboard');
    }
    throw new Error('Não foi possível carregar os perfis da clínica.');
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Perfis de acesso</h1>
      <p className="text-gray-600 text-sm">
        Crie perfis com conjuntos de permissões e atribua a usuários da sua clínica.
      </p>

      <section>
        <h2 className="text-lg font-semibold mb-3">Criar novo perfil</h2>
        <RoleForm clinicId={ctx.clinicId} groups={groups} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Perfis existentes</h2>
        <ul className="text-sm text-gray-600 list-disc pl-5">
          {rolesResult.data.map((role) => <li key={role.id}>{role.name}</li>)}
        </ul>
      </section>
    </main>
  );
}
