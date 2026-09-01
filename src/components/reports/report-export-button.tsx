'use client'

import { ButtonHTMLAttributes, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'

import { generateAndDownloadClientPDF } from '@/lib/reports/client-pdf'

interface ReportExportButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  reportType: 'appointments' | 'patients' | 'leads' | 'financial' | 'conversations' | 'pipeline'
  defaultFormat?: 'csv' | 'pdf'
  startDate?: string
  endDate?: string
  className?: string
}

export function ReportExportButton({
  reportType,
  defaultFormat = 'csv',
  startDate,
  endDate,
  className,
  ...props
}: ReportExportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async (format: 'csv' | 'pdf') => {
    setLoading(true)
    try {
      if (format === 'pdf') {
        const params = new URLSearchParams({
          type: reportType,
          format: 'json',
        })
        if (startDate) params.set('start_date', startDate)
        if (endDate) params.set('end_date', endDate)

        const res = await fetch(`/api/reports/export?${params.toString()}`)
        if (!res.ok) {
          throw new Error('Falha ao obter dados para exportação')
        }
        const payload = await res.json()
        await generateAndDownloadClientPDF(payload)
      } else {
        const params = new URLSearchParams({
          type: reportType,
          format: 'csv',
        })
        if (startDate) params.set('start_date', startDate)
        if (endDate) params.set('end_date', endDate)

        const url = `/api/reports/export?${params.toString()}`
        window.location.href = url
      }
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          disabled={loading}
          {...props}
        >
          <Download className="h-4 w-4 mr-2" />
          {loading ? 'Exportando...' : 'Exportar Relatorio'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
