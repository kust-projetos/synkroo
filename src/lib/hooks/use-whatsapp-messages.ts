'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './use-queries'

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
}

interface UseWhatsAppMessagesResult {
  messages: WhatsAppMessage[]
  isLoading: boolean
  refetch: () => void
}

async function fetchWhatsAppMessages(contactId: string, phone: string): Promise<WhatsAppMessage[]> {
  const params = new URLSearchParams({ contact_id: contactId, phone })
  const response = await fetch(`/api/messages/whatsapp?${params}`)
  if (!response.ok) throw new Error('Failed to fetch messages')
  const data = await response.json()
  return data.messages ?? []
}

export function useWhatsAppMessages({ contactId, contactPhone }: UseWhatsAppMessagesOptions): UseWhatsAppMessagesResult {
  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.whatsappMessages(contactId ?? ''),
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
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function useSendWhatsAppMessage({ contactPhone, onSuccess, onError }: UseSendWhatsAppMessageOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ message }: { message: string }) => {
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
      if (contactPhone) {
        queryClient.invalidateQueries({ queryKey: queryKeys.whatsappMessages(contactPhone) })
      }
      onSuccess?.()
    },
    onError: (error: Error) => {
      onError?.(error)
    },
  })
}
