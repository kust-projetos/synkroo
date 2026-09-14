'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, useResolvedClinicId } from './use-queries'
import { isMockMode, getMockForUrl } from '@/lib/mocks'

export interface WhatsAppMessage {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  created_at: string
  metadata?: {
    delivery_status?: 'sent' | 'delivered' | 'read'
  }
}

interface UseWhatsAppMessagesOptions {
  contactId?: string
  contactPhone?: string
  /** G1: tenant explícito — omitido resolve do profile via contexto. */
  clinicId?: string
}

interface UseWhatsAppMessagesResult {
  messages: WhatsAppMessage[]
  isLoading: boolean
  refetch: () => void
}

async function fetchWhatsAppMessages(contactId: string, phone: string): Promise<WhatsAppMessage[]> {
  if (isMockMode()) {
    const data = getMockForUrl(`/api/messages/whatsapp?contact_id=${contactId}&phone=${phone}`) as { messages: WhatsAppMessage[] } | null
    return data?.messages ?? []
  }
  const params = new URLSearchParams({ contact_id: contactId, phone })
  const response = await fetch(`/api/messages/whatsapp?${params}`)
  if (!response.ok) throw new Error('Failed to fetch messages')
  const data = await response.json()
  return data.messages ?? []
}

export function useWhatsAppMessages({ contactId, contactPhone, clinicId }: UseWhatsAppMessagesOptions): UseWhatsAppMessagesResult {
  // G1: contactId identifica o contato; clinicId (explícito ou do contexto)
  // escopa o tenant. Nunca confundir os dois.
  const resolvedClinicId = useResolvedClinicId(clinicId)
  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.whatsappMessages(contactId ?? '', resolvedClinicId),
    queryFn: () => fetchWhatsAppMessages(contactId!, contactPhone!),
    enabled: !!contactId && !!contactPhone,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  })

  return {
    messages: data ?? [],
    isLoading,
    refetch,
  }
}

interface UseSendWhatsAppMessageOptions {
  contactPhone: string
  /** G1: id do contato (não é o telefone) — sem ele a invalidação usa predicate. */
  contactId?: string
  /** G1: tenant explícito — omitido resolve do profile via contexto. */
  clinicId?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function useSendWhatsAppMessage({ contactPhone, contactId, clinicId, onSuccess, onError }: UseSendWhatsAppMessageOptions) {
  const queryClient = useQueryClient()
  const resolvedClinicId = useResolvedClinicId(clinicId)

  return useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      if (isMockMode()) {
        return { id: 'mock-sent-msg', status: 'sent', message, created_at: new Date().toISOString() }
      }
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: contactPhone,
          message,
          channel: 'whatsapp',
        }),
      })
      if (!response.ok) throw new Error('Failed to send message')
      return response.json()
    },
    onSuccess: (_data, _variables) => {
      if (contactId) {
        // G1: invalidação exata — contactId (nunca o telefone) + tenant.
        queryClient.invalidateQueries({
          queryKey: queryKeys.whatsappMessages(contactId, resolvedClinicId),
        })
      } else {
        // Sem contactId à mão: predicate restrito ao domínio escopado.
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === 'clinic' &&
            q.queryKey.includes('whatsapp-messages'),
        })
      }
      onSuccess?.()
    },
    onError: (error: Error) => {
      onError?.(error)
    },
  })
}
