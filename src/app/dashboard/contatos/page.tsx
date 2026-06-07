'use client'

import { ContactSplitView } from '@/components/contacts/contact-split-view'
import { ContactErrorBoundary } from '@/components/contacts/contact-error-boundary'
import { PageHeader } from '@/components/ui/page-header'
import { contactsDomainBoundary } from '@/lib/domain-boundaries'

export default function ContatosPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader title={contactsDomainBoundary.title} description={contactsDomainBoundary.description} />
      <div className="flex-1 overflow-hidden">
        <ContactErrorBoundary>
          <ContactSplitView />
        </ContactErrorBoundary>
      </div>
    </div>
  )
}