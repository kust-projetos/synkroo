'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useContact, useContactNotes, useLeadsByPatient } from '@/lib/hooks/use-queries'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ContactTimelineTab } from './contact-timeline-tab'
import { ContactNotesTab } from './contact-notes-tab'
import { ContactCustomFieldsTab } from './contact-custom-fields-tab'
import { ContactFinancialTab } from './contact-financial-tab'
import { ConsentSection } from './consent-section'
import { DuplicateTab } from './duplicate-tab'
import { MessageBubble } from '@/components/whatsapp/message-bubble'
import { MessageComposer } from '@/components/whatsapp/message-composer'
import { useWhatsAppMessages } from '@/lib/hooks/use-whatsapp-messages'
import { getContactOwnershipCopy } from '@/lib/domain-boundaries'

interface ContactDetailPanelProps {
  contactId?: string | null
  contactType?: 'patient' | 'lead' | null
  onClearSelection?: () => void
}

/**
 * Task 6: painel de detalhe READ-ONLY no MVP CRM.
 *  - Sem PencilIcon / botão "Editar" (PUT /api/contacts/:id retorna 405).
 *  - Sem ArchiveBoxIcon / botão "Arquivar" (PATCH idem).
 *  - Sem useMutation PUT/PATCH; sem Input/Label de edição inline.
 *  - Mantém tabs de notas, timeline, campos customizados, financeiro,
 *    whatsapp e duplicados (somente leitura ou via owner-bridge).
 */
export function ContactDetailPanel({ contactId, contactType, onClearSelection }: ContactDetailPanelProps) {
  const [activeTab, setActiveTab] = useState('info')

  const { data: contact, isLoading, error } = useContact(contactId || '', contactType || '')
  const { data: notesData } = useContactNotes(contactId || '', contactType || '')

  if (!contactId || !contactType) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          title="Selecione um contato"
          description="Escolha um contato na lista para ver os detalhes"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-muted-foreground mb-2">Não foi possível carregar este contato</p>
        {onClearSelection && <Button variant="ghost" onClick={onClearSelection}>Voltar para contatos</Button>}
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-muted-foreground mb-4">Contato não encontrado</p>
        <Button onClick={onClearSelection} variant="outline">Voltar para contatos</Button>
      </div>
    )
  }

  const ownershipCopy = getContactOwnershipCopy(contact.type)

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b border-border">
        <Button variant="ghost" size="sm" className="mb-2 md:hidden" onClick={onClearSelection}>
          Voltar para contatos
        </Button>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">{contact.name}</h2>
            <Badge variant={contact.type === 'patient' ? 'secondary' : 'outline'}>
              {contact.type === 'patient' ? 'Paciente' : 'Lead'}
            </Badge>
          </div>
          {/* Task 6: read-only MVP — sem CTAs de editar/arquivar (PUT/PATCH → 405). */}
        </div>

        <div className="mb-4 rounded-lg border border-sky-200/70 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/20">
          <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">{ownershipCopy.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{ownershipCopy.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Telefone:</span> {contact.phone}</div>
          <div><span className="text-muted-foreground">Email:</span> {contact.email || '-'}</div>
          {contact.type === 'lead' && (
            <>
              <div><span className="text-muted-foreground">Source:</span> {contact.source || '-'}</div>
              <div><span className="text-muted-foreground">Score:</span> {contact.score || '-'}</div>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="custom">Campos</TabsTrigger>
          <TabsTrigger value="whatsapp" className="data-[state=active]:text-teal-600">WhatsApp</TabsTrigger>
          <TabsTrigger value="financeiro" className="data-[state=active]:text-teal-600">Financeiro</TabsTrigger>
          <TabsTrigger value="duplicados" className="data-[state=active]:text-teal-600">Duplicados</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'info' && (
          <div className="p-4 space-y-4">
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Status:</span>
                <span>{contact.status}</span>
                {contact.tags && contact.tags.length > 0 && (
                  <>
                    <span className="text-muted-foreground">Tags:</span>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            {contactType === 'patient' && (
              <div className="border-t border-border pt-4">
                <RelatedLeadsSection contactId={contactId!} />
              </div>
            )}
            <div className="border-t border-border pt-4">
              <ConsentSection contactId={contactId!} contactType={contactType!} />
            </div>
          </div>
        )}
        {activeTab === 'timeline' && (
          <ContactTimelineTab contactId={contactId!} contactType={contactType!} />
        )}
        {activeTab === 'notes' && (
          <ContactNotesTab contactId={contactId!} contactType={contactType!} />
        )}
        {activeTab === 'custom' && (
          <ContactCustomFieldsTab contactId={contactId!} contactType={contactType!} />
        )}
        {activeTab === 'whatsapp' && (
          <WhatsAppTab contactPhone={contact?.phone} contactId={contactId!} />
        )}
        {activeTab === 'financeiro' && (
          <ContactFinancialTab contactId={contactId!} />
        )}
        {activeTab === 'duplicados' && (
          <div className="p-4">
            <DuplicateTab
              contactId={contactId!}
              contactType={contactType!}
              onApprove={() => {}}
              onDismiss={() => {}}
              onMerge={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function RelatedLeadsSection({ contactId }: { contactId: string }) {
  const { data: leadsData, isLoading } = useLeadsByPatient(contactId)

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />
  }

  const leads = leadsData?.leads || []

  if (leads.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">Leads Vinculados</h3>
      <div className="space-y-2">
        {leads.slice(0, 5).map((lead: any) => (
          <div key={lead.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <div className="font-medium text-sm">{lead.name}</div>
              <div className="text-xs text-muted-foreground">{lead.status} - {lead.score}%</div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/leads/${lead.id}`}>
                Ver Lead
              </Link>
            </Button>
          </div>
        ))}
      </div>
      {leads.length > 5 && (
        <p className="text-xs text-muted-foreground">+{leads.length - 5} mais leads</p>
      )}
    </div>  )
}

function WhatsAppTab({ contactPhone, contactId }: { contactPhone?: string; contactId: string }) {
  const { messages, isLoading } = useWhatsAppMessages({ contactId, contactPhone })

  if (!contactPhone) {
    return (
      <div className="p-4">
        <EmptyState title="Sem telefone" description="Este contato não possui telefone para WhatsApp" />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages?.length ? (
          messages.map((msg: any) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        ) : (
          <EmptyState title="Sem mensagens" />
        )}
      </div>
      <MessageComposer contactPhone={contactPhone} contactId={contactId} />
    </div>
  )
}
