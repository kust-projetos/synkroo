'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FormPage } from '@/components/ui/form-page'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function NovoProcedimentoPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    duration_minutes: 30,
    price: 0,
  })

  const handleSubmit = async () => {
    setSaving(true)

    try {
      const response = await fetch('/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: profile?.clinic_id,
          ...form,
        }),
      })

      if (response.ok) {
        router.push('/dashboard/procedimentos')
      }
    } catch (error) {
      console.error('Error creating procedure:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormPage
      title="Novo Procedimento"
      backHref="/dashboard/procedimentos"
      onSubmit={handleSubmit}
      loading={saving}
    >
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Nome *</label>
        <Input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Limpeza, Clareamento, Implante..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
          rows={3}
          placeholder="Descrição do procedimento..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Duração (minutos)</label>
          <Input
            type="number"
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 30 })}
            min={15}
            step={15}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Preço (R$)</label>
          <Input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
            min={0}
            step={0.01}
          />
        </div>
      </div>
    </FormPage>
  )
}
