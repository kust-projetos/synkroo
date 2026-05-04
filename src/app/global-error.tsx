'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '28rem', width: '100%', margin: '0 auto', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111827' }}>
              Algo deu errado
            </h1>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Ocorreu um erro inesperado.
            </p>
            <button
              onClick={reset}
              style={{ width: '100%', padding: '0.75rem 1rem', background: '#4f46e5', color: 'white', fontWeight: 500, borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}
            >
              Tentar novamente
            </button>
            {process.env.NODE_ENV === 'development' && error?.message && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', borderRadius: '0.5rem', textAlign: 'left' }}>
                <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#dc2626', wordBreak: 'break-all' }}>
                  {error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}