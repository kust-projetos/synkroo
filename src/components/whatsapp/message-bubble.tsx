'use client'

import { cn } from '@/lib/utils'
import { MessageStatusBadge } from './message-status-badge'

export interface MessageBubbleProps {
  message: {
    direction: 'inbound' | 'outbound'
    content: string
    created_at: string
    metadata?: {
      delivery_status?: 'sent' | 'delivered' | 'read'
    }
  }
  showStatus?: boolean
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `${minutes}min`
  if (hours < 24) return `${hours}h`
  if (days === 1) return 'Ontem'
  if (days < 7) return `${days}d`
  return date.toLocaleDateString('pt-BR')
}

export function MessageBubble({ message, showStatus = false }: MessageBubbleProps) {
  const isInbound = message.direction === 'inbound'

  return (
    <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl',
          isInbound
            ? 'bg-card border border-border text-foreground'
            : 'bg-primary text-primary-foreground'
        )}
      >
        <p className="text-sm">{message.content}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span
            className={cn(
              'text-xs',
              isInbound ? 'text-muted-foreground' : 'text-primary-foreground/70'
            )}
          >
            {formatTime(message.created_at)}
          </span>
          {!isInbound && showStatus && message.metadata?.delivery_status && (
            <MessageStatusBadge status={message.metadata.delivery_status} />
          )}
        </div>
      </div>
    </div>
  )
}
