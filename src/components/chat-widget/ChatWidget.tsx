'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Message {
  id: string
  content: string
  direction: 'inbound' | 'outbound'
  timestamp: Date
}

interface ChatWidgetProps {
  clinicId: string
  clinicName?: string
  primaryColor?: string
  position?: 'bottom-right' | 'bottom-left'
  greeting?: string
}

export function ChatWidget({
  clinicId,
  clinicName = 'Clínica',
  primaryColor = '#4F46E5',
  position = 'bottom-right',
  greeting = 'Olá! Como posso ajudar?',
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [visitorId] = useState(() => {
    // Generate or retrieve visitor ID
    if (typeof window !== 'undefined') {
      let vid = localStorage.getItem('synkroo_visitor_id')
      if (!vid) {
        vid = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem('synkroo_visitor_id', vid)
      }
      return vid
    }
    return ''
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  // Load conversation history
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen && visitorId) {
      loadHistory()
    }
  }, [isOpen, visitorId])

  const loadHistory = async () => {
    try {
      const response = await fetch(
        `/api/widget/messages?clinic_id=${clinicId}&visitor_id=${visitorId}`
      )
      if (response.ok) {
        const data = await response.json()
        if (data.conversation_id) {
          setConversationId(data.conversation_id)
        }
        if (data.messages) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id,
              content: m.content,
              direction: m.direction,
              timestamp: new Date(m.created_at),
            }))
          )
        }
        // Add greeting if no messages
        if (!data.messages || data.messages.length === 0) {
          setMessages([
            {
              id: 'greeting',
              content: greeting,
              direction: 'outbound',
              timestamp: new Date(),
            },
          ])
        }
      }
    } catch (error) {
      console.error('Error loading history:', error)
    }
  }

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    // Add user message optimistically
    const tempId = `temp_${Date.now()}`
    setMessages(prev => [
      ...prev,
      {
        id: tempId,
        content: userMessage,
        direction: 'inbound',
        timestamp: new Date(),
      },
    ])
    setIsLoading(true)

    try {
      const response = await fetch('/api/widget/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinicId,
          visitor_id: visitorId,
          message: userMessage,
          conversation_id: conversationId,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        if (data.conversation_id) {
          setConversationId(data.conversation_id)
        }

        // Replace temp message with real one and add bot response
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempId)
          return [
            ...filtered,
            {
              id: data.user_message?.id || tempId,
              content: userMessage,
              direction: 'inbound',
              timestamp: new Date(),
            },
            ...(data.bot_response
              ? [
                  {
                    id: data.bot_response.id || `bot_${Date.now()}`,
                    content: data.bot_response.content,
                    direction: 'outbound' as const,
                    timestamp: new Date(),
                  },
                ]
              : []),
          ]
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, clinicId, visitorId, conversationId])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const positionClass = position === 'bottom-left' ? 'left-4' : 'right-4'

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 ${positionClass} z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110`}
        style={{ backgroundColor: primaryColor }}
        aria-label={isOpen ? 'Fechar chat' : 'Abrir chat'}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-20 ${positionClass} z-50 w-80 sm:w-96 h-[28rem] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200`}
        >
          {/* Header */}
          <div
            className="p-4 text-white flex items-center gap-3"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold">{clinicName}</div>
              <div className="text-xs text-white/80">Online agora</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.direction === 'inbound' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                    message.direction === 'inbound'
                      ? 'bg-indigo-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                className="flex-1 px-4 py-2 rounded-full bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}