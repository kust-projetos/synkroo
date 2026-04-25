'use client'

import { Component, ReactNode } from 'react'
import { DragDropContext } from '@hello-pangea/dnd'
import { useKanbanBoard } from '@/hooks/use-kanban'
import { usePipelineStages, useKanbanLeads } from '@/lib/hooks/use-queries'
import { StageColumn } from './stage-column'
import { StageColumnSkeleton } from './stage-column'

interface KanbanBoardProps {
  clinicId: string
}

interface ErrorState {
  hasError: boolean
  message?: string
}

class KanbanErrorBoundary extends Component<{ children: ReactNode }, ErrorState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, message: error.message }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p className="mb-2">Erro ao carregar pipeline</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-primary hover:underline"
          >
            Recarregar pagina
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function KanbanBoard({ clinicId }: KanbanBoardProps) {
  const { onDragEnd } = useKanbanBoard()
  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages(clinicId)
  const { data: leads = [], isLoading: leadsLoading } = useKanbanLeads(clinicId)

  if (stagesLoading || leadsLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        <StageColumnSkeleton count={5} />
      </div>
    )
  }

  return (
    <KanbanErrorBoundary>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              leads={leads.filter((l: any) => l.stage_id === stage.id)}
            />
          ))}
        </div>
      </DragDropContext>
    </KanbanErrorBoundary>
  )
}
