'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useDashboardStats } from '@/lib/hooks/use-queries'
import { ErrorState } from '@/components/ui/ErrorState'
import { StatsGrid } from '@/components/ui/stats-grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
  ClockIcon,
  PlusIcon,
  MegaphoneIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  SignalIcon,
} from '@heroicons/react/24/outline'

export default function DashboardPage() {
  const { profile } = useAuth()
  const { data: stats, isLoading: statsLoading, error: queryError, refetch } = useDashboardStats()

  const primaryStats = [
    {
      label: 'Agendamentos Hoje',
      value: statsLoading ? '...' : stats?.today.appointments ?? 0,
      icon: <CalendarDaysIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
          },
    {
      label: 'Taxa de Confirmação',
      value: statsLoading ? '...' : `${stats?.metrics.confirmationRate ?? 0}%`,
      icon: <ClockIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
          },
    {
      label: 'Pacientes Inativos',
      value: statsLoading ? '...' : stats?.inactivePatients.totalInactive ?? 0,
      icon: <UsersIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />,
          },
  ]

  const secondaryStats = [
    {
      label: 'Total de Pacientes',
      value: statsLoading ? '...' : stats?.metrics.totalPatients ?? 0,
      icon: <UsersIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
    },
    {
      label: 'Campanhas Ativas',
      value: statsLoading ? '...' : stats?.metrics.activeCampaigns ?? 0,
      icon: <MegaphoneIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
    },
    {
      label: 'Conversas Abertas',
      value: statsLoading ? '...' : stats?.metrics.openConversations ?? 0,
      icon: <ChatBubbleLeftRightIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
    },
  ]

  return (
    <div className="space-y-8 p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Premium Hero Welcome Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-950 via-teal-900 to-slate-950 p-6 lg:p-8 text-white border border-teal-500/20 shadow-2xl shadow-teal-950/40">
        {/* Glow ambient background effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="glow" className="bg-teal-500/20 text-teal-300 border-teal-400/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Status da IA indisponível
              </Badge>
              <Badge variant="outline" className="text-teal-200/80 border-white/10 bg-white/5">
                <SignalIcon className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                WhatsApp: status indisponível
              </Badge>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              Bem-vindo, <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300">{profile?.name || 'Dr. Profissional'}</span>! 👋
            </h1>
            <p className="text-sm lg:text-base text-teal-100/70 max-w-xl">
              Gerencie seus atendimentos, automação de agendamentos e acompanhe a eficiência da clínica {profile?.clinics?.name ? `"${profile.clinics.name}"` : ''} em tempo real.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="glow" size="lg" asChild>
              <Link href="/dashboard/agendamentos/novo">
                <PlusIcon className="w-5 h-5 mr-1" />
                Novo Agendamento
              </Link>
            </Button>
            <Button variant="glass" size="lg" asChild>
              <Link href="/dashboard/conversas">
                <ChatBubbleLeftRightIcon className="w-5 h-5 mr-1 text-teal-300" />
                Ver Chat IA
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {queryError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <ErrorState message="Falha ao carregar estatísticas do servidor" onRetry={() => refetch()} />
        </div>
      )}

      {/* Primary Stats Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-teal-500" />
            Métricas de Hoje
          </h2>
          <span className="text-xs text-muted-foreground font-medium">Atualizado em tempo real</span>
        </div>
        <StatsGrid stats={primaryStats} columns={3} />
      </div>

      {/* Secondary Stats Grid */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Visão Geral do CRM
        </h2>
        <StatsGrid stats={secondaryStats} columns={3} />
      </div>

      {/* Quick Actions & Recent Activity Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Actions Grid (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center justify-between">
                <span>Ações Rápidas</span>
                <span className="text-xs font-normal text-muted-foreground">Acesso direto às ferramentas</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Link
                  href="/dashboard/agendamentos/novo"
                  className="group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-b from-teal-500/5 to-teal-500/10 border border-teal-500/20 hover:border-teal-500/50 transition-all duration-300 hover-lift text-center"
                >
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mx-auto mb-3 text-white shadow-md shadow-teal-500/30 group-hover:scale-110 transition-transform">
                    <PlusIcon className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400">Novo Agendamento</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Criar consulta</div>
                </Link>

                <Link
                  href="/dashboard/pacientes/inativos"
                  className="group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-b from-amber-500/5 to-amber-500/10 border border-amber-500/20 hover:border-amber-500/50 transition-all duration-300 hover-lift text-center"
                >
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-3 text-white shadow-md shadow-amber-500/30 group-hover:scale-110 transition-transform">
                    <ClockIcon className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">Pacientes Inativos</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Reativação IA</div>
                </Link>

                <Link
                  href="/dashboard/campanhas/nova"
                  className="group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-b from-teal-500/5 to-teal-500/10 border border-teal-500/20 hover:border-teal-500/50 transition-all duration-300 hover-lift text-center"
                >
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center mx-auto mb-3 text-white shadow-md shadow-teal-600/30 group-hover:scale-110 transition-transform">
                    <MegaphoneIcon className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400">Nova Campanha</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Disparo WhatsApp</div>
                </Link>

                <Link
                  href="/dashboard/conversas"
                  className="group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-b from-purple-500/5 to-purple-500/10 border border-purple-500/20 hover:border-purple-500/50 transition-all duration-300 hover-lift text-center"
                >
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-3 text-white shadow-md shadow-purple-500/30 group-hover:scale-110 transition-transform">
                    <ChatBubbleLeftRightIcon className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400">Mensagens</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Inbox Unificado</div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Agent Status & Feed Widget */}
        <div className="lg:col-span-1">
          <Card className="glass-card h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-teal-500 animate-pulse" />
                Atividades da IA
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 space-y-4">
              <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
                Nenhuma atividade real disponível.
              </div>

              <div className="pt-2">
                <Link
                  href="/dashboard/conversas"
                  className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Ver Histórico Completo da IA
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
