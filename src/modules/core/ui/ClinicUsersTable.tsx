'use client';

import { useState } from 'react';
import { deactivateUserAction, removeUserAccessAction } from './actions';

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  roleId: string | null;
  roleName: string | null;
}

export function ClinicUsersTable({ clinicId, users }: { clinicId: string; users: UserRow[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'remove' | 'deactivate', userId: string) {
    setMessage(null);
    setError(null);
    const result = action === 'remove'
      ? await removeUserAccessAction(clinicId, { userId })
      : await deactivateUserAction(clinicId, { userId });
    if (result.ok) setMessage(action === 'remove' ? 'Acesso removido.' : 'Usuário desativado.');
    else setError(result.error.message);
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {message && <p className="text-green-600 text-sm">{message}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Usuário</th>
              <th className="p-2">Perfil</th>
              <th className="p-2">Status</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="p-2">{user.name || user.email}<br /><span className="text-xs text-gray-500">{user.email}</span></td>
                <td className="p-2">{user.roleName || 'Sem acesso'}</td>
                <td className="p-2">{user.isActive ? 'Ativo' : 'Inativo'}</td>
                <td className="p-2 space-x-2">
                  <button type="button" className="text-red-600 underline disabled:text-gray-400" disabled={!user.roleId} onClick={() => run('remove', user.id)}>Remover acesso</button>
                  <button type="button" className="text-amber-700 underline disabled:text-gray-400" disabled={!user.isActive} onClick={() => run('deactivate', user.id)}>Desativar usuário</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
