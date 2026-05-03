'use client'

import { useEffect, useRef, useState } from 'react'
import { useAllActivities } from '@/lib/hooks/use-queries'
import { TimelineCard, type TimelineEvent } from '@/components/contacts/timeline-card'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface AllActivityEvent {
  id: string
  source: 'appointment' | 'message' | 'lead_activity' | 'note'
  event_type: string
  description: string
  event_timestamp: string
  metadata: Record<string, unknown>
  contact_id: string
  contact_type: 'patient' | 'lead'
  contact_name?: string
}

interface ActivityPage {
  events: AllActivityEvent[]
  next_cursor: string | null
}

const SOURCE_OPTIONS = [
  { label: 'Todos os tipos', value: '' },
  { label: 'Agendamentos', value: 'appointment' },
  { label: 'WhatsApp', value: 'message' },
  { label: 'Atividades', value: 'lead_activity' },
  { label: 'Notas', value: 'note' },
] as const

export default function AtividadesPage() {
  const [sourceFilter, setSourceFilter] = useState('')
  const [contactFilter, setContactFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, isError, refetch } =
    useAllActivities({
      sourceFilter: sourceFilter || undefined,
      contactId: contactFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleFilterChange = () => {
    refetch()
  }

  const clearFilters = () => {
    setSourceFilter('')
    setContactFilter('')
    setStartDate('')
    setEndDate('')
  }

  const hasActiveFilters = sourceFilter || contactFilter || startDate || endDate

  if (isError) {
    return (
      <div className="p-4 lg:p-8 space-y-6">
        <PageHeader
          title="Atividades"
          description="Visualize todas as atividades do seu CRM"
        />
        <Card className="p-12">
          <EmptyState
            title="Erro ao carregar atividades"
            description="Ocorreu um erro ao buscar as atividades. Tente novamente."
          />
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
            Tentar novamente
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Atividades"
        description="Visualize todas as atividades do seu CRM"
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {SOURCE_OPTIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant={sourceFilter === opt.value ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-muted transition-colors"
                onClick={() => {
                  setSourceFilter(opt.value)
                  setTimeout(handleFilterChange, 0)
                }}
              >
                {opt.label}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-full sm:w-48">
              <Select value={contactFilter} onValueChange={(v) => { setContactFilter(v); setTimeout(handleFilterChange, 0) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por lead/contato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os contatos</SelectItem>
                  {/* Contact options would be loaded from API if needed */}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 items-center">
              <Input
                type="date"
                placeholder="Data inicial"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setTimeout(handleFilterChange, 0) }}
                className="w-36"
              />
              <span className="text-muted-foreground text-sm">ate</span>
              <Input
                type="date"
                placeholder="Data final"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setTimeout(handleFilterChange, 0) }}
                className="w-36"
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Timeline */}
      <Card className="p-0">
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-2">
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : !data || (data.pages as ActivityPage[]).every((p) => p.events.length === 0) ? (
              <div className="p-8">
                <EmptyState
                  title="Nenhuma atividade encontrada"
                  description={hasActiveFilters
                    ? "Nenhuma atividade corresponde aos filtros selecionados."
                    : "As atividades dos seus leads e contatos aparecerão aqui."}
                />
              </div>
            ) : (
              (data.pages as ActivityPage[]).map((page) =>
                page.events.map((event: AllActivityEvent) => (
                  <div key={event.id} className="relative">
                    <TimelineCard event={event} />
                    {event.contact_name && (
                      <p className="text-xs text-muted-foreground px-3 pb-2 -mt-1">
                        {event.contact_type === 'lead' ? 'Lead: ' : 'Paciente: '}
                        <span className="font-medium text-foreground">{event.contact_name}</span>
                      </p>
                    )}
                  </div>
                ))
              )
            )}

            <div ref={sentinelRef} className="h-1" />

            {isFetchingNextPage && (
              <div className="flex justify-center py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              </div>
            )}

            {!hasNextPage && data && (data.pages as ActivityPage[]).some((p) => p.events.length > 0) && (
              <p className="text-center text-xs text-muted-foreground py-4">
                Fim das atividades
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}