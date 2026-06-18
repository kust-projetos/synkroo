'use client'

import { Sidebar, MobileSidebar } from '@/lib/ui/sidebar'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden bg-card border-b border-border px-4 py-3 flex items-center gap-4 z-30 shrink-0">
          <MobileSidebar />
          <span className="text-lg font-semibold text-teal-600 dark:text-teal-400">Synkroo</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>


    </div>
  )
}
