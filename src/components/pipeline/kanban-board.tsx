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

interface StageOperations {
  onRenameStage: (id: string, name: string) => void
  onDeleteStage: (id: string) => void
  onChangeStageColor: (id: string, color: string) => void
  onAddStage: (afterId: string) => void
  refetchStages: () => void
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

export function KanbanBoard({ clinicId, operations }: KanbanBoardProps & { operations?: StageOperations }) {
  // G1: scoped kanban cache — drag-drop writes go to this clinic's key only.
  const { onDragEnd } = useKanbanBoard({ clinicId })
  const { data: stagesData, isLoading: stagesLoading, refetch: refetchStages } = usePipelineStages(clinicId)
  const { data: leadsData, isLoading: leadsLoading } = useKanbanLeads(clinicId)

  const stages = (stagesData ?? []) as Array<{ id: string; name: string; color: string; position: number }>
  const leads = (leadsData ?? []) as Array<{ id: string; stage_id: string; deal_value?: number | null }>

  const ops: Partial<StageOperations> = operations ?? {}

  const handleRename = async (id: string, name: string) => {
    await fetch(`/api/pipeline/stages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    ops.onRenameStage?.(id, name)
    refetchStages()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/pipeline/stages/${id}`, { method: 'DELETE' })
    ops.onDeleteStage?.(id)
    refetchStages()
  }

  const handleChangeColor = async (id: string, color: string) => {
    await fetch(`/api/pipeline/stages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    })
    ops.onChangeStageColor?.(id, color)
    refetchStages()
  }

  const handleAddStage = async (afterId: string) => {
    const afterStage = stages.find((s: { id: string }) => s.id === afterId)
    const newPosition = (afterStage?.position ?? 0) + 1
    const response = await fetch('/api/pipeline/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nova Etapa', position: newPosition, color: '#10B981' }),
    })
    if (response.ok) {
      refetchStages()
    }
  }

  if (stagesLoading || leadsLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        <StageColumnSkeleton count={5} />
      </div>
    )
  }

  if (stages.length === 0) {
    return (
      <div data-testid="pipeline-empty" className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Nenhuma etapa de pipeline configurada.
      </div>
    )
  }

  return (
    <KanbanErrorBoundary>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
          {stages.map((stage: { id: string; name: string; color: string; position: number }) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              leads={leads.filter((l: { id: string; stage_id: string; deal_value?: number | null }) => l.stage_id === stage.id)}
              onRename={handleRename}
              onDelete={handleDelete}
              onChangeColor={handleChangeColor}
              onAddStage={handleAddStage}
            />
          ))}
        </div>
      </DragDropContext>
    </KanbanErrorBoundary>
  )
}
