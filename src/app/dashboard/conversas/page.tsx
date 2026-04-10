'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { Card } from '@/components/ui/card'
import {
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  CameraIcon,
  ArrowLeftIcon,
  PaperAirplaneIcon,
  CalendarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

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
  unread_count?: number
}

const intentLabels: Record<string, { label: string; status: 'success' | 'info' | 'error' | 'warning' }> = {
  agendamento: { label: 'Agendamento', status: 'success' },
  duvida: { label: 'Dúvida', status: 'info' },
  emergencia: { label: 'Emergência', status: 'error' },
  confirmacao: { label: 'Confirmação', status: 'info' },
  reclamacao: { label: 'Reclamação', status: 'warning' },
  outros: { label: 'Outros', status: 'info' },
}

const channelConfig: Record<string, { bg: string; icon: React.ReactNode; name: string }> = {
  whatsapp: { bg: 'bg-green-500', icon: <ChatBubbleLeftRightIcon className="w-5 h-5" />, name: 'WhatsApp' },
  instagram: { bg: 'bg-gradient-to-br from-purple-500 to-pink-500', icon: <CameraIcon className="w-5 h-5" />, name: 'Instagram' },
  web: { bg: 'bg-teal-600', icon: <ChatBubbleLeftRightIcon className="w-5 h-5" />, name: 'Web' },
}

const statusConfig: Record<string, { label: string; status: 'success' | 'warning' | 'error' | 'info' | 'zinc' }> = {
  active: { label: 'Ativo', status: 'success' },
  waiting: { label: 'Aguardando', status: 'warning' },
  closed: { label: 'Fechado', status: 'zinc' },
  escalated: { label: 'Escalonado', status: 'error' },
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

  const activeCount = conversations.filter(c => c.status === 'active').length

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
    <div className="flex flex-col gap-6 p-4 lg:p-6 h-[calc(100vh-80px)] lg:h-screen overflow-hidden">
      {/* Header */}
      <PageHeader
        title="Conversas"
        description={`Gerencie suas conversas em tempo real`}
        action={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800">
              {activeCount} ativas
            </Badge>
          </div>
        }
      />

      {/* Main Content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Conversations List */}
        <Card className="w-full lg:w-96 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-border">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar conversas..."
              className="w-full"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 p-3 border-b border-border overflow-x-auto">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'whatsapp', label: 'WhatsApp' },
              { key: 'instagram', label: 'Instagram' },
              { key: 'escalated', label: 'Humanos' },
            ].map((f) => (
              <Button
                key={f.key}
                variant={filter === f.key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter(f.key as typeof filter)}
                className="whitespace-nowrap"
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <ChatBubbleLeftRightIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhuma conversa</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery ? 'Tente outro termo de busca' : 'Novas conversas aparecerão aqui'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => fetchConversationDetails(conv.id)}
                  className={`w-full p-4 text-left hover:bg-muted/50 border-b border-border transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-muted border-l-4 border-l-primary' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={`text-white ${channelConfig[conv.channel]?.bg}`}>
                          {conv.patient?.name?.charAt(0) || conv.external_id.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {conv.status === 'active' && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-foreground truncate text-sm">
                          {conv.patient?.name || conv.external_id}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message?.content || 'Sem mensagens'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {conv.last_message?.intent && intentLabels[conv.last_message.intent] && (
                          <StatusBadge status={intentLabels[conv.last_message.intent].status}>
                            {intentLabels[conv.last_message.intent].label}
                          </StatusBadge>
                        )}
                        {conv.unread_count && conv.unread_count > 0 && (
                          <Badge variant="outline" className="bg-primary text-primary-foreground border-primary text-xs px-1.5 py-0">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Chat View */}
        <Card className={`flex-1 flex flex-col overflow-hidden ${selectedConversation ? 'flex' : 'hidden lg:flex'}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedConversation(null)}
                  className="lg:hidden"
                >
                  <ArrowLeftIcon className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {selectedConversation.patient?.name || selectedConversation.external_id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.patient?.phone || selectedConversation.external_id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={statusConfig[selectedConversation.status].status}>
                    {statusConfig[selectedConversation.status].label}
                  </StatusBadge>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                {selectedConversation.messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl ${
                        msg.direction === 'inbound'
                          ? 'bg-card border border-border text-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.direction === 'inbound' ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                        {formatTime(msg.created_at)}
                        {msg.is_ai && ' · IA'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="px-4 py-2 border-t border-border flex gap-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <CalendarIcon className="w-4 h-4 mr-1" />
                  Agendar
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <ClockIcon className="w-4 h-4 mr-1" />
                  Reagendar
                </Button>
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    disabled={sending}
                    className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    size="icon"
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ChatBubbleLeftRightIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground">Selecione uma conversa</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Escolha uma conversa na lista para visualizar e responder
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
