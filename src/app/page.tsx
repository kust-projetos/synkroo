import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckIcon,
  ChartBarIcon,
  ClockIcon,
  PhoneIcon,
  ShieldCheckIcon,
  BoltIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#060a12] text-slate-100 overflow-x-hidden selection:bg-teal-500 selection:text-white relative">
      {/* Background Mesh Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-teal-500/20 via-emerald-600/10 to-transparent blur-3xl opacity-60 animate-pulse-glow" />
        <div className="absolute top-1/3 -left-48 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#060a12]/80 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-400 via-teal-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30 ring-1 ring-white/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="text-white text-xl font-extrabold tracking-tight">Synkroo</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-widest hidden sm:inline-block">
              SaaS v2.4
            </span>
          </div>

          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-medium text-slate-300 hover:text-white transition">
              Dashboard
            </Link>
            <Link href="/api/docs" className="text-sm font-medium text-slate-300 hover:text-white transition hidden md:inline-block">
              API Docs
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-teal-500/25 border border-teal-400/30 active:scale-95"
            >
              Acessar Sistema
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 pt-20 pb-24">
        {/* Release Pill Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-teal-500/10 border border-teal-500/30 text-teal-300 shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
            </span>
            <span>Inteligência Artificial Conversacional Odontológica 24/7</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Hero Content (7 Cols) */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <h1 className="text-4xl sm:text-6xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
              Automação de Elite para{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-emerald-300 to-cyan-300">
                Clínicas Odontológicas
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
              Atenda seus pacientes instantaneamente no WhatsApp e Instagram, confirme consultas via IA conversacional e reduza o no-show em até <strong className="text-teal-300 font-semibold">30%</strong>.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 via-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold text-base rounded-2xl transition-all shadow-xl shadow-teal-500/30 border border-teal-400/40 hover-lift"
              >
                Acessar Dashboard Pro
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
              <Link
                href="/api/docs"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-base rounded-2xl transition border border-white/10 backdrop-blur-md"
              >
                Ver Documentação API
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-white/10 text-slate-400 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Setup em 5min</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span>LGPD Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <BoltIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>Resposta &lt; 2s</span>
              </div>
            </div>
          </div>

          {/* Interactive AI Chatbot Simulation Card (5 Cols) */}
          <div className="lg:col-span-5 relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 rounded-3xl blur-xl opacity-30 animate-pulse-glow" />
            <div className="relative rounded-3xl bg-[#0c1322] border border-white/15 p-5 shadow-2xl backdrop-blur-2xl">
              {/* Chat Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                      AI
                    </div>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[#0c1322]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      Assistente Synkroo
                      <SparklesIcon className="w-3.5 h-3.5 text-teal-400" />
                    </div>
                    <span className="text-[11px] text-teal-400 font-medium">WhatsApp Business • Online 24/7</span>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  AUTO-REPLY
                </span>
              </div>

              {/* Chat Messages Flow */}
              <div className="space-y-3.5 text-xs font-sans">
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-3.5 text-slate-200 max-w-[85%]">
                  <span className="text-[10px] text-slate-400 block mb-1 font-semibold">Paciente • 09:41</span>
                  Olá! Gostaria de agendar uma avaliação odontológica para amanhã à tarde.
                </div>

                <div className="bg-gradient-to-r from-teal-600/30 to-emerald-600/30 border border-teal-500/40 rounded-2xl rounded-tr-none p-3.5 text-white ml-auto max-w-[88%] shadow-lg">
                  <span className="text-[10px] text-teal-300 block mb-1 font-bold flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3 text-teal-300" /> Synkroo IA • 09:41
                  </span>
                  Com certeza! Tenho horário disponível amanhã às <strong>14:30</strong> e <strong>16:00</strong> com o Dr. Carlos. Qual prefere?
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-3.5 text-slate-200 max-w-[85%]">
                  <span className="text-[10px] text-slate-400 block mb-1 font-semibold">Paciente • 09:42</span>
                  Perfeito, pode ser às 14:30!
                </div>

                <div className="bg-gradient-to-r from-teal-600/40 to-emerald-600/40 border border-teal-400/50 rounded-2xl rounded-tr-none p-3.5 text-white ml-auto max-w-[88%] shadow-lg">
                  <span className="text-[10px] text-teal-300 block mb-1 font-bold flex items-center gap-1">
                    <CheckIcon className="w-3 h-3 text-emerald-400" /> Synkroo IA • 09:42
                  </span>
                  Consulta confirmada para <strong>amanhã às 14:30</strong>! Já enviei o lembrete de localização. Até lá! 🦷✨
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Banner */}
      <section className="relative z-10 border-y border-white/10 bg-white/[0.02] backdrop-blur-md py-12">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="space-y-1">
            <div className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">80%</div>
            <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Taxa de Automação</div>
          </div>
          <div className="space-y-1">
            <div className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">&lt;2s</div>
            <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Tempo de Resposta</div>
          </div>
          <div className="space-y-1">
            <div className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">30%</div>
            <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Redução de No-Shows</div>
          </div>
          <div className="space-y-1">
            <div className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">24/7</div>
            <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Atendimento Contínuo</div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-24 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <Badge variant="glow" className="bg-teal-500/10 text-teal-300 border-teal-500/30 px-3 py-1">
            RECURSOS AVANÇADOS
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Tudo o que sua clínica precisa para crescer
          </h2>
          <p className="text-slate-400 text-base">
            Tecnologia odontológica projetada para encantar pacientes, otimizar a agenda dos dentistas e automatizar o relacionamento.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="group rounded-3xl p-6 bg-white/[0.03] border border-white/10 hover:border-teal-500/40 transition-all duration-300 hover-lift relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center mb-5 text-teal-400 group-hover:scale-110 transition-transform">
              <ChatBubbleLeftRightIcon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Atendimento Multicanal</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Integração completa com WhatsApp Business e Instagram Direct. Respostas unificadas e centralizadas no mesmo inbox.
            </p>
          </div>

          <div className="group rounded-3xl p-6 bg-white/[0.03] border border-white/10 hover:border-teal-500/40 transition-all duration-300 hover-lift relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-5 text-emerald-400 group-hover:scale-110 transition-transform">
              <CalendarDaysIcon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Agendamento Inteligente</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Verificação automática de horários disponíveis, confirmação em tempo real e remanejamento sem intervenção humana.
            </p>
          </div>

          <div className="group rounded-3xl p-6 bg-white/[0.03] border border-white/10 hover:border-teal-500/40 transition-all duration-300 hover-lift relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-5 text-cyan-400 group-hover:scale-110 transition-transform">
              <SparklesIcon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">IA Conversacional MiniMax</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Extração precisa de intenções do paciente, resposta a dúvidas frequentes de tratamentos e pré-triagem odontológica.
            </p>
          </div>

          <div className="group rounded-3xl p-6 bg-white/[0.03] border border-white/10 hover:border-teal-500/40 transition-all duration-300 hover-lift relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-5 text-purple-400 group-hover:scale-110 transition-transform">
              <ChartBarIcon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Analytics & ROI</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Painéis em tempo real com taxa de conversão de leads, no-shows, receita gerada e preditor de cancelamentos.
            </p>
          </div>

          <div className="group rounded-3xl p-6 bg-white/[0.03] border border-white/10 hover:border-teal-500/40 transition-all duration-300 hover-lift relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-5 text-amber-400 group-hover:scale-110 transition-transform">
              <ClockIcon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Lembretes & Reativação</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Mensagens preventivas automáticas 24h antes da consulta e campanhas inteligentes de resgate de pacientes inativos.
            </p>
          </div>

          <div className="group rounded-3xl p-6 bg-white/[0.03] border border-white/10 hover:border-teal-500/40 transition-all duration-300 hover-lift relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-5 text-indigo-400 group-hover:scale-110 transition-transform">
              <PhoneIcon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Evolution API Integration</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Conexão estável e escalável com suporte a webhooks, gerenciamento de instâncias e disparo de campanhas com rate limiting.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-16">
        <div className="relative rounded-3xl p-10 sm:p-16 text-center overflow-hidden bg-gradient-to-br from-teal-950 via-teal-900 to-slate-950 border border-teal-500/30 shadow-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl" />

          <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Pronto para revolucionar o atendimento da sua clínica?
            </h2>
            <p className="text-slate-300 text-base">
              Experimente o Synkroo hoje mesmo e transforme suas conversas no WhatsApp em agendamentos confirmados.
            </p>
            <div className="pt-4 flex flex-wrap justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold rounded-2xl transition shadow-xl shadow-teal-500/30 border border-teal-400/30 hover-lift"
              >
                Criar Conta Gratuitamente
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-10 bg-[#04070d]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
              S
            </div>
            <span className="text-white font-bold">Synkroo SaaS</span>
          </div>
          <p className="text-slate-500 text-xs text-center">
            © 2026 Synkroo. Plataforma SaaS de automação odontológica com IA conversacional.
          </p>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <Link href="/api/docs" className="hover:text-white transition">API Docs</Link>
            <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
