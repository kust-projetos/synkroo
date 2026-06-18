import { redirect } from 'next/navigation';
import { buildUserContext } from '@/core/actions';
import { getGroupedCatalog } from '@/core/rbac/grouped-catalog';
import { RoleForm } from '@/modules/core/ui/RoleForm';

export const dynamic = 'force-dynamic';

export default async function PerfisPage() {
  const ctx = await buildUserContext();
  if (!ctx.can('core:manage_users')) redirect('/dashboard');

  const groups = getGroupedCatalog();

  // TODO(W3.5): carregar lista real de perfis via repositórios Core
  // (depende de API routes / repositories que virão no Eixo 2)

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
    </main>
  );
}
