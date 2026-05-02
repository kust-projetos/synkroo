'use client'

import Link from 'next/link'
import { useCrmStats } from '@/lib/hooks/use-queries'
import {
  UsersIcon,
  ChartBarIcon,
  MegaphoneIcon,
  ChatBubbleLeftRightIcon,
  ArrowTrendingUpIcon,
  PlusIcon,
  CalendarIcon,
  ArrowRightIcon,
  FireIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'

export default function CrmPage() {
  const { data: crm } = useCrmStats()

  const conversionRate = crm?.conversionRate ?? 0
  const pipelineValue = crm?.pipelineValue ?? 0
  const campaignRoi = crm?.campaignRoi ?? 0
  const hotLeads = crm?.leadsByTemperature?.hot ?? 0
  const activeLeads = crm?.activeLeads ?? 0

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <PageHeader
        title="CRM"
        description="Central de vendas e relacionamento"
        action={
          <Button asChild className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600">
            <Link href="/dashboard/crm/pipeline">
              <ChartBarIcon className="h-4 w-4 mr-2" />
              Ver Pipeline
            </Link>
          </Button>
        }
      />

      {/* Cross-Module KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Taxa Conversão</p>
                <p className="text-3xl font-bold">{conversionRate}%</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ArrowTrendingUpIcon className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Lead → Paciente</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Valor Pipeline</p>
                <p className="text-3xl font-bold">R$ {pipelineValue.toLocaleString('pt-BR')}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <ChartBarIcon className="h-6 w-6 text-teal-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Oportunidades ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">ROI Campanhas</p>
                <p className="text-3xl font-bold">{campaignRoi > 0 ? `${campaignRoi}%` : '—'}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <MegaphoneIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Retorno sobre investimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/dashboard/leads/novo">
                <PlusIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Novo Lead</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/dashboard/agendamentos/novo">
                <CalendarIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Agendar</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/dashboard/campanhas/nova">
                <MegaphoneIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Campanha</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/dashboard/crm/pipeline">
                <ChartBarIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Pipeline</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hot Leads Alert */}
      {(hotLeads > 0) && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <FireIcon className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold">{hotLeads} lead(s) quente(s)</p>
                  <p className="text-sm text-muted-foreground">precisam de atenção imediata</p>
                </div>
              </div>
              <Button asChild variant="destructive">
                <Link href="/dashboard/leads?filter=hot">Ver Leads</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Module Links */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/dashboard/leads">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <UsersIcon className="h-5 w-5 text-blue-600" />
                </div>
                <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Leads</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {crm?.leadsTotal ?? 0} total · {crm?.leadsByStatus?.new ?? 0} novos
              </p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {crm?.leadsByTemperature?.hot ?? 0} quentes
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {crm?.leadsByTemperature?.warm ?? 0} mornos
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/crm/pipeline">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <ChartBarIcon className="h-5 w-5 text-teal-600" />
                </div>
                <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Pipeline</h3>
              <p className="text-sm text-muted-foreground mb-3">Kanban de vendas</p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {crm?.leadsByStatus?.qualified ?? 0} qualificados
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {crm?.leadsByStatus?.negotiation ?? 0} negociação
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/campanhas">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <MegaphoneIcon className="h-5 w-5 text-purple-600" />
                </div>
                <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Campanhas</h3>
              <p className="text-sm text-muted-foreground mb-3">Marketing e reativação</p>
              <Badge variant="outline" className="text-xs">Gerenciar</Badge>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/conversas">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-600" />
                </div>
                <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Conversas</h3>
              <p className="text-sm text-muted-foreground mb-3">WhatsApp e Instagram</p>
              <Badge variant="outline" className="text-xs">Mensagens</Badge>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
