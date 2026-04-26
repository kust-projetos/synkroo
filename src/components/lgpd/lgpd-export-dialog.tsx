'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { FileJson, Download } from 'lucide-react'

interface LgpdExportDialogProps {
  patientId: string
  trigger?: React.ReactNode
}

export function LgpdExportDialog({ patientId, trigger }: LgpdExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    setProgress(10)

    try {
      setProgress(30)

      const res = await fetch('/api/lgpd/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })

      setProgress(70)

      if (!res.ok) {
        throw new Error('Failed to export patient data')
      }

      const data = await res.json()

      setProgress(90)

      // Create downloadable file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lgpd_export_${patientId}_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setProgress(100)

      // Close dialog after short delay
      setTimeout(() => {
        setOpen(false)
        setProgress(0)
      }, 1000)
    } catch (err) {
      setError('Erro ao gerar exportacao. Tente novamente.')
      console.error('LGPD export error:', err)
    } finally {
      setLoading(false)
    }
  }

  const dataCategories = [
    'Dados pessoais (nome, telefone, email, CPF, nascimento)',
    'Agendamentos',
    'Orcamentos e pagamentos',
    'Consentimentos',
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileJson className="h-4 w-4 mr-2" />
            Exportar Dados
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Dados do Paciente</DialogTitle>
          <DialogDescription>
            Os seguintes dados serao exportados:
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
            {dataCategories.map((category, index) => (
              <li key={index}>{category}</li>
            ))}
          </ul>

          {loading && (
            <div className="mt-4 space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                {progress < 100 ? 'Gerando exportacao...' : 'Download iniciado!'}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            {loading ? 'Gerando...' : 'Gerar Exportacao'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
