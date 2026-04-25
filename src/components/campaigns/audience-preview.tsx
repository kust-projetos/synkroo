'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type CampaignType = 'reactivation' | 'follow_up' | 'birthday' | 'promotional'

interface AudiencePreviewProps {
  campaignType: CampaignType
  filterCriteria?: {
    lastVisitMin?: number
    lastVisitMax?: number
    birthdayThisWeek?: boolean
    procedures?: string[]
  }
}

interface AudienceData {
  count: number
  patients: Array<{ id: string; name: string; phone: string }>
}

const TYPE_CONFIG: Record<CampaignType, { label: string; description: string; icon: React.ReactNode }> = {
  reactivation: {
    label: 'Reativacao',
    description: 'Inativos 30+ dias',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  follow_up: {
    label: 'Follow-up',
    description: 'Procedimentos recentes',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l-1-1m0 0l1 1m-1-1v4m0 0l1-1m-1 1l-1-1" />
      </svg>
    ),
  },
  birthday: {
    label: 'Aniversario',
    description: 'Aniversariantes esta semana',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3 0v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7h16z" />
      </svg>
    ),
  },
  promotional: {
    label: 'Promocional',
    description: 'Segmento personalizado',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
}

export function AudiencePreview({ campaignType, filterCriteria }: AudiencePreviewProps) {
  const [data, setData] = useState<AudienceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPreview = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ type: campaignType })
        const response = await fetch(`/api/campaigns/segments/preview?${params}`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching audience preview:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPreview()
  }, [campaignType, filterCriteria])

  const config = TYPE_CONFIG[campaignType]

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 animate-pulse">
            <div className="h-16 w-16 bg-muted rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-8 bg-muted rounded w-20" />
              <div className="h-4 bg-muted rounded w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            {config.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className={cn(
                'text-4xl font-bold',
                data && data.count > 0 ? 'text-primary' : 'text-muted-foreground'
              )}>
                {data?.count ?? 0}
              </span>
              <span className="text-lg font-medium text-muted-foreground">
                pacientes
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {config.description}
            </p>
          </div>
        </div>
        {data && data.count === 0 && (
          <p className="mt-4 text-sm text-muted-foreground text-center">
            Nenhum paciente match with this filter
          </p>
        )}
        {data && data.count > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Preview (primeiros 3):</p>
            <div className="space-y-1">
              {data.patients.slice(0, 3).map((p) => (
                <div key={p.id} className="text-sm text-foreground flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">{p.phone}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
