'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface FinancialChartData {
  name: string
  billed: number
  paid: number
  owed: number
}

interface FinancialChartsProps {
  data: FinancialChartData[]
  loading?: boolean
}

export function FinancialCharts({ data, loading }: FinancialChartsProps) {
  if (loading) {
    return <div className="h-48 bg-muted rounded-xl animate-pulse" />
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Resumo Financeiro</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Resumo Financeiro por Plano</CardTitle></CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 5, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
              />
              <Bar dataKey="billed" fill="#94a3b8" name="Faturado" />
              <Bar dataKey="paid" fill="#16a34a" name="Pago" />
              <Bar dataKey="owed" fill="#ef4444" name="Devido" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
