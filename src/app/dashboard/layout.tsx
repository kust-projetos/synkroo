'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/lib/ui/dashboard-layout'
import { installMockFetch, restoreMockFetch } from '@/lib/mocks/fetch-interceptor'

const isDevBypass = process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_USE_MOCKS === 'true'

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  // Install mock fetch interceptor when NEXT_PUBLIC_USE_MOCKS=true
  useEffect(() => {
    installMockFetch()
    return () => {
      restoreMockFetch()
    }
  }, [])

  useEffect(() => {
    if (!isDevBypass && !loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  if (loading && !isDevBypass) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-live="polite" aria-busy="true" aria-label="Carregando painel">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" aria-hidden="true" />
        <span className="sr-only">Carregando...</span>
      </div>
    )
  }

  if (!isDevBypass && (!user || !profile)) {
    return null
  }

  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  )
}
