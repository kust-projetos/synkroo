'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { Clock, Users, TrendingUp, Activity } from 'lucide-react'

interface StageConversion {
  stage_name: string
  stage_color: string
  total_leads: number
  converted_leads: number
  conversion_rate: number
}

interface ConversionData {
  stages: StageConversion[]
}

interface AvgTimeData {
  avgDays: number
}

interface InactivePatient {
  patientId: string
  patientName: string
  patientPhone: string
  lastVisit: string
  daysSinceVisit: number
}

interface InactiveData {
  patients: InactivePatient[]
}

interface UpsellOpportunity {
  patientId: string
  patientName: string
  lastTreatment: string
  daysSinceCompletion: number
}

interface UpsellData {
  opportunities: UpsellOpportunity[]
}

type LoadingState = {
  funnel: boolean
  avgTime: boolean
  inactive: boolean
  upsell: boolean
}

export function PipelineAnalyticsDashboard() {
  const [funnelData, setFunnelData] = useState<ConversionData | null>(null)
  const [avgTimeData, setAvgTimeData] = useState<AvgTimeData | null>(null)
  const [inactiveData, setInactiveData] = useState<InactiveData | null>(null)
  const [upsellData, setUpsellData] = useState<UpsellData | null>(null)
  const [loading, setLoading] = useState<LoadingState>({
    funnel: true,
    avgTime: true,
    inactive: true,
    upsell: true,
  })
  const [error, setError] = useState<string | null>(null)

  const fetchFunnelData = async () => {
    setLoading(prev => ({ ...prev, funnel: true }))
    try {
      const res = await fetch('/api/pipeline/analytics?action=conversion_by_stage')
      if (!res.ok) throw new Error('Failed to fetch funnel data')
      const data: ConversionData = await res.json()
      setFunnelData(data)
    } catch (err) {
      console.error('Funnel data error:', err)
    } finally {
      setLoading(prev => ({ ...prev, funnel: false }))
    }
  }

  const fetchAvgTime = async () => {
    setLoading(prev => ({ ...prev, avgTime: true }))
    try {
      const res = await fetch('/api/pipeline/analytics?action=avg_conversion_time')
      if (!res.ok) throw new Error('Failed to fetch avg conversion time')
      const data: AvgTimeData = await res.json()
      setAvgTimeData(data)
    } catch (err) {
      console.error('Avg time error:', err)
    } finally {
      setLoading(prev => ({ ...prev, avgTime: false }))
    }
  }

  const fetchInactive = async () => {
    setLoading(prev => ({ ...prev, inactive: true }))
    try {
      const res = await fetch('/api/pipeline/analytics?action=inactive_patients')
      if (!res.ok) throw new Error('Failed to fetch inactive patients')
      const data: InactiveData = await res.json()
      setInactiveData(data)
    } catch (err) {
      console.error('Inactive patients error:', err)
    } finally {
      setLoading(prev => ({ ...prev, inactive: false }))
    }
  }

  const fetchUpsell = async () => {
    setLoading(prev => ({ ...prev, upsell: true }))
    try {
      const res = await fetch('/api/pipeline/analytics?action=upsell_opportunities')
      if (!res.ok) throw new Error('Failed to fetch upsell opportunities')
      const data: UpsellData = await res.json()
      setUpsellData(data)
    } catch (err) {
      console.error('Upsell error:', err)
    } finally {
      setLoading(prev => ({ ...prev, upsell: false }))
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchFunnelData()
    fetchAvgTime()
    fetchInactive()
    fetchUpsell()
  }, [])

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR')
    } catch {
      return dateStr
    }
  }

  // Conversion Funnel Chart
  const renderFunnelChart = () => {
    if (loading.funnel) {
      return <div className="h-64 bg-muted rounded-xl animate-pulse" />
    }

    if (!funnelData?.stages || funnelData.stages.length === 0) {
      return (
        <EmptyState
          title="Nenhum dado de conversao"
          description="Converta leads para gerar metricas de pipeline."
          icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />}
        />
      )
    }

    const chartData = funnelData.stages.map(stage => ({
      name: stage.stage_name,
      taxa: Math.round(stage.conversion_rate * 100),
      total: stage.total_leads,
      convertido: stage.converted_leads,
    }))

    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit="%" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'taxa') return [`${value}%`, 'Taxa de Conversao']
              if (name === 'total') return [value, 'Total Leads']
              if (name === 'convertido') return [value, 'Convertidos']
              return [value, name]
            }}
          />
          <Bar dataKey="taxa" fill="#3b82f6" name="Taxa de Conversao %" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Avg Conversion Time Card
  const renderAvgTimeCard = () => {
    if (loading.avgTime) {
      return <div className="h-32 bg-muted rounded-xl animate-pulse" />
    }

    const avgDays = avgTimeData?.avgDays ?? 0

    if (avgDays === 0) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tempo Medio de Conversao
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Nenhum lead convertido ainda</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Tempo Medio de Conversao
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{avgDays}</div>
          <p className="text-sm text-muted-foreground">dias em media</p>
        </CardContent>
      </Card>
    )
  }

  // Inactive Patients List
  const renderInactiveList = () => {
    if (loading.inactive) {
      return <div className="h-48 bg-muted rounded-xl animate-pulse" />
    }

    const patients = inactiveData?.patients ?? []

    if (patients.length === 0) {
      return (
        <EmptyState
          title="Nenhum paciente inativo"
          description="Pacientes sem visitas em 90+ dias aparecerao aqui."
          icon={<Users className="h-8 w-8 text-muted-foreground" />}
        />
      )
    }

    return (
      <div className="overflow-auto max-h-64">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Ultima Visita</TableHead>
              <TableHead>Dias sem visita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map(patient => (
              <TableRow key={patient.patientId}>
                <TableCell className="font-medium">{patient.patientName}</TableCell>
                <TableCell>{patient.patientPhone}</TableCell>
                <TableCell>{formatDate(patient.lastVisit)}</TableCell>
                <TableCell>
                  <Badge variant={patient.daysSinceVisit > 180 ? 'destructive' : 'secondary'}>
                    {patient.daysSinceVisit} dias
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  // Upsell Opportunities List
  const renderUpsellList = () => {
    if (loading.upsell) {
      return <div className="h-48 bg-muted rounded-xl animate-pulse" />
    }

    const opportunities = upsellData?.opportunities ?? []

    if (opportunities.length === 0) {
      return (
        <EmptyState
          title="Nenhuma oportunidade de upsell"
          description="Pacientes com tratamentos concluidos sem follow-up ativo aparecerao aqui."
          icon={<Activity className="h-8 w-8 text-muted-foreground" />}
        />
      )
    }

    return (
      <div className="overflow-auto max-h-64">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Ultimo Tratamento</TableHead>
              <TableHead>Dias desde conclusao</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.map(opp => (
              <TableRow key={opp.patientId}>
                <TableCell className="font-medium">{opp.patientName}</TableCell>
                <TableCell>{opp.lastTreatment}</TableCell>
                <TableCell>
                  <Badge variant={opp.daysSinceCompletion > 60 ? 'destructive' : 'secondary'}>
                    {opp.daysSinceCompletion} dias
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Funnel Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversao por Etapa</CardTitle>
        </CardHeader>
        <CardContent>{renderFunnelChart()}</CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderAvgTimeCard()}
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pacientes Inativos</CardTitle>
          </CardHeader>
          <CardContent>{renderInactiveList()}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Oportunidades de Upsell</CardTitle>
          </CardHeader>
          <CardContent>{renderUpsellList()}</CardContent>
        </Card>
      </div>
    </div>
  )
}
