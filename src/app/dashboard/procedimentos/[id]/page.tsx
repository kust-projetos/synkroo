'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/lib/ui/dashboard-layout'

interface Procedure {
  id: string
  name: string
  description: string
  duration_minutes: number
  price: number
  is_active: boolean
}

export default function ProcedimentoDetalhePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const procedureId = params.id as string

  const [procedure, setProcedure] = useState<Procedure | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    duration_minutes: 30,
    price: 0,
  })

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (procedureId) {
      fetchProcedure()
    }
  }, [procedureId, fetchProcedure])

  const fetchProcedure = async () => {
    try {
      const response = await fetch(`/api/procedures/${procedureId}?clinic_id=${profile?.clinic_id}`)
      if (response.ok) {
        const data = await response.json()
        setProcedure(data.procedure)
        setForm({
          name: data.procedure.name,
          description: data.procedure.description || '',
          duration_minutes: data.procedure.duration_minutes || 30,
          price: data.procedure.price || 0,
        })
      }
    } catch (error) {
      console.error('Error fetching procedure:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    try {
      const response = await fetch(`/api/procedures/${procedureId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (response.ok) {
        setEditing(false)
        fetchProcedure()
      }
    } catch (error) {
      console.error('Error updating procedure:', error)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este procedimento?')) return

    try {
      const response = await fetch(`/api/procedures/${procedureId}?clinic_id=${profile?.clinic_id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.push('/dashboard/procedimentos')
      }
    } catch (error) {
      console.error('Error deleting procedure:', error)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price || 0)
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!user || !profile || !procedure) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/procedimentos" className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {editing ? 'Editar Procedimento' : 'Detalhes do Procedimento'}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duração (min)</label>
                  <input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    step={0.01}
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
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-medium text-gray-900 text-lg">{procedure.name}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Descrição</p>
                  <p className="text-gray-700">{procedure.description || 'Sem descrição'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duração</p>
                  <p className="font-medium text-gray-900">{procedure.duration_minutes} minutos</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Preço</p>
                  <p className="font-medium text-indigo-600 text-lg">{formatPrice(procedure.price)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    procedure.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {procedure.is_active ? 'Ativo' : 'Inativo'}
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
    </DashboardLayout>
  )
}