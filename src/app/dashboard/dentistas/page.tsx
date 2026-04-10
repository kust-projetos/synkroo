'use client'

import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserCircleIcon, PlusIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'

interface Dentist {
  id: string
  name: string
  phone: string
  email: string
  specialty: string
  cro_number: string
  cro: string
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

  const columns: Column<Dentist>[] = [
    {
      key: 'name',
      header: 'Nome',
      cell: (dentist) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 flex items-center justify-center">
            <UserCircleIcon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <span className="font-medium text-foreground">{dentist.name}</span>
        </div>
      ),
    },
    {
      key: 'specialty',
      header: 'Especialidade',
      cell: (dentist) => (
        <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800">
          {dentist.specialty || 'Geral'}
        </Badge>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      cell: (dentist) => <span className="text-sm text-muted-foreground">{dentist.phone || '-'}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      cell: (dentist) => <span className="text-sm text-muted-foreground">{dentist.email || '-'}</span>,
    },
    {
      key: 'cro',
      header: 'CRO',
      cell: (dentist) => <span className="text-sm text-muted-foreground">{dentist.cro || dentist.cro_number || '-'}</span>,
    },
    {
      key: 'actions',
      header: 'Ações',
      cell: (dentist) => (
        <Link
          href={`/dashboard/dentistas/${dentist.id}`}
          className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 inline-flex items-center gap-1"
        >
          Ver detalhes
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      ),
      className: 'text-right',
    },
  ]

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Dentistas"
        description="Gerencie os dentistas da clínica"
        action={
          <Button asChild className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600">
            <Link href="/dashboard/dentistas/novo">
              <PlusIcon className="h-4 w-4 mr-2" />
              Novo Dentista
            </Link>
          </Button>
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome ou especialidade..."
      />

      {(!isLoading && filteredDentists.length === 0) ? (
        <EmptyState
          icon={<UserCircleIcon className="h-8 w-8 text-teal-600 dark:text-teal-400" />}
          title={search ? 'Nenhum dentista encontrado' : 'Nenhum dentista cadastrado'}
          description={search ? 'Tente buscar com outros termos' : 'Comece cadastrando o primeiro dentista da clínica'}
          action={!search ? {
            label: 'Cadastrar Dentista',
            onClick: () => window.location.href = '/dashboard/dentistas/novo',
          } : undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredDentists}
          loading={isLoading}
          keyExtractor={(dentist) => dentist.id}
          emptyMessage={search ? 'Nenhum dentista encontrado' : 'Nenhum dentista cadastrado'}
        />
      )}
    </div>
  )
}
