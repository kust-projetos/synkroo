'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import Link from 'next/link'

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  intent?: string
  is_ai: boolean
  created_at: string
}

interface Conversation {
  id: string
  channel: 'whatsapp' | 'instagram' | 'web'
  status: 'active' | 'waiting' | 'closed' | 'escalated'
  external_id: string
  last_message_at: string
  patient?: {
    id: string
    name: string
    phone: string
  }
  last_message?: {
    content: string
    direction: string
    intent?: string
  }
  messages?: Message[]
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  waiting: 'bg-amber-100 text-amber-700',
  closed: 'bg-slate-100 text-slate-600',
  escalated: 'bg-red-100 text-red-700',
}

const intentLabels: Record<string, { label: string; color: string }> = {
  agendamento: { label: 'Agendamento', color: 'bg-green-100 text-green-700' },
  duvida: { label: 'Dúvida', color: 'bg-blue-100 text-blue-700' },
  emergencia: { label: 'Emergência', color: 'bg-red-100 text-red-700' },
  confirmacao: { label: 'Confirmação', color: 'bg-purple-100 text-purple-700' },
  reclamacao: { label: 'Reclamação', color: 'bg-amber-100 text-amber-700' },
  outros: { label: 'Outros', color: 'bg-slate-100 text-slate-600' },
}

const channelIcons: Record<string, { bg: string; icon: string }> = {
  whatsapp: { bg: 'bg-green-500', icon: '💬' },
  instagram: { bg: 'bg-gradient-to-br from-purple-500 to-pink-500', icon: '📷' },
  web: { bg: 'bg-blue-500', icon: '🌐' },
}

export default function ConversasPage() {
  const { profile } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [filter, setFilter] = useState<'all' | 'whatsapp' | 'instagram' | 'escalated'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)

  const fetchConversations = useCallback(async () => {
    if (!profile?.clinic_id) return

    setLoadingConvs(true)
    try {
      const params = new URLSearchParams({
        clinic_id: profile.clinic_id,
        limit: '50',
      })

      if (filter === 'escalated') {
        params.set('status', 'escalated')
      } else if (filter !== 'all') {
        params.set('channel', filter)
      }

      const response = await fetch(`/api/conversations?${params}`)
      const data = await response.json()

      if (data.success) {
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoadingConvs(false)
    }
  }, [profile?.clinic_id, filter])

  useEffect(() => {
    if (profile?.clinic_id) {
      fetchConversations()
    }
  }, [profile?.clinic_id, fetchConversations])

  const fetchConversationDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`)
      const data = await response.json()

      if (data.success) {
        setSelectedConversation(data.conversation)
      }
    } catch (error) {
      console.error('Error fetching conversation details:', error)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Agora'
    if (minutes < 60) return `${minutes}min`
    if (hours < 24) return `${hours}h`
    if (days === 1) return 'Ontem'
    if (days < 7) return `${days}d`
    return date.toLocaleDateString('pt-BR')
  }

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      conv.patient?.name?.toLowerCase().includes(query) ||
      conv.external_id?.includes(query) ||
      conv.last_message?.content?.toLowerCase().includes(query)
    )
  })

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending || !profile?.clinic_id) return

    setSending(true)
    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: profile.clinic_id,
          to: selectedConversation.external_id,
          message: newMessage.trim(),
          channel: selectedConversation.channel,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setNewMessage('')
        await fetchConversationDetails(selectedConversation.id)
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 h-[calc(100vh-80px)] lg:h-screen flex flex-col">
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Conversations List */}
          <div className="w-full lg:w-96 bg-white rounded-lg shadow flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-bold text-gray-900">Conversas</h1>
                <span className="bg-green-100 text-green-700 text-sm font-medium px-2 py-1 rounded-full">
                  {conversations.filter(c => c.status === 'active').length} ativas
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar conversas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 p-3 border-b border-gray-200 overflow-x-auto">
              {[
                { key: 'all', label: 'Todas' },
                { key: 'whatsapp', label: 'WhatsApp' },
                { key: 'instagram', label: 'Instagram' },
                { key: 'escalated', label: 'Humanos' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key as typeof filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                    filter === f.key
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <span className="text-4xl mb-3">💬</span>
                  <p className="text-sm">Nenhuma conversa encontrada</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => fetchConversationDetails(conv.id)}
                    className={`w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                      selectedConversation?.id === conv.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${channelIcons[conv.channel]?.bg || 'bg-gray-300'}`}>
                        {channelIcons[conv.channel]?.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-gray-900 truncate">
                            {conv.patient?.name || conv.external_id}
                          </p>
                          <span className="text-xs text-gray-500">
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {conv.last_message?.content || 'Sem mensagens'}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {conv.last_message?.intent && intentLabels[conv.last_message.intent] && (
                            <span className={`px-1.5 py-0.5 text-xs rounded ${intentLabels[conv.last_message.intent].color}`}>
                              {intentLabels[conv.last_message.intent].label}
                            </span>
                          )}
                          {conv.status === 'escalated' && (
                            <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 font-medium">
                              Escalonado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat View - Hidden on mobile unless conversation selected */}
          <div className={`flex-1 bg-white rounded-lg shadow flex flex-col ${selectedConversation ? 'flex' : 'hidden lg:flex'}`}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 flex items-center gap-4">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
                  >
                    ← Voltar
                  </button>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {selectedConversation.patient?.name || selectedConversation.external_id}
                    </p>
                    <p className="text-sm text-gray-500">
                      {selectedConversation.patient?.phone || selectedConversation.external_id}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusColors[selectedConversation.status]}`}>
                    {selectedConversation.status === 'active' ? 'Ativo' :
                     selectedConversation.status === 'escalated' ? 'Escalonado' :
                     selectedConversation.status === 'waiting' ? 'Aguardando' : 'Fechado'}
                  </span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {selectedConversation.messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                          msg.direction === 'inbound'
                            ? 'bg-white border border-gray-200 text-gray-900'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.direction === 'inbound' ? 'text-gray-400' : 'text-indigo-200'}`}>
                          {formatTime(msg.created_at)}
                          {msg.is_ai && ' · IA'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      disabled={sending}
                      className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {sending ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <span className="text-6xl mb-4">💬</span>
                <p className="text-lg font-medium text-gray-700">Selecione uma conversa</p>
                <p className="text-sm mt-1">Escolha uma conversa na lista para visualizar</p>
              </div>
            )}
          </div>
        </div>
    </div>
  )
}