'use client'

import { Component, ReactNode, useState } from 'react'
import { Droppable } from '@hello-pangea/dnd'
import { LeadCard } from './lead-card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EllipsisHorizontalIcon, PencilIcon, TrashIcon, TagIcon, PlusIcon } from '@heroicons/react/24/outline'

interface StageColumnProps {
  stage: {
    id: string
    name: string
    color: string
    position: number
  }
  leads: any[]
  onRename?: (id: string, name: string) => void
  onDelete?: (id: string) => void
  onChangeColor?: (id: string, color: string) => void
  onAddStage?: (afterId: string) => void
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

export function StageColumn({ stage, leads, onRename, onDelete, onChangeColor, onAddStage }: StageColumnProps) {
  const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
  const [showColorPicker, setShowColorPicker] = useState(false)

  // Calculate total pipeline value for this stage
  const stageTotal = leads.reduce((sum: number, lead: any) => sum + (lead.deal_value || 0), 0)

  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-muted/40 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full cursor-pointer"
            style={{ backgroundColor: stage.color }}
            onClick={() => onChangeColor && onChangeColor(stage.id, stage.color)}
          />
          <h3 className="font-medium text-sm">{stage.name}</h3>
          {stageTotal > 0 && (
            <span className="text-sm font-medium text-muted-foreground ml-2">
              ({stageTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-muted-foreground/10 transition-colors">
                <EllipsisHorizontalIcon className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onAddStage?.(stage.id)} className="gap-2">
                <PlusIcon className="h-4 w-4" />
                Adicionar etapa depois
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const newName = prompt('Nome da etapa:', stage.name)
                if (newName && newName !== stage.name) onRename?.(stage.id, newName)
              }} className="gap-2">
                <PencilIcon className="h-4 w-4" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowColorPicker(!showColorPicker)} className="gap-2">
                <TagIcon className="h-4 w-4" />
                Alterar cor
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                if (confirm(`Excluir etapa "${stage.name}"? Os leads serão movidos para a primeira etapa.`)) {
                  onDelete?.(stage.id)
                }
              }} className="gap-2 text-red-500 focus:text-red-500">
                <TrashIcon className="h-4 w-4" />
                Excluir etapa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {showColorPicker && (
            <div className="absolute mt-48 ml-[-120px] z-50 bg-popover border rounded-lg shadow-lg p-2 flex gap-1">
              {colors.map(color => (
                <button
                  key={color}
                  className="w-5 h-5 rounded-full hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    onChangeColor?.(stage.id, color)
                    setShowColorPicker(false)
                  }}
                />
              ))}
            </div>
          )}
        </div>
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
