"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TrendData {
  date: string
  concluidos: number
  cancelados: number
  noShow: number
}

interface TrendsChartProps {
  data: TrendData[]
  loading?: boolean
}

export function TrendsChartRecharts({ data, loading }: TrendsChartProps) {
  if (loading) {
    return <div className="h-48 bg-muted rounded-xl animate-pulse" />
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Tendencias (ultimos 14 dias)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tendencias (ultimos 14 dias)</CardTitle></CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "hsl(var(--foreground))",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="concluidos" stackId="a" fill="#16a34a" name="Concluido" />
              <Bar dataKey="cancelados" stackId="a" fill="#f59e0b" name="Cancelado" />
              <Bar dataKey="noShow" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="No-show" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
