'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface CampaignMetricsCardProps {
  stats: {
    sent: number
    delivered: number
    read: number
    failed: number
    total: number
    responseRate?: number
  }
  className?: string
}

export function CampaignMetricsCard({ stats, className }: CampaignMetricsCardProps) {
  const deliveryRate = stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0
  const readRate = stats.delivered > 0 ? Math.round((stats.read / stats.delivered) * 100) : 0

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Sent */}
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats.sent}</div>
            <div className="text-xs text-muted-foreground mt-1">Enviadas</div>
          </div>

          {/* Delivered */}
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.delivered}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Entregues
              {stats.sent > 0 && (
                <span className="ml-1 text-primary">({deliveryRate}%)</span>
              )}
            </div>
          </div>

          {/* Read */}
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.read}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Lidas
              {stats.delivered > 0 && (
                <span className="ml-1 text-green-600 dark:text-green-400">({readRate}%)</span>
              )}
            </div>
          </div>

          {/* Failed */}
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
            <div className="text-xs text-muted-foreground mt-1">Falharam</div>
          </div>
        </div>

        {/* Progress bars */}
        <div className="mt-4 space-y-2">
          {/* Sent/Total progress */}
          {stats.total > 0 && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progresso</span>
                <span>{Math.round((stats.sent / stats.total) * 100)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-teal-600 to-teal-400 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((stats.sent / stats.total) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Delivery rate */}
          {stats.sent > 0 && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Taxa de Entrega</span>
                <span>{deliveryRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${deliveryRate}%` }}
                />
              </div>
            </div>
          )}

          {/* Response rate if available */}
          {stats.responseRate !== undefined && stats.responseRate > 0 && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Taxa de Resposta</span>
                <span>{stats.responseRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${stats.responseRate}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
