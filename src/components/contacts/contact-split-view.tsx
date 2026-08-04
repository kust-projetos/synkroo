'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Panel, Group } from 'react-resizable-panels'
import { ContactErrorBoundary } from './contact-error-boundary'
import { ContactListPanel } from './contact-list-panel'
import { ContactDetailPanel } from './contact-detail-panel'
import { Button } from '@/components/ui/button'

export function ContactSplitView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('contact')
  const selectedType = searchParams.get('type') as 'patient' | 'lead' | null

  const clearSelection = () => {
    router.replace('/dashboard/contatos', { scroll: false })
  }

  const detail = <ContactDetailPanel contactId={selectedId} contactType={selectedType} onClearSelection={clearSelection} />
  const list = <ContactListPanel selectedId={selectedId} selectedType={selectedType} />

  return (
    <ContactErrorBoundary>
      <div className="hidden md:flex h-full">
      <Group orientation="horizontal" className="h-full flex">
        <Panel defaultSize={35} minSize={25} id="list">
          {list}
        </Panel>
        <div className="w-px bg-border hover:bg-teal-400/20 transition-colors cursor-col-resize" />
        <Panel defaultSize={65} minSize={40} id="detail">
          <ContactErrorBoundary fallback={
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <p className="text-muted-foreground mb-2">Contato não encontrado</p>
              <Button onClick={clearSelection} variant="outline">Voltar a lista</Button>
            </div>
          }>
            {detail}
          </ContactErrorBoundary>
        </Panel>
      </Group>
      </div>
      <div className="md:hidden h-full">
        {selectedId ? detail : list}
      </div>
    </ContactErrorBoundary>
  )
}