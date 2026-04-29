'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface UserProfile {
  id: string
  email: string
  name: string
  role: 'owner' | 'admin' | 'dentist' | 'receptionist'
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
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  signup: (email: string, password: string, name: string, clinicName: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const isAuthenticated = !!user && !!profile

  // Fetch profile from API
  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/auth/session')
      const data = await response.json()

      if (data.authenticated && data.profile) {
        setUser(data.user)
        setProfile(data.profile)
      } else {
        setUser(null)
        setProfile(null)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      setUser(null)
      setProfile(null)
    }
  }

  // Initial session check
  useEffect(() => {
    let cancelled = false

    const initAuth = async () => {
      setLoading(true)
      await fetchProfile()
      if (!cancelled) {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await fetchProfile()
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          router.push('/login')
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [router])

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { error: data.error || 'Login failed' }
      }

      setUser(data.user)
      setProfile(data.profile)
      router.refresh()

      return {}
    } catch (error) {
      console.error('Login error:', error)
      return { error: 'An unexpected error occurred' }
    }
  }

  // Logout function
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setProfile(null)
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Signup function
  const signup = async (email: string, password: string, name: string, clinicName: string) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, clinicName }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { error: data.error || 'Signup failed' }
      }

      setUser(data.user)
      setProfile(data.profile)
      router.refresh()

      return {}
    } catch (error) {
      console.error('Signup error:', error)
      return { error: 'An unexpected error occurred' }
    }
  }

  // Refresh profile
  const refreshProfile = async () => {
    await fetchProfile()
  }

  const value: AuthContextType = {
    user,
    profile,
    loading,
    isAuthenticated,
    login,
    signup,
    logout,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
) {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!loading && !isAuthenticated) {
        router.push('/login')
      }
    }, [loading, isAuthenticated, router])

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )
    }

    if (!isAuthenticated) {
      return null
    }

    return <Component {...props} />
  }
}