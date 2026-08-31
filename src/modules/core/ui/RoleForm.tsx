'use client';
import { useState } from 'react';
import { PermissionMatrix } from './PermissionMatrix';
import { createRoleAction } from './actions';
import type { PermissionGroup } from '@/core/rbac/grouped-catalog';

interface Props {
  clinicId: string;
  groups: PermissionGroup[];
}

export function RoleForm({ clinicId, groups }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const res = await createRoleAction(clinicId, {
      name,
      description: description || undefined,
      permissionKeys: [...selected],
    });
    if (res.ok) {
      setResult('Perfil criado com sucesso.');
      setName('');
      setDescription('');
      setSelected(new Set());
    } else {
      setError(res.error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-1">Nome do perfil</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          required
          placeholder="Ex: Recepção avançada"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Descrição</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="O que este perfil pode fazer"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Permissões</label>
        <PermissionMatrix groups={groups} selected={selected} onChange={setSelected} />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {result && <p className="text-green-600 text-sm">{result}</p>}
      <button
        type="submit"
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        disabled={!name}
      >
        Criar perfil
      </button>
    </form>
  );
}
