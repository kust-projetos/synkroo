'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface PipelineFunnelChartProps {
  data: Array<{
    name: string
    taxa: number
    total: number
    convertido: number
  }>
}

export function PipelineFunnelChart({ data }: PipelineFunnelChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
          formatter={(value, name) => {
            const num = typeof value === 'number' ? value : 0
            if (name === 'taxa') return [`${num}%`, 'Taxa de Conversao']
            if (name === 'total') return [num, 'Total Leads']
            if (name === 'convertido') return [num, 'Convertidos']
            return [String(value ?? ''), String(name ?? '')]
          }}
        />
        <Bar dataKey="taxa" fill="#3b82f6" name="Taxa de Conversao %" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
