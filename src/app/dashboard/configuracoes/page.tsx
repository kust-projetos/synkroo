'use client'

import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'

interface ClinicSettings {
  name: string
  phone: string
  email: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  opening_hours?: {
    [key: string]: { open: string; close: string; closed: boolean }
  }
  notification_settings?: {
    appointment_reminder_24h: boolean
    appointment_reminder_2h: boolean
    follow_up_enabled: boolean
    inactive_patient_days: number
  }
}

export default function ConfiguracoesPage() {
  const { profile } = useAuth()
  const [settings, setSettings] = useState<ClinicSettings>({
    name: '',
    phone: '',
    email: '',
    notification_settings: {
      appointment_reminder_24h: true,
      appointment_reminder_2h: true,
      follow_up_enabled: true,
      inactive_patient_days: 90,
    },
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (profile?.clinic_id) {
      fetchSettings()
    }
  }, [profile?.clinic_id, fetchSettings])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/clinics/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings || settings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/clinics/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' })
      } else {
        setMessage({ type: 'error', text: 'Erro ao salvar configurações' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h1>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Informações da Clínica */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações da Clínica</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input
                type="text"
                value={settings.city || ''}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Notificações */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notificações Automáticas</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.notification_settings?.appointment_reminder_24h}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notification_settings: {
                      ...settings.notification_settings!,
                      appointment_reminder_24h: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-gray-700">Lembrete de agendamento 24h antes</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.notification_settings?.appointment_reminder_2h}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notification_settings: {
                      ...settings.notification_settings!,
                      appointment_reminder_2h: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-gray-700">Lembrete de agendamento 2h antes</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.notification_settings?.follow_up_enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notification_settings: {
                      ...settings.notification_settings!,
                      follow_up_enabled: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-gray-700">Follow-up pós-consulta automático</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dias para identificar paciente inativo
              </label>
              <input
                type="number"
                value={settings.notification_settings?.inactive_patient_days || 90}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notification_settings: {
                      ...settings.notification_settings!,
                      inactive_patient_days: parseInt(e.target.value) || 90,
                    },
                  })
                }
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                min={30}
                max={365}
              />
            </div>
          </div>
        </div>

        {/* Integrações */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Integrações</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900">WhatsApp Business</h3>
                <p className="text-sm text-gray-500">Conecte seu número do WhatsApp</p>
              </div>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                Conectar
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900">Instagram</h3>
                <p className="text-sm text-gray-500">Conecte sua conta do Instagram</p>
              </div>
              <button className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors">
                Conectar
              </button>
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
    </div>
  )
}