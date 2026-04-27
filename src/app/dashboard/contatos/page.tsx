'use client'

import { ContactSplitView } from '@/components/contacts/contact-split-view'
import { ContactErrorBoundary } from '@/components/contacts/contact-error-boundary'
import { PageHeader } from '@/components/ui/page-header'

export default function ContatosPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader title="Contatos" description="Gerencie pacientes e leads" />
      <div className="flex-1 overflow-hidden">
        <ContactErrorBoundary>
          <ContactSplitView />
        </ContactErrorBoundary>
      </div>
    </div>
  )
}