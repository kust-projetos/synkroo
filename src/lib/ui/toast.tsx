'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])

    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const getToastStyles = (type: ToastType) => {
    const styles: Record<ToastType, string> = {
      success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-400',
      error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-400',
      warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400',
      info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400',
    }
    return styles[type]
  }

  const getIcon = (type: ToastType) => {
    const icons: Record<ToastType, ReactNode> = {
      success: <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />,
      error: <XCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />,
      warning: <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      info: <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
    }
    return icons[type]
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container — aria-live region (T9 a11y): anúncios de sucesso são polite/status, erros são assertive/alert */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        role="region"
        aria-label="Notificações"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const isAssertive = toast.type === 'error' || toast.type === 'warning'
          return (
            <div
              key={toast.id}
              role={isAssertive ? 'alert' : 'status'}
              aria-live={isAssertive ? 'assertive' : 'polite'}
              aria-atomic="true"
              className={cn(
                "pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-right-5",
                getToastStyles(toast.type)
              )}
            >
              <div className="flex-shrink-0 mt-0.5" aria-hidden="true">
                {getIcon(toast.type)}
              </div>
              <p className="text-sm font-medium flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label={`Fechar notificação: ${toast.message}`}
                className="flex-shrink-0 text-current/60 hover:text-current transition-colors rounded p-0.5 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-1"
              >
                <XMarkIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
