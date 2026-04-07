'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth/context'
import { ToastProvider } from '@/lib/ui/toast'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  )
}