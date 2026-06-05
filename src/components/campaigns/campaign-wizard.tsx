'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type CampaignType = 'reactivation' | 'follow_up' | 'birthday' | 'promotional'

interface CampaignWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (campaignData: unknown) => void
}

const CAMPAIGN_TYPES = [
  {
    value: 'reactivation' as CampaignType,
    label: 'Reativacao',
    description: 'Pacientes inativos ha 30+ dias',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    value: 'follow_up' as CampaignType,
    label: 'Follow-up',
    description: 'Pacientes com procedimento recente',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l-1-1m0 0l1 1m-1-1v4m0 0l1-1m-1 1l-1-1" />
      </svg>
    ),
  },
  {
    value: 'birthday' as CampaignType,
    label: 'Aniversario',
    description: 'Aniversariantes desta semana',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3 0v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7h16z" />
      </svg>
    ),
  },
  {
    value: 'promotional' as CampaignType,
    label: 'Promocional',
    description: 'Segmento personalizado',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
]

const STEPS = [
  { id: 1, label: 'Tipo' },
  { id: 2, label: 'Audiencia' },
  { id: 3, label: 'Mensagem' },
  { id: 4, label: 'Agendamento' },
  { id: 5, label: 'Confirmar' },
]

interface AudiencePreviewData {
  count: number
  patients: Array<{ id: string; name: string; phone: string }>
}

export function CampaignWizard({ open, onOpenChange, onComplete }: CampaignWizardProps) {
  const { profile } = useAuth()
  const toast = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreviewData | null>(null)
  const [audienceLoading, setAudienceLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    campaignType: 'reactivation' as CampaignType,
    messageTemplate: `Olá, {{patient_name}}! 👋

Sentimos sua falta! Já faz um tempo desde sua última visita.

Que tal agendar uma consulta de retorno? Sua saúde bucal agradece! 🦷

📅 Responda essa mensagem que eu te ajudo a agendar.`,
    scheduledAt: '',
    startImmediately: true,
  })

  const clinicId = profile?.clinic_id

  const fetchAudiencePreview = async (campaignType: CampaignType) => {
    if (!clinicId) return

    setAudienceLoading(true)
    try {
      const response = await fetch(`/api/campaigns/segments/preview?type=${campaignType}`)
      if (response.ok) {
        const data = await response.json()
        setAudiencePreview(data)
      }
    } catch (error) {
      console.error('Error fetching audience preview:', error)
    } finally {
      setAudienceLoading(false)
    }
  }

  const handleTypeSelect = (type: CampaignType) => {
    setFormData((prev) => ({ ...prev, campaignType: type }))
    fetchAudiencePreview(type)
  }

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    if (!clinicId) {
      toast.showToast('Clínica não encontrada', 'error')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinicId,
          name: formData.name,
          campaign_type: formData.campaignType,
          target_segment: formData.campaignType,
          message_template: formData.messageTemplate,
          channel: 'whatsapp',
          scheduled_at: formData.startImmediately ? null : formData.scheduledAt || null,
          auto_start: formData.startImmediately,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.showToast('Campanha criada com sucesso!', 'success')
        onOpenChange(false)
        onComplete?.(data)
        setCurrentStep(1)
        setFormData({
          name: '',
          campaignType: 'reactivation',
          messageTemplate: CAMPAIGN_TYPES[0].description,
          scheduledAt: '',
          startImmediately: true,
        })
      } else {
        toast.showToast(data.error || 'Erro ao criar campanha', 'error')
      }
    } catch (error) {
      toast.showToast('Erro de conexão. Tente novamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="flex justify-center gap-2 mb-6">
      {STEPS.map((step) => (
        <div
          key={step.id}
          className={cn(
            'flex items-center gap-2',
            step.id < currentStep && 'text-muted-foreground'
          )}
        >
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
              step.id === currentStep
                ? 'bg-primary text-primary-foreground'
                : step.id < currentStep
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {step.id < currentStep ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              step.id
            )}
          </div>
          <span className="text-xs hidden sm:block">{step.label}</span>
          {step.id < STEPS.length && (
            <div className="w-4 h-px bg-border" />
          )}
        </div>
      ))}
    </div>
  )

  const renderStep1TypeSelection = () => (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-xl">Selecione o tipo de campanha</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CAMPAIGN_TYPES.map((type) => (
          <Card
            key={type.value}
            className={cn(
              'cursor-pointer transition-all hover:border-primary/50',
              formData.campaignType === type.value && 'border-primary bg-primary/5'
            )}
            onClick={() => handleTypeSelect(type.value)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  formData.campaignType === type.value
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {type.icon}
                </div>
                <div>
                  <p className="font-medium text-foreground">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderStep2AudiencePreview = () => (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-xl">Audiencia</DialogTitle>
      </DialogHeader>
      <Card>
        <CardContent className="p-6">
          {audienceLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-12 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          ) : audiencePreview ? (
            <div className="text-center">
              <div className="text-5xl font-bold text-primary mb-2">
                {audiencePreview.count}
              </div>
              <p className="text-muted-foreground">
                pacientes matchem este filtro
              </p>
              {audiencePreview.count > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Preview (primeiros 5):</p>
                  <div className="space-y-1">
                    {audiencePreview.patients.slice(0, 5).map((p) => (
                      <div key={p.id} className="text-sm text-foreground">
                        {p.name} - {p.phone}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center">
              Selecione um tipo de campanha na etapa anterior
            </p>
          )}
        </CardContent>
      </Card>
      <button
        onClick={() => setCurrentStep(1)}
        className="text-sm text-primary hover:text-primary/80"
      >
        Alterar filtros
      </button>
    </div>
  )

  const renderStep3TemplateSelection = () => (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-xl">Modelo de mensagem</DialogTitle>
      </DialogHeader>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
          Nome da Campanha *
        </label>
        <Input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          required
          placeholder="Ex: Reativacao Marco 2026"
        />
      </div>
      <div>
        <label htmlFor="messageTemplate" className="block text-sm font-medium text-foreground mb-1">
          Mensagem *
        </label>
        <textarea
          id="messageTemplate"
          value={formData.messageTemplate}
          onChange={(e) => setFormData((prev) => ({ ...prev, messageTemplate: e.target.value }))}
          rows={8}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[150px] font-mono"
          placeholder="Olá, {{patient_name}}!..."
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use {'{{patient_name}}'} para personalizar com o nome do paciente
        </p>
      </div>
    </div>
  )

  const renderStep4Schedule = () => (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-xl">Agendamento</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="schedule"
            checked={formData.startImmediately}
            onChange={() => setFormData((prev) => ({ ...prev, startImmediately: true }))}
            className="h-4 w-4 text-primary"
          />
          <span className="text-sm text-foreground">Iniciar imediatamente</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="schedule"
            checked={!formData.startImmediately}
            onChange={() => setFormData((prev) => ({ ...prev, startImmediately: false }))}
            className="h-4 w-4 text-primary"
          />
          <span className="text-sm text-foreground">Agendar para data especifica</span>
        </label>
      </div>
      {!formData.startImmediately && (
        <div>
          <label htmlFor="scheduledAt" className="block text-sm font-medium text-foreground mb-1">
            Data e Hora
          </label>
          <Input
            type="datetime-local"
            id="scheduledAt"
            value={formData.scheduledAt}
            onChange={(e) => setFormData((prev) => ({ ...prev, scheduledAt: e.target.value }))}
          />
        </div>
      )}
    </div>
  )

  const renderStep5Confirm = () => (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-xl">Confirmar Campanha</DialogTitle>
      </DialogHeader>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome:</span>
            <span className="font-medium">{formData.name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo:</span>
            <span className="font-medium">
              {CAMPAIGN_TYPES.find((t) => t.value === formData.campaignType)?.label}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Audiencia:</span>
            <span className="font-medium">
              {audiencePreview?.count || 0} pacientes
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Agendamento:</span>
            <span className="font-medium">
              {formData.startImmediately
                ? 'Iniciar imediatamente'
                : formData.scheduledAt
                ? new Date(formData.scheduledAt).toLocaleString('pt-BR')
                : '-'}
            </span>
          </div>
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">Preview da mensagem:</p>
            <p className="text-sm bg-muted p-3 rounded font-mono whitespace-pre-wrap">
              {formData.messageTemplate}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1TypeSelection()
      case 2:
        return renderStep2AudiencePreview()
      case 3:
        return renderStep3TemplateSelection()
      case 4:
        return renderStep4Schedule()
      case 5:
        return renderStep5Confirm()
      default:
        return null
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!formData.campaignType
      case 2:
        return !!audiencePreview && audiencePreview.count > 0
      case 3:
        return !!formData.name && !!formData.messageTemplate
      case 4:
        return formData.startImmediately || !!formData.scheduledAt
      case 5:
        return true
      default:
        return false
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {renderStepIndicator()}
        <div>{renderCurrentStep()}</div>
        <DialogFooter className="gap-2">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack}>
              Voltar
            </Button>
          )}
          {currentStep < 5 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Proximo
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || loading}
            >
              {loading
                ? 'Criando...'
                : formData.startImmediately
                  ? 'Iniciar Campanha'
                  : 'Agendar Campanha'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
