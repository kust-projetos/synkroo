'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PencilIcon, TrashIcon, UserIcon } from '@heroicons/react/24/outline'
import { DetailPage } from '@/components/ui/detail-page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

interface Dentist {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  specialty?: string | null
  // Canônico (Drizzle/camelCase) + legado (snake_case) — API retorna camelCase
  cro?: string | null
  croNumber?: string | null
  cro_number?: string | null
  isActive?: boolean
  is_active?: boolean
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
      // 404 canônico (inexistente ou cross-tenant opaco) → estado "não encontrado"
      if (response.status === 404) {
        setDentist(null)
        return
      }
      if (response.ok) {
        const body = await response.json()
        // Envelope canônico { data } (com fallback legado { dentist })
        const item = (body?.data ?? body?.dentist ?? null) as Dentist | null
        if (!item) {
          setDentist(null)
          return
        }
        setDentist(item)
        setForm({
          name: item.name ?? '',
          phone: item.phone || '',
          email: item.email || '',
          specialty: item.specialty || '',
          cro_number: item.croNumber ?? item.cro ?? item.cro_number ?? '',
        })
      } else {
        setError('Falha ao carregar dados do dentista')
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
      // Payload em chaves canônicas (a action ignora chaves desconhecidas)
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        specialty: form.specialty,
        cro: form.cro_number,
      }
      const response = await fetch(`/api/dentists/${dentistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8">
        <EmptyState
          title="Erro ao carregar"
          description={error}
          action={{ label: "Tentar novamente", onClick: fetchDentist }}
        />
      </div>
    )
  }

  if (!dentist) {
    return (
      <div className="p-4 lg:p-8">
        <EmptyState
          title="Dentista não encontrado"
          description="O dentista que você está procurando não existe ou foi removido."
          icon={<UserIcon className="h-12 w-12 text-muted-foreground" />}
          action={{ label: "Voltar para lista", onClick: () => router.push('/dashboard/dentistas') }}
        />
      </div>
    )
  }

  const isActive = dentist.isActive ?? dentist.is_active ?? false
  const croDisplay = dentist.croNumber ?? dentist.cro ?? dentist.cro_number ?? null

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
      title={editing ? 'Editar Dentista' : dentist.name}
      backHref="/dashboard/dentistas"
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Especialidade</label>
                <select
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                <label className="block text-sm font-medium text-foreground mb-1">CRO</label>
                <Input
                  type="text"
                  value={form.cro_number}
                  onChange={(e) => setForm({ ...form, cro_number: e.target.value })}
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
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium text-foreground text-lg">{dentist.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Especialidade</p>
                <p className="font-medium text-foreground">{dentist.specialty || 'Geral'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium text-foreground">{dentist.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{dentist.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CRO</p>
                <p className="font-medium text-foreground">{croDisplay || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </DetailPage>
  )
}
