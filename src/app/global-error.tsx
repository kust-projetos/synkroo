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
    // Log the error to an error reporting service
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full mx-4 text-center">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Algo deu errado
              </h1>
              <p className="text-gray-600 mb-6">
                Ocorreu um erro inesperado. Nossa equipe foi notificada.
              </p>
              <button
                onClick={reset}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
              >
                Tentar novamente
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg text-left">
                <p className="text-xs font-mono text-red-700 break-all">
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