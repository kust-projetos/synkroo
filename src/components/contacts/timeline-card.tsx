'use client'

import { CalendarIcon, ChatBubbleLeftIcon, BellIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/ui/badge'

export interface TimelineEvent {
  id: string
  source: 'appointment' | 'message' | 'lead_activity' | 'note'
  event_type: string
  description: string
  event_timestamp: string
  metadata: Record<string, unknown>
}

interface TimelineCardProps {
  event: TimelineEvent
}

const SOURCE_CONFIG = {
  appointment: { icon: CalendarIcon, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
  message: { icon: ChatBubbleLeftIcon, color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
  lead_activity: { icon: BellIcon, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
  note: { icon: DocumentTextIcon, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
} as const

const EVENT_TYPE_COLORS: Record<string, string> = {
  created: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  received: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  note: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} dias`
  return date.toLocaleDateString('pt-BR')
}

export function TimelineCard({ event }: TimelineCardProps) {
  const config = SOURCE_CONFIG[event.source as keyof typeof SOURCE_CONFIG] ?? SOURCE_CONFIG.note
  const Icon = config.icon
  const typeColor = EVENT_TYPE_COLORS[event.event_type] ?? EVENT_TYPE_COLORS.created

  return (
    <div className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-foreground truncate flex-1">{event.description}</p>
          <Badge variant="outline" className={`text-xs shrink-0 ${typeColor}`}>
            {event.event_type}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(event.event_timestamp)}</p>
      </div>
    </div>
  )
}
