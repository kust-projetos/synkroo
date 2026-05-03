'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { KanbanBoard } from '@/components/pipeline/kanban-board'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/lib/auth/context'

type LeadSource = 'whatsapp' | 'instagram' | 'web' | 'referral' | 'campaign' | 'other'

const sourceLabels: Record<LeadSource, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  web: 'Website',
  referral: 'Indicação',
  campaign: 'Campanha',
  other: 'Outro',
}

export default function CrmPipelinePage() {
  const { profile } = useAuth()
  const [clinicId, setClinicId] = useState('')
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'whatsapp' as LeadSource,
    interest: '',
    notes: '',
  })

  useEffect(() => {
    if (profile?.clinic_id) {
      setClinicId(profile.clinic_id)
    }
  }, [profile])

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      setError('Nome e telefone são obrigatórios')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setOpen(false)
        setFormData({ name: '', phone: '', email: '', source: 'whatsapp', interest: '', notes: '' })
        window.location.reload()
      } else {
        const data = await response.json()
        setError(data.error || 'Erro ao criar lead')
      }
    } catch {
      setError('Erro ao criar lead')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline de Vendas</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus leads e acompanhe o progresso</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white">
          <PlusIcon className="h-4 w-4" />
          Novo Lead
        </Button>
      </div>
      <div className="flex-1 overflow-hidden p-6">
        <KanbanBoard clinicId={clinicId} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Telefone *</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Origem</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as LeadSource })}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.entries(sourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Interesse</label>
              <Input
                value={formData.interest}
                onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                placeholder="Ex: Clareamento, Implante..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                placeholder="Informações adicionais..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-teal-600 hover:bg-teal-700">
              {submitting ? 'Salvando...' : 'Salvar Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
