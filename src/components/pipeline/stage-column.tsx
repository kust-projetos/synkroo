'use client'

import { Component, ReactNode } from 'react'
import { Droppable } from '@hello-pangea/dnd'
import { LeadCard } from './lead-card'

interface StageColumnProps {
  stage: {
    id: string
    name: string
    color: string
    position: number
  }
  leads: any[]
}

interface ColumnErrorState {
  hasError: boolean
}

class StageColumnErrorBoundary extends Component<{ children: ReactNode }, ColumnErrorState> {
  constructor(props: Record<string, unknown>) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_error: Error): ColumnErrorState {
    return { hasError: true }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex-1 p-2 flex items-center justify-center">
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function StageColumn({ stage, leads }: StageColumnProps) {
  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-muted/40 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-medium text-sm">{stage.name}</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      {/* Droppable area with error boundary */}
      <StageColumnErrorBoundary>
        <Droppable droppableId={stage.id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex-1 p-2 min-h-[200px] transition-colors ${
                snapshot.isDraggingOver ? 'bg-muted/80' : ''
              }`}
            >
              {leads.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Nenhum lead
                </div>
              ) : (
                leads.map((lead, index) => (
                  <LeadCard key={lead.id} lead={lead} index={index} />
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </StageColumnErrorBoundary>
    </div>
  )
}

interface StageColumnSkeletonProps {
  count?: number
}

export function StageColumnSkeleton({ count = 4 }: StageColumnSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-72 flex-shrink-0 bg-muted rounded-lg animate-pulse h-96" />
      ))}
    </>
  )
}
