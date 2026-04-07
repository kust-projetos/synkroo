'use client'

import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Dentist {
  id: string
  name: string
  phone: string
  email: string
  specialty: string
  cro_number: string
  is_active: boolean
  created_at: string
}

export default function DentistasPage() {
  const { profile } = useAuth()
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchDentists = async () => {
    try {
      const response = await fetch(`/api/dentists?clinic_id=${profile?.clinic_id}`)
      if (response.ok) {
        const data = await response.json()
        setDentists(data.dentists || [])
      }
    } catch (error) {
      console.error('Error fetching dentists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (profile?.clinic_id) {
      fetchDentists()
    }
  }, [profile?.clinic_id])

  const filteredDentists = dentists.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.specialty?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dentistas</h1>
          <Link
            href="/dashboard/dentistas/novo"
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Dentista
          </Link>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Buscar por nome ou especialidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Dentists Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {filteredDentists.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {search ? 'Nenhum dentista encontrado' : 'Nenhum dentista cadastrado'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Especialidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CRO</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDentists.map((dentist) => (
                    <tr key={dentist.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{dentist.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
                          {dentist.specialty || 'Geral'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{dentist.phone || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{dentist.email || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{dentist.cro_number || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/dashboard/dentistas/${dentist.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Ver detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  )
}