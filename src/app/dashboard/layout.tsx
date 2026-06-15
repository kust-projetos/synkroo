'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/lib/ui/dashboard-layout'
import { installMockFetch, restoreMockFetch } from '@/lib/mocks/fetch-interceptor'

const isDevBypass = process.env.NODE_ENV === 'development' &&
  (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
   process.env.NEXT_PUBLIC_USE_MOCKS === 'true')

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
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
