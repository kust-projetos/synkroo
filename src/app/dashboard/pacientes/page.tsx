'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { UserGroupIcon, PlusIcon, PencilIcon } from '@heroicons/react/24/outline'
import type { Patient } from '@/lib/supabase/database.types'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'

interface PatientWithAppointments extends Patient {
  appointments?: Array<{
    id: string
    scheduled_at: string
    status: string
  }>
}

export default function PatientsPage() {
  const { profile } = useAuth()
  const [patients, setPatients] = useState<PatientWithAppointments[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const clinicId = profile?.clinic_id

  const fetchPatients = useCallback(async () => {
    if (!clinicId) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        clinic_id: clinicId,
        page: String(page),
        limit: '20',
      })
      if (search) params.append('search', search)

      const response = await fetch(`/api/patients?${params}`)
      const data = await response.json()

      if (response.ok) {
        setPatients(data.patients || [])
        setTotalPages(data.pagination?.totalPages || 1)
      } else {
        console.error('Failed to fetch patients:', data.error)
      }
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setLoading(false)
    }
  }, [clinicId, page, search])

  useEffect(() => {
    if (clinicId) {
      fetchPatients()
    }
  }, [clinicId, fetchPatients])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchPatients()
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  const formatPhone = (phone: string) => {
    if (phone.length === 11) {
      return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
    }
    return phone
  }

  const columns: Column<PatientWithAppointments>[] = [
    {
      key: 'name',
      header: 'Nome',
      cell: (patient) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 flex items-center justify-center">
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400">
              {patient.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-medium text-foreground">{patient.name}</div>
            {patient.cpf && (
              <div className="text-sm text-muted-foreground">CPF: {patient.cpf}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      cell: (patient) => <span className="text-sm">{formatPhone(patient.phone)}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      cell: (patient) => (
        <span className="text-sm text-muted-foreground">{patient.email || '-'}</span>
      ),
    },
    {
      key: 'last_visit',
      header: 'Última Visita',
      cell: (patient) => (
        <span className="text-sm text-muted-foreground">{formatDate(patient.last_visit_at)}</span>
      ),
    },
    {
      key: 'tags',
      header: 'Tags',
      cell: (patient) => (
        <div className="flex flex-wrap gap-1">
          {patient.tags?.slice(0, 3).map((tag, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {(patient.tags?.length ?? 0) > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{(patient.tags?.length ?? 0) - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      cell: (patient) => (
        <div className="flex items-center gap-3 justify-end">
          <Link
            href={`/dashboard/pacientes/${patient.id}`}
            className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
          >
            Ver
          </Link>
          <Link
            href={`/dashboard/pacientes/${patient.id}/editar`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            Editar
          </Link>
        </div>
      ),
      className: 'text-right',
    },
  ]

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Pacientes"
        description="Gerencie os pacientes da clínica"
        action={
          <Button asChild className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600">
            <Link href="/dashboard/pacientes/novo">
              <PlusIcon className="h-4 w-4 mr-2" />
              Novo Paciente
            </Link>
          </Button>
        }
      />

      <form onSubmit={handleSearch}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, telefone ou email..."
        />
      </form>

      {(!loading && patients.length === 0) ? (
        <EmptyState
          icon={<UserGroupIcon className="h-8 w-8 text-teal-600 dark:text-teal-400" />}
          title={search ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
          description={search ? 'Tente buscar com outros termos' : 'Comece cadastrando o primeiro paciente da clínica'}
          action={!search ? {
            label: 'Cadastrar Paciente',
            onClick: () => window.location.href = '/dashboard/pacientes/novo',
          } : undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          data={patients}
          loading={loading}
          keyExtractor={(patient) => patient.id}
          emptyMessage={search ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3 rounded-xl">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Próximo
            </Button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Página <span className="font-medium text-foreground">{page}</span> de{' '}
              <span className="font-medium text-foreground">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próximo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
