import { redirect } from 'next/navigation';
import { buildUserContext } from '@/core/actions';
import { getGroupedCatalog } from '@/core/rbac/grouped-catalog';
import { UserAccessForm } from '@/modules/core/ui/UserAccessForm';

export default async function AcessosPage() {
  const ctx = await buildUserContext();
  if (!ctx.can('core:manage_users')) redirect('/dashboard');

  const groups = getGroupedCatalog();

  // TODO(W3.5): carregar lista real de usuários e perfis via repositórios Core
  // (depende de API routes / repositories que virão no Eixo 2 com o módulo Core)

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Usuários e acessos</h1>
      <p className="text-gray-600 text-sm">
        Gerencie quem acessa sua clínica e quais permissões cada pessoa tem.
      </p>

      <section>
        <h2 className="text-lg font-semibold mb-3">Conceder acesso a um usuário</h2>
        <UserAccessForm clinicId={ctx.clinicId} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Perfis disponíveis</h2>
        <p className="text-gray-500 text-sm">
          Para criar ou editar perfis, acesse{' '}
          <a href="/dashboard/configuracoes/acessos/perfis" className="text-blue-600 underline">
            Perfis de acesso
          </a>.
        </p>
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
