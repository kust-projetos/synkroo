'use client'

import { CheckIcon, EyeIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/ui/badge'

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed'

interface MessageStatusBadgeProps {
  status: MessageStatus
}

const statusConfig: Record<MessageStatus, { icon: React.ReactNode; label: string; variant: 'outline' | 'destructive' | 'secondary' | 'default' }> = {
  sent: {
    icon: <CheckIcon className="w-3 h-3" />,
    label: 'Enviado',
    variant: 'outline',
  },
  delivered: {
    icon: <CheckIcon className="w-3 h-3" />,
    label: 'Entregue',
    variant: 'outline',
  },
  read: {
    icon: <EyeIcon className="w-3 h-3" />,
    label: 'Lido',
    variant: 'secondary',
  },
  failed: {
    icon: <XCircleIcon className="w-3 h-3" />,
    label: 'Falhou',
    variant: 'destructive',
  },
}

export function MessageStatusBadge({ status }: MessageStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      <span>{config.label}</span>
    </Badge>
  )
}
