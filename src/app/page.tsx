import Link from 'next/link'
import { ChatWidget } from '@/components/chat-widget'
import {
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckIcon,
  ChartBarIcon,
  ClockIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'

// Demo clinic ID - in production this would come from the clinic's subdomain or settings
const DEMO_CLINIC_ID = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a'

export default function HomePage() {
  return (
    <main
      className="min-h-screen"
      style={{
        background: 'linear-gradient(135deg, #0c1117 0%, #0a1a1a 40%, #0c2e2e 100%)'
      }}
    >
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="text-white text-xl font-bold">Synkroo</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-teal-200/70 hover:text-teal-200 transition">
              Dashboard
            </Link>
            <Link href="/api/docs" className="text-teal-200/70 hover:text-teal-200 transition">
              API Docs
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border"
            style={{
              background: 'rgba(17, 94, 89, 0.12)',
              borderColor: 'rgba(17, 94, 89, 0.2)',
              color: '#99f6e4'
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            IA conversacional para clínicas odontológicas
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Automação inteligente para{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-200">
                clínicas odontológicas
              </span>
            </h1>
            <p className="text-xl text-white/60 mb-8">
              Atenda pacientes 24/7 via WhatsApp e Instagram, reduza no-shows em até 30% e aumente sua receita com IA conversacional.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-8 py-4 bg-teal-800 hover:bg-teal-700 text-white font-semibold rounded-xl transition shadow-lg shadow-teal-800/30"
              >
                Acessar Dashboard
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
              <Link
                href="/api/docs"
                className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition border border-white/10"
              >
                Ver Documentação
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-6 mt-10 pt-10 border-t border-white/10">
              <div className="flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-teal-400" />
                <span className="text-white/60 text-sm">Setup em 5 minutos</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-teal-400" />
                <span className="text-white/60 text-sm">Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-teal-400" />
                <span className="text-white/60 text-sm">Suporte 24/7</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-teal-500/30 transition">
              <div className="text-4xl font-bold text-teal-200 mb-2">80%</div>
              <div className="text-white/60 text-sm">Taxa de automação</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-teal-500/30 transition">
              <div className="text-4xl font-bold text-teal-200 mb-2">&lt;5s</div>
              <div className="text-white/60 text-sm">Tempo de resposta</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-teal-500/30 transition">
              <div className="text-4xl font-bold text-teal-200 mb-2">30%</div>
              <div className="text-white/60 text-sm">Redução no-shows</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-teal-500/30 transition">
              <div className="text-4xl font-bold text-teal-200 mb-2">24/7</div>
              <div className="text-white/60 text-sm">Atendimento</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-4">
          Funcionalidades Principais
        </h2>
        <p className="text-white/60 text-center mb-12 max-w-2xl mx-auto">
          Tudo o que você precisa para automatizar sua clínica e proporcionar uma experiência excepcional aos seus pacientes.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-teal-500/30 transition group">
            <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-500/30 transition">
              <ChatBubbleLeftRightIcon className="w-6 h-6 text-teal-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Atendimento Multicanal</h3>
            <p className="text-white/50 text-sm">
              WhatsApp, Instagram e Web. Receba e responda automaticamente em todos os canais.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-teal-500/30 transition group">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition">
              <CalendarDaysIcon className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Agendamento Inteligente</h3>
            <p className="text-white/50 text-sm">
              Agende consultas via conversa natural, com verificação de disponibilidade em tempo real.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-teal-500/30 transition group">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition">
              <SparklesIcon className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">IA Conversacional</h3>
            <p className="text-white/50 text-sm">
              Classificação de intenção, extração de entidades e respostas contextuais com MiniMax.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-teal-500/30 transition group">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-500/30 transition">
              <ChartBarIcon className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Analytics Avançado</h3>
            <p className="text-white/50 text-sm">
              Dashboards completos com métricas de atendimento, conversão e satisfação.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-teal-500/30 transition group">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition">
              <ClockIcon className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Lembretes Automáticos</h3>
            <p className="text-white/50 text-sm">
              Reduza no-shows enviando lembretes automáticos via WhatsApp antes das consultas.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-teal-500/30 transition group">
            <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-pink-500/30 transition">
              <PhoneIcon className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Integração Fácil</h3>
            <p className="text-white/50 text-sm">
              API REST completa e webhooks para integração com qualquer sistema existente.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div
          className="relative rounded-3xl p-12 text-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(17, 94, 89, 0.3) 0%, rgba(13, 148, 136, 0.2) 100%)',
            border: '1px solid rgba(17, 94, 89, 0.3)'
          }}
        >
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl"></div>

          <div className="relative">
            <h2 className="text-3xl font-bold text-white mb-4">
              Pronto para transformar sua clínica?
            </h2>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Comece hoje mesmo e veja os resultados na primeira semana. Sem compromisso, sem cartão de crédito.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-semibold rounded-xl transition shadow-lg shadow-teal-600/30"
              >
                Começar Gratuitamente
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
              <Link
                href="/api/docs"
                className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition border border-white/10"
              >
                Ver Documentação
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* API Status */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6">API Endpoints</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <span className="px-2 py-1 bg-teal-500/20 text-teal-400 text-xs font-mono rounded">POST</span>
              <code className="text-white/70 text-sm">/api/messages/send</code>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <span className="px-2 py-1 bg-teal-500/20 text-teal-400 text-xs font-mono rounded">POST</span>
              <code className="text-white/70 text-sm">/api/messages/inbound</code>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-mono rounded">GET</span>
              <code className="text-white/70 text-sm">/api/messages/history/[id]</code>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <span className="px-2 py-1 bg-teal-500/20 text-teal-400 text-xs font-mono rounded">POST</span>
              <code className="text-white/70 text-sm">/api/whatsapp/send</code>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-700 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="text-white font-semibold">Synkroo</span>
            </div>
            <p className="text-white/40 text-sm text-center">
              © 2026 Synkroo. Automação inteligente para clínicas odontológicas.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-white/40 hover:text-white transition text-sm">Termos</a>
              <a href="#" className="text-white/40 hover:text-white transition text-sm">Privacidade</a>
              <a href="#" className="text-white/40 hover:text-white transition text-sm">Contato</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Chat Widget - no primaryColor prop, uses CSS variables */}
      <ChatWidget
        clinicId={DEMO_CLINIC_ID}
        clinicName="Clínica Demo"
        position="bottom-right"
        greeting="Olá! Sou a Mia, assistente virtual da Clínica Demo. Como posso ajudar?"
      />
    </main>
  )
}
