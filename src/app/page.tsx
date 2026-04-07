import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-teal-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="text-white text-xl font-bold">Synkroo</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-white/70 hover:text-white transition">
              Dashboard
            </Link>
            <Link href="/api/docs" className="text-white/70 hover:text-white transition">
              API Docs
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Automação inteligente para{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-teal-400">
                clínicas odontológicas
              </span>
            </h1>
            <p className="text-xl text-white/70 mb-8">
              Atenda pacientes 24/7 via WhatsApp e Instagram, reduza no-shows em até 30% e aumente sua receita com IA conversacional.
            </p>
            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-teal-500 text-white font-semibold rounded-xl hover:opacity-90 transition shadow-lg shadow-green-500/25"
              >
                Acessar Dashboard
              </Link>
              <Link
                href="/api/docs"
                className="px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition border border-white/20"
              >
                Ver Documentação
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="text-4xl font-bold text-green-400 mb-2">80%</div>
              <div className="text-white/70">Taxa de automação</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="text-4xl font-bold text-green-400 mb-2">&lt;5s</div>
              <div className="text-white/70">Tempo de resposta</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="text-4xl font-bold text-green-400 mb-2">30%</div>
              <div className="text-white/70">Redução no-shows</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="text-4xl font-bold text-green-400 mb-2">24/7</div>
              <div className="text-white/70">Atendimento</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Funcionalidades Principais
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Atendimento Multicanal</h3>
            <p className="text-white/60">
              WhatsApp, Instagram e Web. Receba e responda automaticamente em todos os canais.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Agendamento Inteligente</h3>
            <p className="text-white/60">
              Agende consultas via conversa natural, com verificação de disponibilidade em tempo real.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">IA Conversacional</h3>
            <p className="text-white/60">
              Classificação de intenção, extração de entidades e respostas contextuais com MiniMax.
            </p>
          </div>
        </div>
      </section>

      {/* API Status */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6">API Endpoints</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-mono rounded">POST</span>
              <code className="text-white/70">/api/messages/send</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-mono rounded">POST</span>
              <code className="text-white/70">/api/messages/inbound</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-mono rounded">GET</span>
              <code className="text-white/70">/api/messages/history/[id]</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-mono rounded">POST</span>
              <code className="text-white/70">/api/whatsapp/send</code>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-white/50">
          <p>© 2026 Synkroo. Automação inteligente para clínicas odontológicas.</p>
        </div>
      </footer>
    </main>
  )
}