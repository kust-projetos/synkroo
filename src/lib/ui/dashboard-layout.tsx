'use client'

import { Sidebar, MobileSidebar } from '@/lib/ui/sidebar'
import { ChatWidget } from '@/components/chat-widget'

// Demo clinic ID - in production this would come from the clinic's subdomain or settings
const DEMO_CLINIC_ID = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="lg:pl-60 min-h-screen flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden bg-card border-b border-border px-4 py-3 flex items-center gap-4 sticky top-0 z-30">
          <MobileSidebar />
          <span className="text-lg font-semibold text-teal-600 dark:text-teal-400">Synkroo</span>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      {/* Chat Widget - Available on all dashboard pages */}
      <ChatWidget
        clinicId={DEMO_CLINIC_ID}
        clinicName="Clínica Demo"
        position="bottom-right"
        greeting="Olá! Sou a Mia, assistente virtual da Clínica Demo. Como posso ajudar?"
      />
    </div>
  )
}
