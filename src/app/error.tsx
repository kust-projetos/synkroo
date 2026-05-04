'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c1117', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '28rem', width: '100%', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f9fafb' }}>
          Erro na página
        </h1>
        <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
          Não foi possível carregar esta página.
        </p>
        <button
          onClick={reset}
          style={{ padding: '0.75rem 1.5rem', background: '#0d9488', color: 'white', fontWeight: 500, borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}
        >
          Recarregar
        </button>
        {process.env.NODE_ENV === 'development' && error?.message && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(220, 38, 38, 0.1)', borderRadius: '0.5rem', textAlign: 'left', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
            <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#fca5a5', wordBreak: 'break-all' }}>
              {error.message}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}