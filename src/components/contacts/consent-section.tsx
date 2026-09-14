'use client'

import { useContactConsents } from '@/lib/hooks/use-queries'
import { useGrantConsent, useRevokeConsent } from '@/lib/hooks/use-queries'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'

interface ConsentSectionProps {
  contactId: string
  contactType: 'patient' | 'lead'
}

const CONSENT_CONFIG = [
  {
    purpose: 'data_collection' as const,
    label: 'Coleta de dados',
    description: 'Autorizo a coleta dos meus dados pessoais',
  },
  {
    purpose: 'marketing' as const,
    label: 'Comunicação de marketing',
    description: 'Autorizo o recebimento de comunicados de marketing',
  },
  {
    purpose: 'whatsapp_communication' as const,
    label: 'Comunicação via WhatsApp',
    description: 'Autorizo o contato via WhatsApp',
  },
]

export function ConsentSection({ contactId, contactType }: ConsentSectionProps) {
  const { data, isLoading } = useContactConsents(contactId, contactType)

  const grantMutation = useGrantConsent()
  const revokeMutation = useRevokeConsent()

  const consents = data?.data ?? []

  const getConsent = (purpose: string) =>
    consents.find((c: any) => c.purpose === purpose)

  const handleToggle = (purpose: string, currentGranted: boolean) => {
    const payload = { contact_id: contactId, contact_type: contactType, purpose, channel: 'web' }
    const mutation = currentGranted ? revokeMutation : grantMutation
    // G1: invalidação exata dentro dos hooks (grant/revoke); sem onSuccess aqui.
    mutation.mutate(payload)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-foreground">Consentimentos (LGPD)</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Todas as alterações de consentimento são registradas para conformidade LGPD
        </p>
      </div>

      <div className="space-y-3">
        {CONSENT_CONFIG.map((config) => {
          const consent = getConsent(config.purpose)
          const granted = consent?.granted ?? false

          return (
            <div key={config.purpose} className="flex items-start gap-3">
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={granted}
                    onCheckedChange={() => handleToggle(config.purpose, granted)}
                    disabled={grantMutation.isPending || revokeMutation.isPending}
                  />
                  <span className="text-sm font-medium text-foreground">{config.label}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-10">{config.description}</p>
                {consent && (
                  <p className="text-xs text-muted-foreground pl-10">
                    {granted
                      ? `Conceduído em: ${new Date(consent.granted_at!).toLocaleDateString('pt-BR')}`
                      : consent.revoked_at
                      ? `Revogado em: ${new Date(consent.revoked_at).toLocaleDateString('pt-BR')}`
                      : ''}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
