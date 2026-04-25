'use client'

import { useState } from 'react'
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { useSendWhatsAppMessage } from '@/lib/hooks/use-whatsapp-messages'
import { cn } from '@/lib/utils'

interface MessageComposerProps {
  contactPhone: string
  onMessageSent?: () => void
}

export function MessageComposer({ contactPhone, onMessageSent }: MessageComposerProps) {
  const [message, setMessage] = useState('')

  const sendMutation = useSendWhatsAppMessage({
    contactPhone,
    onSuccess: () => {
      setMessage('')
      onMessageSent?.()
    },
    onError: () => {
      // Error handling done in hook
    },
  })

  const handleSend = () => {
    if (!message.trim() || sendMutation.isPending) return
    sendMutation.mutate({ message: message.trim() })
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-4 border-t border-border bg-card">
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Digite sua mensagem..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={sendMutation.isPending}
          className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sendMutation.isPending}
          className={cn('bg-teal-600 hover:bg-teal-700', !message.trim() || sendMutation.isPending && 'opacity-50')}
        >
          {sendMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <PaperAirplaneIcon className="w-4 h-4" />
          )}
          <span className="sr-only">Enviar mensagem</span>
        </Button>
      </div>
    </div>
  )
}
