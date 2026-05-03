'use client'

import { useState } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getScoreColor, getScoreLabel } from '@/lib/theme/score-thresholds'
import { LeadConvertDialog } from './lead-convert-dialog'

interface LeadCardProps {
  lead: {
    id: string
    name: string
    phone: string
    email?: string | null
    source: string
    temperature: 'cold' | 'warm' | 'hot'
    score: number
    interest?: string | null
    last_contact_at?: string | null
    deal_value?: number
  }
  index: number
  onConvert?: (leadId: string, patientData: { name: string; phone: string; email?: string }) => void
}

const temperatureColors: Record<string, string> = {
  cold: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  warm: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  hot: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const sourceLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  web: 'Web',
  referral: 'Indicacao',
  campaign: 'Campanha',
  manual: 'Manual',
  other: 'Outro',
}

export function LeadCard({ lead, index, onConvert }: LeadCardProps) {
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [isDraggingCard, setIsDraggingCard] = useState(false)

  const handleConvertClick = () => {
    setConvertDialogOpen(true)
  }

  const handleConvert = (leadId: string, patientData: { name: string; phone: string; email?: string }) => {
    onConvert?.(leadId, patientData)
    setConvertDialogOpen(false)
  }

  return (
    <>
      <Draggable draggableId={lead.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`bg-card border border-border rounded-lg p-3 mb-2 cursor-grab active:cursor-grabbing transition-shadow ${
              snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : 'hover:shadow-sm'
            }`}
            onMouseDown={() => setIsDraggingCard(true)}
            onMouseUp={() => setIsDraggingCard(false)}
          >
            {/* Name and temperature with kebab menu */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="font-medium text-sm truncate flex-1">{lead.name}</span>

              <div className="flex items-center gap-1">
                <Badge
                  className={`text-xs px-1.5 py-0.5 ${temperatureColors[lead.temperature] ?? ''}`}
                >
                  {getScoreLabel(lead.score)}
                </Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1 hover:bg-muted rounded text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleConvertClick}>
                      Converter para paciente
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Contact info */}
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>{lead.phone}</div>
              {lead.email && <div className="truncate">{lead.email}</div>}
            </div>

            {/* Last contact */}
            {lead.last_contact_at && (
              <div className="mt-2 text-xs text-muted-foreground">
                Ha {formatDistanceToNow(new Date(lead.last_contact_at), { addSuffix: false, locale: ptBR })}
              </div>
            )}

            {/* Interest */}
            {lead.interest && (
              <div className="mt-2 text-xs text-muted-foreground bg-muted rounded px-2 py-1 truncate">
                {lead.interest}
              </div>
            )}

            {/* Source and score bar */}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {sourceLabels[lead.source] ?? lead.source}
              </span>
              {/* Score bar from SCORE_THRESHOLDS */}
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${getScoreColor(lead.score)}`}
                  style={{ width: `${Math.min(lead.score, 100)}%` }}
                />
              </div>
            </div>

            {/* Deal value */}
            {(lead.deal_value ?? 0) > 0 && (
              <div className="text-sm font-medium text-teal-600 dark:text-teal-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.deal_value!)}
              </div>
            )}
          </div>
        )}
      </Draggable>

      {/* Convert dialog */}
      <LeadConvertDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        lead={{ id: lead.id, name: lead.name, phone: lead.phone }}
        onConvert={handleConvert}
      />
    </>
  )
}
