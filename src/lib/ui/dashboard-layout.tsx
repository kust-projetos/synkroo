'use client'

import { useState } from 'react'
import { Sidebar, SidebarToggle } from '@/lib/ui/sidebar'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content - com padding-left no desktop para compensar o sidebar fixo */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 sticky top-0 z-30">
          <SidebarToggle onClick={() => setSidebarOpen(true)} />
          <span className="text-lg font-semibold text-indigo-600">Synkroo</span>
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}