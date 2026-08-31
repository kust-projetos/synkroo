'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'

export interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  role_id: string
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  clinic_id: string
  clinics: {
    id: string
    name: string
    slug: string
    phone: string
    email: string
    settings: Record<string, unknown>
  } | null
  available_clinics?: Array<{
    id: string
    name: string
    slug: string
    roleId: string
    role: string
  }>
}

type AuthResult = { error?: string }

interface AuthContextType {
  user: { id: string; email: string } | null
  profile: UserProfile | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  signup: (email: string, password: string, name: string, clinicName: string) => Promise<AuthResult>
  logout: () => Promise<void>
  switchClinic: (clinicId: string) => Promise<AuthResult>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function readProfile(): Promise<UserProfile | null> {
  const response = await fetch('/api/auth/session')
  const data = await response.json()
  return data.authenticated && data.profile ? data.profile : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = session?.user?.id && session.user.email
    ? { id: session.user.id, email: session.user.email }
    : null
  const loading = status === 'loading' || profileLoading
  const isAuthenticated = status === 'authenticated' && !!user && !!profile

  const refreshProfile = async () => {
    if (status !== 'authenticated') {
      setProfile(null)
      return
    }
    try {
      setProfile(await readProfile())
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    setProfileLoading(true)
    refreshProfile().finally(() => {
      if (!cancelled) setProfileLoading(false)
    })
    return () => { cancelled = true }
  }, [status, session?.user?.clinicId])

  const login = async (email: string, password: string): Promise<AuthResult> => {
    const result = await signIn('credentials', { email, password, redirect: false })
    if (!result || result.error) return { error: 'Credenciais inválidas' }
    await update()
    await refreshProfile()
    router.refresh()
    return {}
  }

  const signup = async (email: string, password: string, name: string, clinicName: string): Promise<AuthResult> => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, clinicName }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { error: data.error || 'Falha no cadastro' }
    }
    return login(email, password)
  }

  const logout = async () => {
    setProfile(null)
    await signOut({ callbackUrl: '/login' })
  }

  const switchClinic = async (clinicId: string): Promise<AuthResult> => {
    const response = await fetch('/api/auth/switch-clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId }),
    })
    if (!response.ok) return { error: 'Clínica indisponível' }
    await update({ clinicId })
    queryClient.clear()
    await refreshProfile()
    router.refresh()
    return {}
  }

  const value: AuthContextType = {
    user, profile, loading, isAuthenticated, login, signup, logout, switchClinic, refreshProfile,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, loading } = useAuth()
    const router = useRouter()
    useEffect(() => {
      if (!loading && !isAuthenticated) router.push('/login')
    }, [loading, isAuthenticated, router])
    if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
    if (!isAuthenticated) return null
    return <Component {...props} />
  }
}
