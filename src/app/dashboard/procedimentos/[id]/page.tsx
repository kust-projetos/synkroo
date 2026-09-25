'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PencilIcon, TrashIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'
import { DetailPage } from '@/components/ui/detail-page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

interface Procedure {
  id: string
  name: string
  description?: string | null
  // Canônico (Drizzle/camelCase) + legado (snake_case) — API retorna camelCase
  durationMinutes?: number | string | null
  duration_minutes?: number | string | null
  price?: number | string | null
  isActive?: boolean
  is_active?: boolean
}

export default function ProcedimentoDetalhePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const procedureId = params.id as string

  const [procedure, setProcedure] = useState<Procedure | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  const fetchProcedure = async () => {
    try {
      const response = await fetch(`/api/procedures/${procedureId}?clinic_id=${profile?.clinic_id}`)
      // 404 canônico (inexistente ou cross-tenant opaco) → estado "não encontrado"
      if (response.status === 404) {
        setProcedure(null)
        return
      }
      if (response.ok) {
        const body = await response.json()
        // Envelope canônico { data } (com fallback legado { procedure })
        const item = (body?.data ?? body?.procedure ?? null) as Procedure | null
        if (!item) {
          setProcedure(null)
          return
        }
        setProcedure(item)
        setForm({
          name: item.name ?? '',
          description: item.description || '',
          duration_minutes: Number(item.durationMinutes ?? item.duration_minutes ?? 30) || 30,
          price: Number(item.price ?? 0) || 0,
        })
      } else {
        setError('Falha ao carregar dados do procedimento')
      }
    } catch (error) {
      console.error('Error fetching procedure:', error)
      setError('Falha ao carregar dados do procedimento')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (procedureId) {
      fetchProcedure()
    }
  }, [procedureId])

  const handleUpdate = async () => {
    try {
      // Payload em chaves canônicas (a action ignora chaves desconhecidas)
      const payload = {
        name: form.name,
        description: form.description,
        durationMinutes: form.duration_minutes,
        price: String(form.price),
      }
      const response = await fetch(`/api/procedures/${procedureId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8">
        <EmptyState
          title="Erro ao carregar"
          description={error}
          action={{ label: "Tentar novamente", onClick: fetchProcedure }}
        />
      </div>
    )
  }

  if (!procedure) {
    return (
      <div className="p-4 lg:p-8">
        <EmptyState
          title="Procedimento não encontrado"
          description="O procedimento que você está procurando não existe ou foi removido."
          action={{ label: "Voltar para lista", onClick: () => router.push('/dashboard/procedimentos') }}
        />
      </div>
    )
  }

  const isActive = procedure.isActive ?? procedure.is_active ?? false
  const durationDisplay = Number(procedure.durationMinutes ?? procedure.duration_minutes ?? 30) || 30
  const priceValue = Number(procedure.price ?? 0) || 0

  const actions = editing ? undefined : (
    <>
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <PencilIcon className="h-4 w-4 mr-1" />
        Editar
      </Button>
      <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive">
        <TrashIcon className="h-4 w-4 mr-1" />
        Excluir
      </Button>
    </>
  )

  return (
    <DetailPage
      title={editing ? 'Editar Procedimento' : procedure.name}
      backHref="/dashboard/procedimentos"
      status={editing ? undefined : { type: isActive ? 'success' : 'error', label: isActive ? 'Ativo' : 'Inativo' }}
      actions={actions}
    >
      <Card className="max-w-2xl p-6">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Duração (min)</label>
                <Input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Preço (R$)</label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                  step={0.01}
                />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <Button onClick={handleUpdate} className="bg-teal-600 hover:bg-teal-700">
                Salvar
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium text-foreground text-lg">{procedure.name}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Descrição</p>
                <p className="text-foreground">{procedure.description || 'Sem descrição'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  Duração
                </p>
                <p className="font-medium text-foreground">{durationDisplay} minutos</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CurrencyDollarIcon className="h-4 w-4" />
                  Preço
                </p>
                <p className="font-medium text-teal-600 text-lg">{formatPrice(priceValue)}</p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </DetailPage>
  )
}
