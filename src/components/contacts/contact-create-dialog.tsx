'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { UsersIcon } from '@heroicons/react/24/outline'
import { clinicScope } from '@/lib/hooks/use-queries'
import { useCurrentClinicId } from '@/lib/auth/context'

interface ContactCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContactCreateDialog({ open, onOpenChange }: ContactCreateDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  // G1: invalida por PREFIXO do escopo — casa com todas as listas da clínica,
  // incluindo a query ativa ['clinic', clinicId, 'contacts', ''].
  const clinicId = useCurrentClinicId()
  const [step, setStep] = useState<'type' | 'form'>('type')
  const [contactType, setContactType] = useState<'patient' | 'lead' | null>(null)
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', source: '' })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: clinicScope(clinicId, 'contacts') })
      onOpenChange(false)
      setStep('type')
      setContactType(null)
      setFormData({ name: '', phone: '', email: '', source: '' })
      router.replace(`/dashboard/contatos?contact=${data.id}&type=${data.type}`, { scroll: false })
    },
  })

  const handleSelectType = (type: 'patient' | 'lead') => {
    setContactType(type)
    setStep('form')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!contactType || !formData.name || !formData.phone) return
    createMutation.mutate({
      type: contactType,
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      source: contactType === 'lead' ? formData.source : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Contato</DialogTitle>
        </DialogHeader>

        {step === 'type' && (
          <div className="grid grid-cols-2 gap-4 py-4">
            <button
              onClick={() => handleSelectType('patient')}
              className="flex flex-col items-center gap-3 p-6 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <UsersIcon className="h-8 w-8 text-teal-600" />
              <span className="font-medium">Paciente</span>
            </button>
            <button
              onClick={() => handleSelectType('lead')}
              className="flex flex-col items-center gap-3 p-6 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <UsersIcon className="h-8 w-8 text-amber-600" />
              <span className="font-medium">Lead</span>
            </button>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="phone">Telefone *</Label>
              <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            {contactType === 'lead' && (
              <div>
                <Label htmlFor="source">Origem</Label>
                <Input id="source" value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} placeholder="whatsapp, instagram, web..." />
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando...' : 'Criar'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setStep('type')}>Voltar</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}