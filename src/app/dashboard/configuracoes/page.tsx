'use client'

import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  BellIcon,
  ChatBubbleLeftRightIcon,
  CameraIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

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
  appointment_durations?: number[]
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
    appointment_durations: [15, 30, 45, 60, 90, 120],
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  useEffect(() => {
    if (profile?.clinic_id) {
      fetchSettings()
    }
  }, [profile?.clinic_id])

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

  const updateNotificationSetting = (key: string, value: boolean | number) => {
    setSettings({
      ...settings,
      notification_settings: {
        ...settings.notification_settings!,
        [key]: value,
      },
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-8">
      <PageHeader
        title="Configurações"
        description="Gerencie as configurações da sua clínica"
      />

      {/* Success/Error Message */}
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
              : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
          ) : (
            <XCircleIcon className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Informações da Clínica */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BuildingOfficeIcon className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Informações da Clínica</CardTitle>
          </div>
          <CardDescription>Dados básicos da sua clínica</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                placeholder="Nome da clínica"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={settings.city || ''}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                placeholder="São Paulo"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Notificações Automáticas</CardTitle>
          </div>
          <CardDescription>Configure lembretes e follow-ups automáticos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reminder-24h">Lembrete 24h antes</Label>
              <p className="text-sm text-muted-foreground">
                Enviar lembrete de agendamento um dia antes
              </p>
            </div>
            <Switch
              id="reminder-24h"
              checked={settings.notification_settings?.appointment_reminder_24h}
              onCheckedChange={(checked) => updateNotificationSetting('appointment_reminder_24h', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reminder-2h">Lembrete 2h antes</Label>
              <p className="text-sm text-muted-foreground">
                Enviar lembrete de agendamento duas horas antes
              </p>
            </div>
            <Switch
              id="reminder-2h"
              checked={settings.notification_settings?.appointment_reminder_2h}
              onCheckedChange={(checked) => updateNotificationSetting('appointment_reminder_2h', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="follow-up">Follow-up pós-consulta</Label>
              <p className="text-sm text-muted-foreground">
                Enviar mensagem automática após a consulta
              </p>
            </div>
            <Switch
              id="follow-up"
              checked={settings.notification_settings?.follow_up_enabled}
              onCheckedChange={(checked) => updateNotificationSetting('follow_up_enabled', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inactive-days">Dias para paciente inativo</Label>
            <Input
              id="inactive-days"
              type="number"
              value={settings.notification_settings?.inactive_patient_days || 90}
              onChange={(e) =>
                updateNotificationSetting('inactive_patient_days', parseInt(e.target.value) || 90)
              }
              min={30}
              max={365}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Pacientes sem agendamento há mais de este período serão considerados inativos
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Durações de Appointment */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Durações de Consulta</CardTitle>
          </div>
          <CardDescription>Personalize as opções de duração de consulta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Defina quais durações estarão disponíveis ao criar agendamentos. Cada valor representa minutos.
          </p>
          <div className="flex flex-wrap gap-2">
            {[10, 15, 20, 30, 40, 45, 50, 60, 75, 90, 120].map((mins) => {
              const isSelected = settings.appointment_durations?.includes(mins)
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    const current = settings.appointment_durations || [15, 30, 45, 60, 90, 120]
                    if (isSelected) {
                      if (current.length > 1) {
                        setSettings({ ...settings, appointment_durations: current.filter((d) => d !== mins) })
                      }
                    } else {
                      setSettings({ ...settings, appointment_durations: [...current, mins].sort((a, b) => a - b) })
                    }
                  }}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-background text-muted-foreground border-muted hover:border-teal-400'
                  }`}
                >
                  {mins < 60 ? `${mins} min` : mins === 60 ? '1 hora' : mins === 120 ? '2 horas' : `${mins} min`}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Selecione pelo menos 1 duração. Máximo: 10 opções.
          </p>
        </CardContent>
      </Card>

      {/* Integrações */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Integrações</CardTitle>
          </div>
          <CardDescription>Conecte sua clínica com plataformas de mensagem</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">WhatsApp Business</h3>
                  <p className="text-sm text-muted-foreground">Conecte seu número do WhatsApp</p>
                </div>
              </div>
              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                Conectar
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <CameraIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Instagram</h3>
                  <p className="text-sm text-muted-foreground">Conecte sua conta do Instagram</p>
                </div>
              </div>
              <Button size="sm" className="bg-pink-600 hover:bg-pink-700">
                Conectar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 shadow-md shadow-teal-600/20 min-w-[160px]"
        >
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  )
}
