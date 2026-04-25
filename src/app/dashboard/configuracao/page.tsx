'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'
import { ReminderConfigCard, type ProcedureType } from '@/components/whatsapp/reminder-config-card'
import type { ReminderConfigPerProcedure } from '@/services/reminders/procedure-reminder-config.service'

interface ConfigWithName extends ReminderConfigPerProcedure {
  procedure_type_name: string
}

export default function ConfiguracaoPage() {
  const { profile, loading: authLoading } = useAuth()
  const toast = useToast()
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([])
  const [configs, setConfigs] = useState<Map<string, ReminderConfigPerProcedure>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const clinicId = profile?.clinic_id

  // Fetch procedure types and existing configs
  useEffect(() => {
    if (!clinicId) return

    const fetchData = async () => {
      try {
        // Fetch procedure types
        const ptResponse = await fetch(`/api/procedures?clinic_id=${clinicId}`)
        const ptData = await ptResponse.json()
        setProcedureTypes(ptData.procedure_types || [])

        // Fetch existing configs
        const configsResponse = await fetch(`/api/reminders/config`)
        const configsData = await configsResponse.json()
        const configsMap = new Map<string, ReminderConfigPerProcedure>()
        for (const config of configsData.configs || []) {
          configsMap.set(config.procedure_type_id, config as ReminderConfigPerProcedure)
        }
        setConfigs(configsMap)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.showToast('Erro ao carregar dados', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [clinicId, toast])

  const handleSaveConfig = async (config: ReminderConfigPerProcedure) => {
    try {
      const response = await fetch('/api/reminders/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedure_type_id: config.procedure_type_id,
          hours_before: config.hours_before,
          message_template: config.message_template,
          enabled: config.enabled,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.showToast('Configuração salva com sucesso!', 'success')
        // Update local state
        setConfigs((prev) => {
          const newMap = new Map(prev)
          newMap.set(config.procedure_type_id, { ...config, ...data.config })
          return newMap
        })
      } else {
        toast.showToast(data.error || 'Erro ao salvar configuração', 'error')
      }
    } catch (error) {
      console.error('Error saving config:', error)
      toast.showToast('Erro ao salvar configuração', 'error')
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="bg-card rounded-lg border border-border mb-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuração de Lembretes</h1>
          <p className="text-sm text-muted-foreground">
            Personalize o timing e mensagem dos lembretes por tipo de procedimento
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* Info box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Dica:</strong> Clique nos placeholders para inserí-los no template.
              Use 24h para procedimentos, 48h para check-ups e avaliações.
            </p>
          </div>

          {/* Procedure type cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {procedureTypes.map((pt) => {
              const config = configs.get(pt.id) || null
              return (
                <ReminderConfigCard
                  key={pt.id}
                  procedureType={pt}
                  config={config}
                  onSave={handleSaveConfig}
                />
              )
            })}
          </div>

          {/* Empty state */}
          {procedureTypes.length === 0 && (
            <div className="bg-card rounded-lg border border-border p-12 text-center">
              <p className="text-muted-foreground">
                Nenhum tipo de procedimento encontrado. Cadastre procedimentos na clínica para configurar lembretes.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}