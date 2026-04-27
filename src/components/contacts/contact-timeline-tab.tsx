'use client'

import { useEffect, useRef, useState } from 'react'
import { useContactTimeline } from '@/lib/hooks/use-queries'
import { TimelineCard, type TimelineEvent } from './timeline-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

interface ContactTimelineTabProps {
  contactId: string
  contactType: 'patient' | 'lead'
}

interface TimelinePage {
  events: TimelineEvent[]
  next_cursor: string | null
}

const FILTER_OPTIONS = [
  { label: 'Todos', value: '' },
  { label: 'Agendamentos', value: 'appointment' },
  { label: 'WhatsApp', value: 'message' },
  { label: 'Atividades', value: 'lead_activity' },
  { label: 'Notas', value: 'note' },
] as const

export function ContactTimelineTab({ contactId, contactType }: ContactTimelineTabProps) {
  const [sourceFilter, setSourceFilter] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, isError } =
    useContactTimeline(contactId, contactType, sourceFilter || undefined)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <p className="text-sm text-muted-foreground">Erro ao carregar timeline</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-3 border-b border-border flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <Badge
            key={opt.value}
            variant={sourceFilter === opt.value ? 'default' : 'outline'}
            className="cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setSourceFilter(opt.value)}
          >
            {opt.label}
          </Badge>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : !data || (data.pages as TimelinePage[]).every((p) => p.events.length === 0) ? (
          <EmptyState
            title="Nenhuma atividade registrada"
            description="As atividades deste contato aparecerão aqui"
          />
        ) : (
          (data.pages as TimelinePage[]).map((page) =>
            page.events.map((event: TimelineEvent) => (
              <TimelineCard key={event.id} event={event} />
            ))
          )
        )}

        <div ref={sentinelRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600" />
          </div>
        )}
      </div>
    </div>
  )
}
