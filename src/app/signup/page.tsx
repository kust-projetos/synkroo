'use client'

import { Suspense, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'

function SignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signup(email, password, name, clinicName)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Clinic Name */}
      <div>
        <label htmlFor="clinicName" className="block text-sm font-medium text-gray-700 mb-1">
          Nome da Clinica
        </label>
        <input
          id="clinicName"
          type="text"
          value={clinicName}
          onChange={(e) => setClinicName(e.target.value)}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white text-gray-900 placeholder-gray-400"
          placeholder="Clinica Sorriso"
        />
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Seu Nome
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white text-gray-900 placeholder-gray-400"
          placeholder="Dr. Maria Silva"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white text-gray-900 placeholder-gray-400"
          placeholder="seu@example.com"
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white text-gray-900 placeholder-gray-400"
          placeholder="Minimo 6 caracteres"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Criando conta...
          </span>
        ) : (
          'Criar Conta'
        )}
      </button>

      {/* Login Link */}
      <p className="text-center text-sm text-gray-600">
        Ja tem uma conta?{' '}
        <a href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
          Entrar
        </a>
      </p>
    </form>
  )
}

function SignupFallback() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-12 bg-gray-200 rounded-lg"></div>
      <div className="h-12 bg-gray-200 rounded-lg"></div>
      <div className="h-12 bg-gray-200 rounded-lg"></div>
      <div className="h-12 bg-gray-200 rounded-lg"></div>
      <div className="h-12 bg-indigo-300 rounded-lg"></div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-600">Synkroo</h1>
          <p className="text-gray-600 mt-2">Automacao para Clinicas Odontologicas</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-6">
            Criar Conta
          </h2>

          <Suspense fallback={<SignupFallback />}>
            <SignupForm />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          2026 Synkroo. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}