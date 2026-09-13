'use client'

import { useAuth } from '@/lib/auth/context'
import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useCalendarStore } from '@/components/calendar/store/calendar-store'
import {
  BellIcon,
  ChatBubbleLeftRightIcon,
  CameraIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
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

/** Business hours configuration card — persists via canonical endpoint, shows load error without defaults */
function BusinessHoursCard() {
  const startHour = useCalendarStore((s) => s.startHour)
  const endHour = useCalendarStore((s) => s.endHour)
  const setBusinessHours = useCalendarStore((s) => s.setBusinessHours)
  const [localStart, setLocalStart] = useState(startHour)
  const [localEnd, setLocalEnd] = useState(endHour)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Load from canonical endpoint — show error instead of defaults if fails
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetch('/api/clinics/settings')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        const opening = (data.settings?.settings as any)?.opening_hours as { startHour?: number; endHour?: number } | undefined
        const s = opening?.startHour ?? data.settings?.settings?.appointment_durations?.[0] ?? startHour
        const e = opening?.endHour ?? endHour
        // Only sync if we got valid data, otherwise keep store defaults but show error
        if (typeof s === 'number' && typeof e === 'number') {
          setLocalStart(s)
          setLocalEnd(e)
          setBusinessHours(s, e)
        }
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err.message || 'Falha ao carregar horários')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, []) // only on mount, not on store changes

  // Keep local in sync with store when store changes externally
  useEffect(() => {
    if (!loading && !loadError) {
      setLocalStart(startHour)
      setLocalEnd(endHour)
    }
  }, [startHour, endHour, loading, loadError])

  const handleApply = async () => {
    if (localStart >= localEnd) return
    setSaving(true)
    setSaveMessage(null)
    try {
      // Persist via canonical endpoint — merge server-side preserves whatsapp_phone_number_id
      const res = await fetch('/api/clinics/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { opening_hours: { startHour: localStart, endHour: localEnd } } }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setBusinessHours(localStart, localEnd)
      setSaveMessage('Horário salvo com sucesso!')
    } catch (err: any) {
      setSaveMessage(err.message || 'Erro ao salvar horário')
    } finally {
      setSaving(false)
    }
  }

  const formatHour = (h: number) => `${h.toString().padStart(2, '0')}:00`

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-muted-foreground" />
          <CardTitle>Horário de Funcionamento</CardTitle>
        </div>
        <CardDescription>
          Defina o horário de funcionamento da clínica. O calendário se ajustará automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando horários...</p>
        ) : loadError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400" role="alert">
            Erro ao carregar horários: {loadError}. Tente recarregar a página.
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-hour">Abertura</Label>
                <select
                  id="start-hour"
                  value={localStart}
                  onChange={(e) => setLocalStart(parseInt(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
              </div>
              <span className="text-muted-foreground text-sm pt-6 hidden sm:block">até</span>
              <div className="space-y-2">
                <Label htmlFor="end-hour">Fechamento</Label>
                <select
                  id="end-hour"
                  value={localEnd}
                  onChange={(e) => setLocalEnd(parseInt(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleApply}
                disabled={localStart >= localEnd || saving}
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 min-w-[100px]"
              >
                {saving ? 'Salvando...' : 'Aplicar'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Atual: <span className="font-medium text-foreground">{formatHour(startHour)}</span> — <span className="font-medium text-foreground">{formatHour(endHour)}</span> ({endHour - startHour}h de expediente)
            </p>
            {localStart >= localEnd && (
              <p className="text-sm text-red-600 dark:text-red-400">
                O horário de abertura deve ser anterior ao de fechamento.
              </p>
            )}
            {saveMessage && (
              <p className="text-sm text-teal-700 dark:text-teal-400" role="status" aria-live="polite">
                {saveMessage}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function ConfiguracoesPage() {
  const { profile } = useAuth()
  // T7 3.2: WhatsApp QR modal — fluxo real via /api/whatsapp/qrcode (canônico), sem toast/navegação sintéticos
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [qrState, setQrState] = useState<{ loading: boolean; qrcode: string | null; connected: boolean; error: string | null }>({
    loading: false,
    qrcode: null,
    connected: false,
    error: null,
  })

  const fetchWhatsAppQr = useCallback(async () => {
    setQrState({ loading: true, qrcode: null, connected: false, error: null })
    try {
      const res = await fetch('/api/whatsapp/qrcode')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = json?.error?.message || json?.error || `HTTP ${res.status}`
        throw new Error(typeof msg === 'string' ? msg : 'Falha ao obter QR code')
      }
      const payload = (json?.data ?? json) as { qrcode?: string | null; qrcode_available?: boolean; connected?: boolean }
      if (payload.connected) {
        setQrState({ loading: false, qrcode: null, connected: true, error: null })
      } else if (payload.qrcode) {
        setQrState({ loading: false, qrcode: payload.qrcode, connected: false, error: null })
      } else if (payload.qrcode_available === false && !payload.qrcode) {
        setQrState({ loading: false, qrcode: null, connected: false, error: 'QR code não disponível. Verifique se o provedor WhatsApp está configurado no servidor.' })
      } else {
        setQrState({ loading: false, qrcode: null, connected: false, error: 'QR code indisponível no momento. Tente novamente.' })
      }
    } catch (err: any) {
      setQrState({ loading: false, qrcode: null, connected: false, error: err.message || 'Erro ao carregar QR code' })
    }
  }, [])

  useEffect(() => {
    if (whatsappOpen) fetchWhatsAppQr()
  }, [whatsappOpen, fetchWhatsAppQr])
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  const fetchSettings = async () => {
    setIsLoadingSettings(true)
    setLoadError(null)
    try {
      const response = await fetch('/api/clinics/settings')
      if (response.ok) {
        const data = await response.json()
        // Only set settings if we got valid data - don't render defaults as confirmed
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }))
        }
      } else {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${response.status}`)
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error)
      setLoadError(error.message || 'Falha ao carregar configurações')
    } finally {
      setIsLoadingSettings(false)
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

      {isLoadingSettings && (
        <div className="p-4 rounded-lg border bg-muted text-sm text-muted-foreground">Carregando configurações...</div>
      )}
      {loadError && !isLoadingSettings && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400" role="alert">
          <XCircleIcon className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Erro ao carregar configurações: {loadError}. Tente recarregar.</span>
          <Button variant="outline" size="sm" onClick={fetchSettings} className="ml-auto">
            Tentar novamente
          </Button>
        </div>
      )}

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

      {/* Horário de Funcionamento */}
      <BusinessHoursCard />

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

      {/* Integrações — T7 3.2: CTAs sintéticos removidos; WhatsApp com fluxo real via /api/whatsapp/qrcode */}
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
                  <p className="text-sm text-muted-foreground">Escaneie o QR code para conectar</p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setWhatsappOpen(true)}
                data-testid="whatsapp-connect"
              >
                Ver QR code
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <CameraIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Instagram</h3>
                  <p className="text-sm text-muted-foreground">Disponível via Meta Business Suite</p>
                </div>
              </div>
              <Button size="sm" disabled variant="outline" data-testid="instagram-connect-disabled">
                Em breve
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>Escaneie o QR code com seu WhatsApp para parear a clínica</DialogDescription>
          </DialogHeader>
          <div className="py-4 min-h-[280px] flex flex-col items-center justify-center">
            {qrState.loading ? (
              <div className="flex flex-col items-center gap-3" data-testid="qr-loading">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                <p className="text-sm text-muted-foreground">Carregando QR code...</p>
              </div>
            ) : qrState.connected ? (
              <div className="flex flex-col items-center gap-3 text-center" data-testid="qr-connected">
                <CheckCircleIcon className="h-12 w-12 text-green-600" />
                <p className="text-sm font-medium text-foreground">WhatsApp já conectado</p>
                <p className="text-xs text-muted-foreground">A instância Evolution / sidecar está ativa para esta clínica.</p>
              </div>
            ) : qrState.qrcode ? (
              <div className="flex flex-col items-center gap-3" data-testid="qr-display">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrState.qrcode} alt="QR code WhatsApp" className="h-64 w-64 rounded-lg border bg-white p-2 object-contain" />
                <p className="text-xs text-muted-foreground text-center">Abra o WhatsApp → Aparelhos conectados → Conectar aparelho e escaneie</p>
                <p className="text-xs text-muted-foreground">QR expira em poucos minutos. Atualize se necessário.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center max-w-xs" data-testid="qr-error">
                <XCircleIcon className="h-10 w-10 text-amber-500" />
                <p className="text-sm text-muted-foreground">{qrState.error || 'QR code indisponível.'}</p>
                <p className="text-xs text-muted-foreground">Verifique as variáveis EVOLUTION_API_URL / WHATSAPP_FALLBACK_URL no servidor.</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setWhatsappOpen(false)}>Fechar</Button>
            {!qrState.connected && (
              <Button onClick={fetchWhatsAppQr} disabled={qrState.loading} className="bg-green-600 hover:bg-green-700" data-testid="qr-refresh">
                Atualizar QR
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
