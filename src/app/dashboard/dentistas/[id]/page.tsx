'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ErrorState } from '@/components/ui/ErrorState'

interface Dentist {
  id: string
  name: string
  phone: string
  email: string
  specialty: string
  cro_number: string
  is_active: boolean
}

export default function DentistaDetalhePage() {
  const { profile } = useAuth()
  const router = useRouter()
  const params = useParams()
  const dentistId = params.id as string

  const [dentist, setDentist] = useState<Dentist | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    specialty: '',
    cro_number: '',
  })

  const fetchDentist = async () => {
    try {
      const response = await fetch(`/api/dentists/${dentistId}?clinic_id=${profile?.clinic_id}`)
      if (response.ok) {
        const data = await response.json()
        setDentist(data.dentist)
        setForm({
          name: data.dentist.name,
          phone: data.dentist.phone || '',
          email: data.dentist.email || '',
          specialty: data.dentist.specialty || '',
          cro_number: data.dentist.cro_number || '',
        })
      }
    } catch {
      setError('Falha ao carregar dados do dentista')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (dentistId) {
      fetchDentist()
    }
  }, [dentistId])

  const handleUpdate = async () => {
    try {
      const response = await fetch(`/api/dentists/${dentistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (response.ok) {
        setEditing(false)
        fetchDentist()
      } else {
        setError('Falha ao atualizar dentista')
      }
    } catch {
      setError('Falha ao atualizar dentista')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este dentista?')) return

    try {
      const response = await fetch(`/api/dentists/${dentistId}?clinic_id=${profile?.clinic_id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.push('/dashboard/dentistas')
      } else {
        setError('Falha ao excluir dentista')
      }
    } catch {
      setError('Falha ao excluir dentista')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8">
        <ErrorState message={error} onRetry={fetchDentist} />
      </div>
    )
  }

  if (!dentist) {
    return (
      <div className="p-4 lg:p-8">
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-sm">
          <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <p className="text-gray-500 mb-4">Dentista não encontrado</p>
          <Link href="/dashboard/dentistas" className="text-indigo-600 hover:text-indigo-700 text-sm">
            Voltar para lista
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/dentistas" className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {editing ? 'Editar Dentista' : 'Detalhes do Dentista'}
          </h1>
        </div>

        <div className="max-w-2xl bg-white rounded-xl shadow-sm p-6">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Especialidade</label>
                  <select
                    value={form.specialty}
                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Selecione...</option>
                    <option value="Clínico Geral">Clínico Geral</option>
                    <option value="Ortodontia">Ortodontia</option>
                    <option value="Implantodontia">Implantodontia</option>
                    <option value="Endodontia">Endodontia</option>
                    <option value="Periodontia">Periodontia</option>
                    <option value="Odontopediatria">Odontopediatria</option>
                    <option value="Estética Dental">Estética Dental</option>
                    <option value="Prótese">Prótese</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CRO</label>
                  <input
                    type="text"
                    value={form.cro_number}
                    onChange={(e) => setForm({ ...form, cro_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleUpdate}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-medium text-gray-900">{dentist.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Especialidade</p>
                  <p className="font-medium text-gray-900">{dentist.specialty || 'Geral'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Telefone</p>
                  <p className="font-medium text-gray-900">{dentist.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{dentist.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">CRO</p>
                  <p className="font-medium text-gray-900">{dentist.cro_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    dentist.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {dentist.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
              <div className="flex gap-4 pt-4 border-t">
                <button
                  onClick={() => setEditing(true)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={handleDelete}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  )
}