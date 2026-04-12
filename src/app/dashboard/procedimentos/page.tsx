'use client'

import { useAuth } from '@/lib/auth/context'
import { useState } from 'react'
import Link from 'next/link'
import { BeakerIcon, PlusIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'
import { useProcedures } from '@/lib/hooks/use-queries'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

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
  const [search, setSearch] = useState('')

  const { data, isLoading, error: queryError, refetch } = useProcedures(profile?.clinic_id)
  const procedures: Procedure[] = data?.procedures || []

  const filteredProcedures = procedures.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price || 0)
  }

  if (queryError) {
    return (
      <div className="p-4 lg:p-8 space-y-6">
        <PageHeader
          title="Procedimentos"
          description="Gerencie os procedimentos da clínica"
        />
        <ErrorState message="Falha ao carregar procedimentos" onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Procedimentos"
        description="Gerencie os procedimentos da clínica"
        action={
          <Button asChild className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600">
            <Link href="/dashboard/procedimentos/novo">
              <PlusIcon className="h-4 w-4 mr-2" />
              Novo Procedimento
            </Link>
          </Button>
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar procedimento..."
      />

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
        </div>
      ) : filteredProcedures.length === 0 ? (
        <EmptyState
          icon={<BeakerIcon className="h-8 w-8 text-teal-600 dark:text-teal-400" />}
          title={search ? 'Nenhum procedimento encontrado' : 'Nenhum procedimento cadastrado'}
          description={search ? 'Tente buscar com outros termos' : 'Comece cadastrando o primeiro procedimento da clínica'}
          action={!search ? {
            label: 'Cadastrar Procedimento',
            onClick: () => window.location.href = '/dashboard/procedimentos/novo',
          } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProcedures.map((procedure) => (
            <Link
              key={procedure.id}
              href={`/dashboard/procedimentos/${procedure.id}`}
              className="group"
            >
              <Card className="p-6 h-full transition-all hover:shadow-lg hover:border-teal-200 dark:hover:border-teal-800">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 flex items-center justify-center">
                    <BeakerIcon className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div
                    className={`h-2 w-2 rounded-full ${
                      procedure.is_active ? 'bg-teal-500' : 'bg-zinc-300'
                    }`}
                  />
                </div>
                <h3 className="font-semibold text-foreground mb-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {procedure.name}
                </h3>
                {procedure.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {procedure.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ClockIcon className="h-4 w-4" />
                    <span>{procedure.duration_minutes} min</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-teal-600 dark:text-teal-400">
                    <CurrencyDollarIcon className="h-4 w-4" />
                    <span>{formatPrice(procedure.price)}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
