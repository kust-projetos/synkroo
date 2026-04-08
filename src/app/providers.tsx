'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth/context'
import { ThemeProvider } from '@/components/theme-provider'
import { ToastProvider } from '@/lib/ui/toast'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
