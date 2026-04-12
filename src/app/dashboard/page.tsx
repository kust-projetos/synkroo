'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useDashboardStats } from '@/lib/hooks/use-queries'
import { ErrorState } from '@/components/ui/ErrorState'
import { StatsGrid } from '@/components/ui/stats-grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
  ClockIcon,
  PlusIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline'

export default function DashboardPage() {
  const { profile } = useAuth()
  const { data: stats, isLoading: statsLoading, error: queryError, refetch } = useDashboardStats()

  const primaryStats = [
    {
      label: 'Agendamentos Hoje',
      value: statsLoading ? '...' : stats?.today.appointments || 0,
      icon: <CalendarDaysIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
      trend: stats?.today.pending
        ? { value: stats.today.pending, label: 'pendente(s)' }
        : undefined,
    },
    {
      label: 'Taxa de Confirmação',
      value: statsLoading ? '...' : `${stats?.metrics.confirmationRate || 0}%`,
      icon: <ClockIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
      trend: { value: 0, label: 'Últimos 30 dias' },
    },
    {
      label: 'Pacientes Inativos',
      value: statsLoading ? '...' : stats?.inactivePatients.totalInactive || 0,
      icon: <UsersIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />,
    },
  ]

  const secondaryStats = [
    {
      label: 'Total de Pacientes',
      value: statsLoading ? '...' : stats?.metrics.totalPatients || 0,
      icon: <UsersIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
    },
    {
      label: 'Campanhas Ativas',
      value: statsLoading ? '...' : stats?.metrics.activeCampaigns || 0,
      icon: <MegaphoneIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
    },
    {
      label: 'Conversas Abertas',
      value: statsLoading ? '...' : stats?.metrics.openConversations || 0,
      icon: <ChatBubbleLeftRightIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
    },
  ]

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Welcome Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Bem-vindo, {profile?.name}!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {profile?.clinics?.name || 'Sua clínica'}
          </p>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {queryError && (
        <div>
          <ErrorState message="Falha ao carregar estatísticas" onRetry={() => refetch()} />
        </div>
      )}

      {/* Primary Stats Grid */}
      <StatsGrid stats={primaryStats} columns={3} />

      {/* Secondary Stats Grid */}
      <StatsGrid stats={secondaryStats} columns={3} />

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/dashboard/agendamentos/novo"
              className="p-4 bg-muted hover:bg-muted/80 rounded-xl transition-colors text-center group"
            >
              <div className="h-10 w-10 rounded-xl bg-teal-600 dark:bg-teal-500 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <PlusIcon className="w-5 h-5 text-white" />
              </div>
              <div className="text-sm font-medium text-foreground">Novo Agendamento</div>
            </Link>
            <Link
              href="/dashboard/pacientes/inativos"
              className="p-4 bg-muted hover:bg-muted/80 rounded-xl transition-colors text-center group"
            >
              <div className="h-10 w-10 rounded-xl bg-orange-600 dark:bg-orange-500 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <ClockIcon className="w-5 h-5 text-white" />
              </div>
              <div className="text-sm font-medium text-foreground">Pacientes Inativos</div>
            </Link>
            <Link
              href="/dashboard/campanhas/nova"
              className="p-4 bg-muted hover:bg-muted/80 rounded-xl transition-colors text-center group"
            >
              <div className="h-10 w-10 rounded-xl bg-teal-600 dark:bg-teal-500 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <MegaphoneIcon className="w-5 h-5 text-white" />
              </div>
              <div className="text-sm font-medium text-foreground">Nova Campanha</div>
            </Link>
            <Link
              href="/dashboard/conversas"
              className="p-4 bg-muted hover:bg-muted/80 rounded-xl transition-colors text-center group"
            >
              <div className="h-10 w-10 rounded-xl bg-teal-600 dark:bg-teal-500 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
              </div>
              <div className="text-sm font-medium text-foreground">Mensagens</div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
