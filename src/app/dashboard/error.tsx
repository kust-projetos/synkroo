'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-labelledby="dashboard-error-title"
      aria-describedby="dashboard-error-desc"
      style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c1117', fontFamily: 'system-ui, sans-serif' }}
    >
      <div style={{ maxWidth: '28rem', width: '100%', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <div aria-hidden="true" style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h1 id="dashboard-error-title" tabIndex={-1} style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f9fafb' }}>
          Erro no painel
        </h1>
        <p id="dashboard-error-desc" style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
          Não foi possível carregar esta seção do painel.
        </p>
        <button
          type="button"
          onClick={reset}
          aria-label="Recarregar seção do painel"
          style={{ padding: '0.75rem 1.5rem', background: '#0d9488', color: 'white', fontWeight: 500, borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}
        >
          Tentar novamente
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
