import { redirect } from 'next/navigation';
import { buildUserContext } from '@/core/actions/context';
import { getGroupedCatalog } from '@/core/rbac/grouped-catalog';
import { RoleForm } from '@/modules/core/ui/RoleForm';
import { listClinicRolesAction } from '@/modules/core/ui/actions';

export const dynamic = 'force-dynamic';

export default async function PerfisPage() {
  const ctx = await buildUserContext();
  if (!ctx.can('core:manage_users')) redirect('/dashboard');

  const groups = getGroupedCatalog();
  const rolesResult = await listClinicRolesAction(ctx.clinicId);
  if (!rolesResult.ok) redirect('/dashboard');

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
