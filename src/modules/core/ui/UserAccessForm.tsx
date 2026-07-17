'use client';
import { useState } from 'react';
import { assignUserAccessAction } from './actions';

interface UserOption { id: string; name: string | null; email: string; isActive: boolean; roleId: string | null; roleName: string | null; }
interface RoleOption { id: string; name: string; description: string | null; isSystem: boolean; }

interface Props {
  clinicId: string;
  users: UserOption[];
  roles: RoleOption[];
}

export function UserAccessForm({ clinicId, users, roles }: Props) {
  const [userId, setUserId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const res = await assignUserAccessAction(clinicId, { userId, clinicId, roleId });
    if (res.ok) {
      setResult('Acesso concedido com sucesso.');
      setUserId('');
      setRoleId('');
    } else {
      setError(res.error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-1">Usuário</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" required>
          <option value="">Selecione um usuário</option>
          {users.map((user) => (
            <option key={user.id} value={user.id} disabled={!user.isActive}>
              {user.name || user.email} ({user.email}){user.isActive ? '' : ' — inativo'}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Perfil</label>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" required>
          <option value="">Selecione um perfil</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {result && <p className="text-green-600 text-sm">{result}</p>}
      <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700" disabled={!userId || !roleId}>
        Conceder acesso
      </button>
    </form>
  );
}
