'use client'

import { useState, useEffect } from 'react'

export interface NotificationPreferencesData {
  agenda: boolean
  pacientes: boolean
  lembretes: boolean
  campanhas: boolean
  financeiro: boolean
  sistema: boolean
}

const STORAGE_KEY = 'synkroo_notification_preferences'

const DEFAULT_PREFERENCES: NotificationPreferencesData = {
  agenda: true,
  pacientes: true,
  lembretes: false,
  campanhas: false,
  financeiro: false,
  sistema: true,
}

const categories = [
  {
    key: 'agenda' as const,
    label: 'Agenda',
    description: 'Agendamentos, cancelamentos, remarques',
    icon: '📅',
  },
  {
    key: 'pacientes' as const,
    label: 'Pacientes',
    description: 'Novos pacientes, reativações',
    icon: '👤',
  },
  {
    key: 'lembretes' as const,
    label: 'Lembretes',
    description: 'Lembretes enviados automaticamente',
    icon: '🔔',
  },
  {
    key: 'campanhas' as const,
    label: 'Campanhas',
    description: 'Ações de marketing e campanhas',
    icon: '📣',
  },
  {
    key: 'financeiro' as const,
    label: 'Financeiro',
    description: 'Orçamentos, pagamentos',
    icon: '💰',
  },
  {
    key: 'sistema' as const,
    label: 'Sistema',
    description: 'Erros do agente, alertas técnicos',
    icon: '⚠️',
  },
]

interface NotificationPreferencesProps {
  isOpen: boolean
  onClose: () => void
  preferences: NotificationPreferencesData
  onSave: (preferences: NotificationPreferencesData) => void
}

export function NotificationPreferences({
  isOpen,
  onClose,
  preferences,
  onSave,
}: NotificationPreferencesProps) {
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferencesData>(preferences)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setLocalPrefs(preferences)
    setHasChanges(false)
  }, [preferences, isOpen])

  const handleToggle = (key: keyof NotificationPreferencesData) => {
    setLocalPrefs(prev => ({ ...prev, [key]: !prev[key] }))
    setHasChanges(true)
  }

  const handleSave = () => {
    onSave(localPrefs)
    setHasChanges(false)
    onClose()
  }

  const handleReset = () => {
    setLocalPrefs(DEFAULT_PREFERENCES)
    setHasChanges(true)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Configurar Notificações</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Escolha quais notificações deseja receber
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          <div className="space-y-3">
            {categories.map(category => (
              <label
                key={category.key}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={localPrefs[category.key]}
                  onChange={() => handleToggle(category.key)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{category.icon}</span>
                    <span className="font-medium text-gray-900">{category.label}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{category.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Restaurar padrões
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${hasChanges
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook para gerenciar preferências
export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferencesData>(DEFAULT_PREFERENCES)
  const [isLoaded, setIsLoaded] = useState(false)

  // Carregar do localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setPreferences(JSON.parse(stored))
      } catch {
        setPreferences(DEFAULT_PREFERENCES)
      }
    }
    setIsLoaded(true)
  }, [])

  // Salvar no localStorage
  const savePreferences = (prefs: NotificationPreferencesData) => {
    setPreferences(prefs)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }

  return {
    preferences,
    isLoaded,
    savePreferences,
    DEFAULT_PREFERENCES,
  }
}
