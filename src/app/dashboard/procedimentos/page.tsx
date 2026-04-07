'use client'

import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ErrorState } from '@/components/ui/ErrorState'

interface Procedure {
  id: string
  name: string
  description: string
  duration_minutes: number
  price: number
  is_active: boolean
  created_at: string
}

export default function ProcedimentosPage() {
  const { profile } = useAuth()
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (profile?.clinic_id) {
      fetchProcedures()
    }
  }, [profile?.clinic_id, fetchProcedures])

  const fetchProcedures = async () => {
    try {
      const response = await fetch(`/api/procedures?clinic_id=${profile?.clinic_id}`)
      if (response.ok) {
        const data = await response.json()
        setProcedures(data.procedures || [])
      }
    } catch {
      setError('Falha ao carregar procedimentos')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredProcedures = procedures.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price || 0)
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Procedimentos</h1>
        <ErrorState message={error} onRetry={fetchProcedures} />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Procedimentos</h1>
          <Link
            href="/dashboard/procedimentos/novo"
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Procedimento
          </Link>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Buscar procedimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Procedures Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProcedures.length === 0 ? (
            <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-xl">
              {search ? 'Nenhum procedimento encontrado' : 'Nenhum procedimento cadastrado'}
            </div>
          ) : (
            filteredProcedures.map((procedure) => (
              <Link
                key={procedure.id}
                href={`/dashboard/procedimentos/${procedure.id}`}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-gray-900 mb-2">{procedure.name}</h3>
                {procedure.description && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{procedure.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{procedure.duration_minutes} min</span>
                  <span className="font-medium text-indigo-600">{formatPrice(procedure.price)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
  )
}