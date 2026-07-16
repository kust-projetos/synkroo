'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useContacts } from '@/lib/hooks/use-queries'
import { SearchInput } from '@/components/ui/search-input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

interface ContactListPanelProps {
  selectedId?: string | null
  selectedType?: 'patient' | 'lead' | null
}

/**
 * Task 6: painel de contatos em modo READ-ONLY no MVP CRM.
 * - Sem botão "Novo Contato" (criação via operacional.criarPaciente / comercial.capturarLead).
 * - Sem ContactCreateDialog / PlusIcon / Button de criação.
 * - Lista populada via useContacts → /api/contacts (não array literal).
 */
export function ContactListPanel({ selectedId, selectedType }: ContactListPanelProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'patient' | 'lead'>('all')

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (typeFilter !== 'all') params.type = typeFilter
    params.limit = '20'
    return params
  }, [search, typeFilter])

  const { data, isLoading } = useContacts(queryParams)
  const contacts = data?.data || []

  const handleSelect = (id: string, type: 'patient' | 'lead') => {
    router.replace(`/dashboard/contatos?contact=${id}&type=${type}`, { scroll: false })
  }

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b border-border space-y-3">
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="patient">Pacientes</TabsTrigger>
            <TabsTrigger value="lead">Leads</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, telefone ou email..."
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            title="Nenhum contato encontrado"
            description="Tente ajustar os filtros de busca"
          />
        ) : (
          <div className="divide-y divide-border">
            {contacts.map((contact: any) => (
              <button
                key={contact.id}
                onClick={() => handleSelect(contact.id, contact.type)}
                className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                  selectedId === contact.id ? 'bg-teal-50 dark:bg-teal-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{contact.name}</span>
                  <Badge variant={contact.type === 'patient' ? 'secondary' : 'outline'} className="text-xs">
                    {contact.type === 'patient' ? 'Paciente' : 'Lead'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">{contact.phone}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}