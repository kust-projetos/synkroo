'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle } from 'lucide-react'

interface LgpdAnonymizeDialogProps {
  patientId: string
  patientName?: string
  trigger?: React.ReactNode
}

type Step = 'impact' | 'confirm'

export function LgpdAnonymizeDialog({ patientId, patientName, trigger }: LgpdAnonymizeDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('impact')
  const [confirmInput, setConfirmInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isConfirmValid = confirmInput === 'CONFIRMAR'

  const handleContinue = () => {
    setStep('confirm')
  }

  const handleBack = () => {
    setStep('impact')
    setConfirmInput('')
    setError(null)
  }

  const handleAnonymize = async () => {
    if (!isConfirmValid) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/lgpd/anonymize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })

      if (!res.ok) {
        throw new Error('Failed to anonymize patient data')
      }

      const data = await res.json()

      setSuccess(`Dados anonimizados com sucesso. ID do audit: ${data.auditId}`)

      // Close dialog after short delay
      setTimeout(() => {
        setOpen(false)
        setStep('impact')
        setConfirmInput('')
        setSuccess(null)
      }, 2000)
    } catch (err) {
      setError('Erro ao processar anonimizacao. Tente novamente.')
      console.error('LGPD anonymize error:', err)
    } finally {
      setLoading(false)
    }
  }

  const anonymizedFields = [
    'Nome',
    'Telefone',
    'Email',
    'CPF',
    'Data de nascimento',
    'Notas de agendamento',
    'Notas de orcamento',
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="sm">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Anonimizar Dados
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anonimizar Dados do Paciente</DialogTitle>
          <DialogDescription>
            Esta acao e IRREVERSIVEL.
          </DialogDescription>
        </DialogHeader>

        {step === 'impact' && (
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Esta acao irah anonimizar os seguintes dados:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              {anonymizedFields.map((field, index) => (
                <li key={index}>{field}</li>
              ))}
            </ul>

            <div className="mt-6 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Aviso Importante</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esta acao e IRREVERSIVEL. Todos os dados pessoais serao removidos e
                    substituidos por dados anonimos. Continuar?
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Para confirmar, digite <strong>CONFIRMAR</strong> no campo abaixo:
            </p>

            <Input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
              placeholder="Digite CONFIRMAR"
              className="mb-4"
              autoComplete="off"
            />

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {success && (
              <p className="text-sm text-green-600">{success}</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'impact' && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleContinue}>
                Continuar
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={handleBack} disabled={loading}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={handleAnonymize}
                disabled={!isConfirmValid || loading}
              >
                {loading ? 'Processando...' : 'Anonimizar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
