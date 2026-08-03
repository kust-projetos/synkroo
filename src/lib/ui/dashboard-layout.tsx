'use client'

import { Sidebar, MobileSidebar } from '@/lib/ui/sidebar'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile header */}
        <header className="lg:hidden bg-card/90 backdrop-blur-md border-b border-border/80 px-4 py-3 flex items-center justify-between z-30 shrink-0">
          <div className="flex items-center gap-3">
            <MobileSidebar />
            <span className="text-base font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-emerald-500">
              Synkroo
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">IA Conectada</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent via-teal-950/[0.02] to-transparent">
          {children}
        </main>
      </div>
    </div>
  )
}
