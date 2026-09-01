'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface FinancialOverviewChartProps {
  data: Array<{
    name: string
    receita: number
    pagamentos: number
    receber: number
  }>
  formatCurrency: (val: number) => string
}

export function FinancialOverviewChart({ data, formatCurrency }: FinancialOverviewChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$ ${v}`} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value, name) => {
            const num = typeof value === 'number' ? value : 0
            if (name === 'receita') return [formatCurrency(num), 'Receita']
            if (name === 'pagamentos') return [formatCurrency(num), 'Pagamentos']
            if (name === 'receber') return [formatCurrency(num), 'Em Aberto']
            return [String(value ?? ''), String(name ?? '')]
          }}
        />
        <Bar dataKey="receita" fill="#16a34a" name="Receita" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pagamentos" fill="#3b82f6" name="Pagamentos" radius={[4, 4, 0, 0]} />
        <Bar dataKey="receber" fill="#f59e0b" name="Em Aberto" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
