'use client'

import { useEffect, useState } from 'react'

export interface Notification {
  id: string
  type: 'agenda' | 'paciente' | 'lembrete' | 'campanha' | 'financeiro' | 'sistema'
  title: string
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

interface NotificationCardProps {
  notification: Notification
  onDismiss: () => void
  onAction?: (action: 'view' | 'cancel', notification: Notification) => void
  autoDismissMs?: number
}

type NotificationType = 'agenda' | 'paciente' | 'lembrete' | 'campanha' | 'financeiro' | 'sistema'
type ColorType = 'blue' | 'green' | 'yellow' | 'purple' | 'red'
type ActionType = 'view' | 'cancel'

interface TypeConfig {
  icon: string
  color: ColorType
  defaultActions: ActionType[]
}

const typeConfig: Record<NotificationType, TypeConfig> = {
  agenda: {
    icon: '📅',
    color: 'blue',
    defaultActions: ['view', 'cancel'],
  },
  paciente: {
    icon: '👤',
    color: 'green',
    defaultActions: ['view'],
  },
  lembrete: {
    icon: '🔔',
    color: 'yellow',
    defaultActions: ['view'],
  },
  campanha: {
    icon: '📣',
    color: 'purple',
    defaultActions: ['view'],
  },
  financeiro: {
    icon: '💰',
    color: 'green',
    defaultActions: ['view'],
  },
  sistema: {
    icon: '⚠️',
    color: 'red',
    defaultActions: ['view'],
  },
}

const colorClasses = {
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
  green: 'bg-green-50 border-green-200 text-green-800',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  purple: 'bg-purple-50 border-purple-200 text-purple-800',
  red: 'bg-red-50 border-red-200 text-red-800',
}

const iconColorClasses = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  purple: 'bg-purple-100 text-purple-600',
  red: 'bg-red-100 text-red-600',
}

export function NotificationCard({
  notification,
  onDismiss,
  onAction,
  autoDismissMs = 30000,
}: NotificationCardProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

  const config = typeConfig[notification.type]
  const color = colorClasses[config.color]
  const iconBg = iconColorClasses[config.color]

  // Auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss()
    }, autoDismissMs)

    return () => clearTimeout(timer)
  }, [autoDismissMs])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsVisible(false)
      onDismiss()
    }, 300)
  }

  const handleAction = (action: 'view' | 'cancel') => {
    if (onAction) {
      onAction(action, notification)
    }
    handleDismiss()
  }

  if (!isVisible) return null

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div
      className={`
        fixed bottom-20 right-4 z-50 w-80 bg-white rounded-xl shadow-2xl border overflow-hidden
        transition-all duration-300
        ${isExiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
        ${color}
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-inherit/20">
        <div className="flex items-center gap-2">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${iconBg}`}>
            {config.icon}
          </span>
          <span className="font-semibold text-sm uppercase tracking-wide">
            {notification.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-70">{formatTime(notification.timestamp)}</span>
          <button
            onClick={handleDismiss}
            className="w-6 h-6 rounded-full hover:bg-black/10 flex items-center justify-center text-sm opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <p className="font-medium text-sm text-gray-900 mb-1">{notification.title}</p>
        <p className="text-sm opacity-80">{notification.message}</p>
      </div>

      {/* Actions */}
      {config.defaultActions.length > 0 && (
        <div className="flex gap-2 px-4 py-3 border-t border-inherit/20 bg-white/50">
          {config.defaultActions.includes('view') && (
            <button
              onClick={() => handleAction('view')}
              className="flex-1 px-3 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Ver paciente
            </button>
          )}
          {config.defaultActions.includes('cancel') && (
            <button
              onClick={() => handleAction('cancel')}
              className="flex-1 px-3 py-2 text-sm font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
