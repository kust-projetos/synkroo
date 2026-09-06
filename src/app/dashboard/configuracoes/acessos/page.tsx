import { redirect } from 'next/navigation';
import { buildUserContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';
import { listClinicUsers } from '@/modules/core/actions/list-clinic-users';
import { listClinicRoles } from '@/modules/core/actions/list-clinic-roles';
import { getGroupedCatalog } from '@/core/rbac/grouped-catalog';
import { UserAccessForm } from '@/modules/core/ui/UserAccessForm';
import { ClinicUsersTable } from '@/modules/core/ui/ClinicUsersTable';

export const dynamic = 'force-dynamic';

function isAuthFailure(code: string) {
  return code === 'unauthenticated' || code === 'forbidden';
}

export default async function AcessosPage() {
  const ctx = await buildUserContext();
  if (!ctx.can('core:manage_users')) redirect('/dashboard');

  const groups = getGroupedCatalog();
  const [usersResult, rolesResult] = await Promise.all([
    runAction(listClinicUsers, {}, ctx),
    runAction(listClinicRoles, {}, ctx),
  ]);

  if (!usersResult.ok || !rolesResult.ok) {
    const code = !usersResult.ok ? usersResult.error.code : (rolesResult as { ok: false; error: { code: string } }).error.code;
    // Falhas de auth/permissão voltam ao dashboard; demais erros sobem para
    // o error boundary em vez de redirect silencioso que mascara a causa.
    if (isAuthFailure(code)) redirect('/dashboard');
    throw new Error('Não foi possível carregar usuários e perfis da clínica.');
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Usuários e acessos</h1>
      <p className="text-gray-600 text-sm">
        Gerencie quem acessa sua clínica e quais permissões cada pessoa tem.
      </p>

      <section>
        <h2 className="text-lg font-semibold mb-3">Usuários da clínica</h2>
        <ClinicUsersTable clinicId={ctx.clinicId} users={usersResult.data} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Conceder acesso a um usuário</h2>
        <UserAccessForm clinicId={ctx.clinicId} users={usersResult.data} roles={rolesResult.data} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Perfis disponíveis</h2>
        <ul className="text-sm text-gray-600 list-disc pl-5">
          {rolesResult.data.map((role) => <li key={role.id}>{role.name}</li>)}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Permissões do sistema</h2>
        <p className="text-gray-500 text-sm mb-2">
          Abaixo estão as permissões que podem ser atribuídas a cada perfil, organizadas por módulo.
        </p>
        <div className="text-sm space-y-2">
          {groups.map((g) => (
            <div key={g.module} className="border rounded p-3">
              <p className="font-medium">{g.moduleLabel}</p>
              <ul className="list-disc pl-5 text-gray-600">
                {g.permissions.map((p) => (
                  <li key={p.key}>{p.label}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
