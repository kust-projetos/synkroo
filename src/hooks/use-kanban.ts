'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { DropResult } from '@hello-pangea/dnd'

interface UseKanbanBoardOptions {
  onError?: (error: Error, conflict?: boolean) => void
}

/**
 * Kanban board hook with drag-drop and optimistic locking conflict resolution
 *
 * onDragEnd implementation (MEDIUM-1 - concurrent modification handling):
 * 1. Extract destination.droppableId and draggableId
 * 2. Extract current version/timestamp from lead being dragged
 * 3. Apply optimistic update to kanban-leads query cache
 * 4. Call PATCH /api/leads/${leadId}/stage with { stage_id: newStageId, version: leadVersion }
 * 5. On 409 Conflict (concurrent modification):
 *    - Invalidate queries to force refetch
 *    - Call onError with message "Lead was modified by another user. Please refresh."
 * 6. On other errors: invalidate queries and call onError callback
 */
export function useKanbanBoard(options: UseKanbanBoardOptions = {}) {
  const queryClient = useQueryClient()

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result
      if (!destination) return
      if (destination.droppableId === source.droppableId && destination.index === source.index) return

      const newStageId = destination.droppableId
      const leadId = draggableId

      // Get lead version from query cache for optimistic locking
      const leadsQueryData = queryClient.getQueryData(['kanban-leads'])
      let leadVersion: string | undefined

      if (leadsQueryData && Array.isArray(leadsQueryData)) {
        const lead = (leadsQueryData as any[]).find((l: any) => l.id === leadId)
        if (lead?.updated_at) {
          leadVersion = lead.updated_at
        }
      }

      // Optimistic update - move lead to new stage in cache
      queryClient.setQueriesData({ queryKey: ['kanban-leads'] }, (old: any) => {
        if (!old) return old
        if (Array.isArray(old)) {
          return old.map((lead: any) =>
            lead.id === leadId ? { ...lead, stage_id: newStageId } : lead
          )
        }
        return old
      })

      // Server update via PATCH /api/leads/[id]/stage with version for conflict detection
      try {
        const res = await fetch(`/api/leads/${leadId}/stage`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage_id: newStageId,
            version: leadVersion,
          }),
        })

        // Handle 409 Conflict - concurrent modification detected
        if (res.status === 409) {
          // Invalidate queries to force refetch with fresh data
          queryClient.invalidateQueries({ queryKey: ['kanban-leads'] })
          options.onError?.(new Error('Lead was modified by another user. Please refresh.'), true)
          return
        }

        if (!res.ok) {
          throw new Error(`Failed to update lead stage: ${res.status}`)
        }

        // Success - invalidate to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ['kanban-leads'] })
      } catch (error) {
        // On error, invalidate queries and call error callback
        queryClient.invalidateQueries({ queryKey: ['kanban-leads'] })
        options.onError?.(error as Error, false)
      }
    },
    [queryClient, options]
  )

  return { onDragEnd }
}
